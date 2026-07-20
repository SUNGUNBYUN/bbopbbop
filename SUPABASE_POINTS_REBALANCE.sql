-- ============================================================
--  포인트 규칙 재설계
--
--  바뀌는 것
--   1) 제보하면 즉시 일부 지급 (0P → 즉시 + 확정 분리)
--      · 상품 제보   : 즉시 10P, 확인되면 +40P  (합 50P)
--      · 새 가게 등록 : 즉시 20P, 확인되면 +80P  (합 100P)
--      · 남의 제보 확인: 10P
--      · 중복 제보    : 0P
--   2) 하루 총량 상한(200P) 폐지
--      → 골목에 몰려 있는 가게를 여러 곳 제보하는 건 정당한 활동이므로 막지 않음
--   3) 대신 '담합'만 차단
--      · 같은 (확인자 → 제보자) 쌍은 하루 3회까지만 포인트 발생
--      · 확인해주고 받는 10P는 하루 10건까지
--
--  Supabase SQL Editor에서 실행. 여러 번 실행해도 안전.
-- ============================================================


-- ============================================================
--  0. 확인(재인증) 기록 — 담합 차단용
-- ============================================================
create table if not exists verify_log (
  id uuid primary key default gen_random_uuid(),
  verifier_id uuid not null references auth.users(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  post_id     uuid not null,
  created_at  timestamptz default now()
);

create index if not exists verify_log_pair_idx     on verify_log(verifier_id, owner_id, created_at desc);
create index if not exists verify_log_verifier_idx on verify_log(verifier_id, created_at desc);

alter table verify_log enable row level security;
-- 조회/쓰기는 서버 함수로만 (정책 없음 = 클라이언트 접근 불가)


-- ============================================================
--  1. 가게 확보 — 새로 등록하면 즉시 20P
-- ============================================================
create or replace function get_or_create_place(
  p_place_name text, p_address text,
  p_lat double precision, p_lng double precision,
  p_kakao_id text default null, p_existing_place_id uuid default null
) returns json as $$
declare
  v_user uuid := auth.uid();
  v_place_id uuid;
  v_is_new boolean := false;
  v_reward int := 0;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;

  if p_existing_place_id is not null then
    v_place_id := p_existing_place_id;
  else
    insert into places(place_name, address, latitude, longitude, kakao_place_id, created_by, created_nickname)
      values (p_place_name, p_address, p_lat, p_lng, p_kakao_id, v_user,
              (select nickname from profiles where id = v_user))
      returning id into v_place_id;
    v_is_new := true;

    -- 새 가게를 처음 올린 것에 대한 즉시 보상
    v_reward := 20;
    insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
    values (v_user, v_reward, 'place_create', 'place', v_place_id::text);
    update profiles set point_balance = point_balance + v_reward where id = v_user;
  end if;

  return json_build_object('place_id', v_place_id, 'place_reward', v_reward, 'is_new_place', v_is_new);
end;
$$ language plpgsql security definer;


-- ============================================================
--  2. 상품 제보 — 중복이 아니면 즉시 10P
-- ============================================================
create or replace function award_product_report(
  p_post_id uuid, p_place_id uuid, p_title text, p_force boolean default false
) returns json as $$
declare
  v_user uuid := auth.uid();
  v_key text;
  v_dup int;
  v_is_dup boolean := false;
  v_reward int := 0;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;

  v_key := lower(regexp_replace(coalesce(p_title,''), '[^가-힣a-zA-Z0-9]', '', 'g'));
  update posts set product_key = v_key, place_id = p_place_id where id = p_post_id;

  if p_force then
    v_dup := 0;
  elsif p_place_id is not null and length(v_key) >= 2 then
    select count(*) into v_dup from posts
    where place_id = p_place_id and id <> p_post_id and created_at > now() - interval '7 days'
      and product_key is not null and length(product_key) >= 2
      and (product_key = v_key or product_key like '%'||v_key||'%' or v_key like '%'||product_key||'%');
  else
    v_dup := 0;
  end if;

  v_is_dup := (v_dup > 0);

  if p_place_id is not null then
    update places set product_count = (select count(*) from posts where place_id = p_place_id) where id = p_place_id;
  end if;

  if v_is_dup then
    -- 중복이면 보상 없음, 확정 처리해서 더 이상 대기하지 않게
    update posts set reward_confirmed = true where id = p_post_id;
  else
    -- 제보 즉시 보상
    v_reward := 10;
    insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
    values (v_user, v_reward, 'report', 'post', p_post_id::text);
    update profiles set point_balance = point_balance + v_reward where id = v_user;
  end if;

  return json_build_object('post_reward', v_reward, 'is_dup', v_is_dup);
end;
$$ language plpgsql security definer;


-- ============================================================
--  3. 확인(재인증) — 확정 보상 + 담합 차단
--     · 확인자        : 10P (하루 10건까지)
--     · 제보 작성자   : +40P (그 제보가 처음 확인받을 때)
--     · 가게 등록자   : +80P (그 가게가 처음 확인받을 때)
--     · 같은 (확인자 → 제보자) 쌍은 하루 3회까지만 포인트 발생
-- ============================================================
create or replace function verify_post(p_post_id uuid)
returns json as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_confirmed boolean;
  v_place uuid;
  v_recent int;
  v_my int := 0;
  v_owner_r int := 0;
  v_place_owner uuid;
  v_place_confirmed boolean;
  v_place_r int := 0;
  v_pair_today int;
  v_verifier_today int;
  v_allow_reward boolean := true;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;

  select user_id, reward_confirmed, place_id
    into v_owner, v_confirmed, v_place
    from posts where id = p_post_id;

  if v_owner is null then raise exception '제보를 찾을 수 없습니다'; end if;
  if v_owner = v_user then raise exception '본인 제보는 확인할 수 없어요'; end if;

  -- 이 제보를 이미 확인했는지
  select count(*) into v_recent from points_ledger
   where user_id = v_user and reason = 'reverify' and ref_id = p_post_id::text;

  -- ── 담합 차단 ──
  -- 같은 제보자의 글을 오늘 몇 번이나 확인했는지
  select count(*) into v_pair_today from verify_log
   where verifier_id = v_user and owner_id = v_owner
     and created_at >= date_trunc('day', now());

  -- 오늘 내가 확인해준 총 건수
  select count(*) into v_verifier_today from verify_log
   where verifier_id = v_user
     and created_at >= date_trunc('day', now());

  if v_pair_today >= 3 then
    v_allow_reward := false;   -- 같은 사람 글만 반복 확인 → 보상 중단
  end if;

  -- 신선도 갱신은 항상 수행 (보상과 무관하게 정보는 최신으로)
  if v_recent = 0 then
    update posts
       set verify_count = coalesce(verify_count,0)+1, last_verified_at = now()
     where id = p_post_id;

    insert into verify_log(verifier_id, owner_id, post_id)
    values (v_user, v_owner, p_post_id);

    -- 확인해준 사람 보상 (하루 10건까지)
    if v_allow_reward and v_verifier_today < 10 then
      insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
      values (v_user, 10, 'reverify', 'post', p_post_id::text);
      update profiles set point_balance = point_balance + 10 where id = v_user;
      v_my := 10;
    end if;
  else
    update posts set last_verified_at = now() where id = p_post_id;
  end if;

  -- 제보 작성자 확정 보상 (+40P, 최초 1회)
  if not coalesce(v_confirmed, false) and v_allow_reward then
    update posts set reward_confirmed = true where id = p_post_id;
    insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
    values (v_owner, 40, 'product_confirmed', 'post', p_post_id::text);
    update profiles set point_balance = point_balance + 40 where id = v_owner;
    v_owner_r := 40;
  end if;

  -- 가게 등록자 확정 보상 (+80P, 최초 1회)
  if v_place is not null and v_allow_reward then
    select created_by, reward_confirmed into v_place_owner, v_place_confirmed
      from places where id = v_place;
    if v_place_owner is not null
       and not coalesce(v_place_confirmed, false)
       and v_place_owner <> v_user then
      update places
         set reward_confirmed = true, confirm_count = coalesce(confirm_count,0)+1
       where id = v_place;
      insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
      values (v_place_owner, 80, 'place_confirmed', 'place', v_place::text);
      update profiles set point_balance = point_balance + 80 where id = v_place_owner;
      v_place_r := 80;
    end if;
  end if;

  return json_build_object(
    'my_reward', v_my,
    'owner_confirmed', v_owner_r,
    'place_confirmed', v_place_r,
    'verify_count', (select verify_count from posts where id = p_post_id),
    'already', (v_recent > 0),
    'limited', (not v_allow_reward)
  );
end;
$$ language plpgsql security definer;


-- ============================================================
--  4. 자랑글 보상 (하루 3개까지 5P)
--     기존 award_points의 하루 200P 총량 상한은 제거하고,
--     자랑글 자체 개수 제한만 유지.
-- ============================================================
create or replace function award_points(p_reason text, p_ref_type text default null, p_ref_id text default null)
returns int as $$
declare
  v_user uuid := auth.uid();
  v_amount int;
  v_today_start timestamptz := date_trunc('day', now());
  v_feed_count int;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;

  -- 지금은 자랑글만 이 경로를 사용 (제보·가게·확인은 전용 함수에서 처리)
  if p_reason <> 'feed' then return 0; end if;
  v_amount := 5;

  select count(*) into v_feed_count from points_ledger
   where user_id = v_user and reason = 'feed' and created_at >= v_today_start;
  if v_feed_count >= 3 then return 0; end if;

  insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
  values (v_user, v_amount, p_reason, p_ref_type, p_ref_id);
  update profiles set point_balance = point_balance + v_amount where id = v_user;
  return v_amount;
end;
$$ language plpgsql security definer;


-- ============================================================
--  완료!
--
--  정리된 포인트 표
--   · 새 가게 등록      즉시 20P  →  확인되면 +80P   (합 100P)
--   · 상품 제보         즉시 10P  →  확인되면 +40P   (합  50P)
--   · 남의 제보 확인    10P (하루 10건까지)
--   · 자랑글            5P (하루 3개까지)
--   · 중복 제보         0P
--   · 현상금 채택       건 금액만큼 (유저 간 이동)
--
--  하루 총량 상한 없음. 단, 같은 사람끼리 반복 확인은 하루 3회까지만 보상.
-- ============================================================
