-- ============================================================
--  뽑뽑 포인트 제도 — Phase 3 (2단계 구조: 가게 + 상품)
--  ⚠️ Phase 1 실행 후 이걸 실행. Phase 2(V2)는 이 파일로 대체됨.
--  이전 세션의 유령 places 스키마(name NOT NULL 등)를 깨끗이 정리한다.
--  여러 번 실행해도 안전.
-- ============================================================

-- ────────────────────────────────────────────────
-- (사전) 반환타입이 바뀐 기존 함수 제거 (create or replace로는 반환타입 변경 불가)
-- ────────────────────────────────────────────────
drop function if exists find_nearby_places(double precision, double precision, text);
drop function if exists register_place(text, text, double precision, double precision, text, uuid);
drop function if exists get_or_create_place(text, text, double precision, double precision, text, uuid);
drop function if exists award_product_report(uuid, uuid, text);
drop function if exists verify_post(uuid);

-- ────────────────────────────────────────────────
-- 0. 기존 places 재생성 (유령 컬럼 name/registered_by 등 제거)
--    ⚠️ places 데이터는 초기화된다. posts는 건드리지 않는다.
--    (테스트 단계라 places엔 유효 데이터가 없다는 전제)
-- ────────────────────────────────────────────────
drop view if exists admin_report_queue;
drop table if exists places cascade;

create table places (
  id uuid primary key default gen_random_uuid(),
  place_name text not null,             -- 가게 이름
  address text,
  latitude double precision not null,
  longitude double precision not null,
  kakao_place_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_nickname text,
  confirm_count int default 0,          -- 가게 실재 확인 횟수
  reward_confirmed boolean default false, -- 가게 등록 90P 확정 여부
  product_count int default 0,          -- 이 가게에 제보된 상품 수
  created_at timestamptz default now()
);
create index idx_places_lat on places(latitude);
create index idx_places_lng on places(longitude);
create index idx_places_kakao on places(kakao_place_id);

alter table places enable row level security;
drop policy if exists "places 조회 공개" on places;
create policy "places 조회 공개" on places for select using (true);


-- ────────────────────────────────────────────────
-- 1. posts(상품 제보)에 필요한 컬럼
-- ────────────────────────────────────────────────
alter table posts add column if not exists place_id uuid references places(id) on delete set null;
alter table posts add column if not exists verify_count int default 0;
alter table posts add column if not exists last_verified_at timestamptz default now();
alter table posts add column if not exists reward_confirmed boolean default false;
alter table posts add column if not exists hidden boolean default false;
-- 상품 중복 판별용: 정규화된 상품명(공백/특수문자 제거)
alter table posts add column if not exists product_key text;


-- ────────────────────────────────────────────────
-- 2. 근처 가게 후보 (등록 전 "이 가게 아닌가요?")
-- ────────────────────────────────────────────────
create or replace function find_nearby_places(
  p_lat double precision,
  p_lng double precision,
  p_kakao_id text default null
)
returns table (
  id uuid, place_name text, address text,
  latitude double precision, longitude double precision,
  product_count int, distance_m double precision
) as $$
  select p.id, p.place_name, p.address, p.latitude, p.longitude, p.product_count,
    ( 6371000 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(p_lat)) * cos(radians(p.latitude)) *
          cos(radians(p.longitude) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(p.latitude))
        ))
      ) ) as distance_m
  from places p
  where
    (p_kakao_id is not null and p.kakao_place_id = p_kakao_id)
    or (
      p.latitude between p_lat - 0.0006 and p_lat + 0.0006
      and p.longitude between p_lng - 0.0006 and p_lng + 0.0006
    )
  order by distance_m asc
  limit 5;
$$ language sql stable;


-- ────────────────────────────────────────────────
-- 3. 가게 확보(get-or-create)
--    - existingPlaceId 주면 그대로 사용(기존 가게에 상품 추가)
--    - 없으면 신규 가게 생성 + 가게 최초 등록 보상(즉시 10P, 확정 90P는 재인증)
--    반환 json: { place_id, place_reward, is_new_place }
-- ────────────────────────────────────────────────
create or replace function get_or_create_place(
  p_place_name text,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_kakao_id text default null,
  p_existing_place_id uuid default null
)
returns json as $$
declare
  v_user uuid := auth.uid();
  v_place_id uuid;
  v_reward int := 0;
  v_is_new boolean := false;
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
    -- 가게 최초 등록: 즉시 10P (확정 90P는 가게 재인증 시)
    insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
      values (v_user, 10, 'place_create', 'place', v_place_id::text);
    update profiles set point_balance = point_balance + 10 where id = v_user;
    v_reward := 10;
  end if;

  return json_build_object('place_id', v_place_id, 'place_reward', v_reward, 'is_new_place', v_is_new);
end;
$$ language plpgsql security definer;


-- ────────────────────────────────────────────────
-- 4. 상품 제보 등록 — 상품 단위 중복 판별 + 20P
--    같은 place_id + 같은 product_key(정규화 상품명)가
--    7일 이내에 있으면 = 중복 → 포인트 0, is_dup=true
--    7일 지났으면 = "업데이트 재제보" 허용 → 20P
--    반환 json: { post_reward, is_dup }
--    ⚠️ posts insert는 앱에서 하고, 이 함수는 등록 '후' 호출해
--       product_key 세팅 + 중복판정 + 포인트를 처리한다.
-- ────────────────────────────────────────────────
create or replace function award_product_report(
  p_post_id uuid,
  p_place_id uuid,
  p_title text
)
returns json as $$
declare
  v_user uuid := auth.uid();
  v_key text;
  v_dup int;
  v_reward int := 0;
  v_is_dup boolean := false;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;

  -- 상품명 정규화(소문자화+공백/특수문자 제거)
  v_key := lower(regexp_replace(coalesce(p_title,''), '[^가-힣a-zA-Z0-9]', '', 'g'));

  update posts set product_key = v_key, place_id = p_place_id where id = p_post_id;

  -- 같은 가게 같은 상품이 7일 이내에 이미 제보됐나 (본인 제보 제외)
  if p_place_id is not null and v_key <> '' then
    select count(*) into v_dup from posts
    where place_id = p_place_id and product_key = v_key
      and id <> p_post_id
      and created_at > now() - interval '7 days';
  else
    v_dup := 0;
  end if;

  if v_dup > 0 then
    v_is_dup := true;
    v_reward := 0;
  else
    insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
      values (v_user, 20, 'product_report', 'post', p_post_id::text);
    update profiles set point_balance = point_balance + 20 where id = v_user;
    v_reward := 20;
  end if;

  -- 가게 상품 수 갱신
  if p_place_id is not null then
    update places set product_count = (select count(*) from posts where place_id = p_place_id)
      where id = p_place_id;
  end if;

  return json_build_object('post_reward', v_reward, 'is_dup', v_is_dup);
end;
$$ language plpgsql security definer;


-- ────────────────────────────────────────────────
-- 5. 재인증 "진짜 있어요" (상품 제보 대상)
--    - verify_count+1, 신선도 리셋
--    - 확인자 +10P (24h 쿨다운, 본인 제외)
--    - 미확정 제보면 작성자 확정 +30P
--    - 그 상품이 속한 가게가 미확정이면 가게 작성자 확정 +90P
-- ────────────────────────────────────────────────
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
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;

  select user_id, reward_confirmed, place_id into v_owner, v_confirmed, v_place
  from posts where id = p_post_id;
  if v_owner is null then raise exception '제보를 찾을 수 없습니다'; end if;
  if v_owner = v_user then raise exception '본인 제보는 확인할 수 없어요'; end if;

  select count(*) into v_recent from points_ledger
  where user_id = v_user and reason = 'reverify'
    and ref_id = p_post_id::text and created_at > now() - interval '24 hours';

  update posts set verify_count = coalesce(verify_count,0)+1, last_verified_at = now()
    where id = p_post_id;

  if v_recent = 0 then
    insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
      values (v_user, 10, 'reverify', 'post', p_post_id::text);
    update profiles set point_balance = point_balance + 10 where id = v_user;
    v_my := 10;
  end if;

  -- 상품 제보 확정(30P)
  if not coalesce(v_confirmed,false) then
    update posts set reward_confirmed = true where id = p_post_id;
    insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
      values (v_owner, 30, 'product_confirmed', 'post', p_post_id::text);
    update profiles set point_balance = point_balance + 30 where id = v_owner;
    v_owner_r := 30;
  end if;

  -- 가게 등록 확정(90P) — 이 상품이 가게에 연결돼 있고 가게가 미확정이면
  if v_place is not null then
    select created_by, reward_confirmed into v_place_owner, v_place_confirmed
    from places where id = v_place;
    if v_place_owner is not null and not coalesce(v_place_confirmed,false) and v_place_owner <> v_user then
      update places set reward_confirmed = true, confirm_count = coalesce(confirm_count,0)+1 where id = v_place;
      insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
        values (v_place_owner, 90, 'place_confirmed', 'place', v_place::text);
      update profiles set point_balance = point_balance + 90 where id = v_place_owner;
      v_place_r := 90;
    end if;
  end if;

  return json_build_object('my_reward', v_my, 'owner_confirmed', v_owner_r, 'place_confirmed', v_place_r);
end;
$$ language plpgsql security definer;


-- ────────────────────────────────────────────────
-- 6. 신고 누적 → 자동 숨김 + 관리자 큐 (Phase 2와 동일)
-- ────────────────────────────────────────────────
create or replace function auto_hide_on_reports()
returns trigger as $$
declare v_cnt int;
begin
  if new.target_type = 'post' then
    select count(distinct reporter_id) into v_cnt
    from reports where target_type = 'post' and target_id = new.target_id;
    if v_cnt >= 3 then
      update posts set hidden = true where id = new.target_id::uuid;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_auto_hide on reports;
create trigger trg_auto_hide after insert on reports
  for each row execute function auto_hide_on_reports();

create or replace view admin_report_queue as
select p.id, p.title, p.nickname, p.hidden, p.created_at,
  count(distinct r.reporter_id) as report_count,
  array_agg(distinct r.reason) as reasons
from posts p
join reports r on r.target_type = 'post' and r.target_id = p.id::text
group by p.id
order by report_count desc, p.created_at desc;


-- ============================================================
--  완료! 2단계 구조:
--   가게 등록:  get_or_create_place() → 즉시 10P (+가게 재인증 시 90P)
--   상품 제보:  award_product_report() → 20P (상품 중복 7일이면 0P)
--   재인증:     verify_post() → 확인자 10P, 상품확정 30P, 가게확정 90P
-- ============================================================
