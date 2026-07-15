-- ============================================================
--  뽑뽑 포인트 제도 — Phase 4 (어뷰징 방어 강화)
--  ⚠️ V3 실행 후 이걸 실행. 함수만 교체(테이블/데이터 안 건드림).
--  변경점:
--   1) 가게 등록/상품 제보 '즉시 지급'을 0으로 → 재인증 시 전액 확정
--   2) 상품 중복: 정확 일치 + 포함관계(피카츄⊂소형피카츄)까지 감지
--   3) 가게의 기존 상품 목록 조회 함수(place_products) 추가
--  여러 번 실행해도 안전.
-- ============================================================

drop function if exists get_or_create_place(text, text, double precision, double precision, text, uuid);
drop function if exists award_product_report(uuid, uuid, text);
drop function if exists award_product_report(uuid, uuid, text, boolean);
drop function if exists place_products(uuid);
drop function if exists similar_products(uuid, text);


-- ────────────────────────────────────────────────
-- 1. 가게 확보 — 즉시 지급 0 (신규 가게도 0P, 재인증 시 100P)
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
    -- ⚠️ 즉시 지급 없음. 가게 100P는 재인증(verify_post)에서 확정.
  end if;

  return json_build_object('place_id', v_place_id, 'place_reward', 0, 'is_new_place', v_is_new);
end;
$$ language plpgsql security definer;


-- ────────────────────────────────────────────────
-- 2. 상품 제보 — 즉시 지급 0 + 유사도(포함관계) 중복 감지
--    중복이면 is_dup=true. 아니면 등록만(포인트는 재인증 시 확정).
-- ────────────────────────────────────────────────
create or replace function award_product_report(
  p_post_id uuid,
  p_place_id uuid,
  p_title text,
  p_force boolean default false
)
returns json as $$
declare
  v_user uuid := auth.uid();
  v_key text;
  v_dup int;
  v_is_dup boolean := false;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;

  -- 정규화(소문자+한글/영숫자만)
  v_key := lower(regexp_replace(coalesce(p_title,''), '[^가-힣a-zA-Z0-9]', '', 'g'));
  update posts set product_key = v_key, place_id = p_place_id where id = p_post_id;

  -- 유저가 "다른 상품이다"라고 확정(p_force)하면 중복 검사 건너뜀
  if p_force then
    v_dup := 0;
  elsif p_place_id is not null and length(v_key) >= 2 then
    select count(*) into v_dup from posts
    where place_id = p_place_id
      and id <> p_post_id
      and created_at > now() - interval '7 days'
      and product_key is not null and length(product_key) >= 2
      and ( product_key = v_key
            or product_key like '%' || v_key || '%'
            or v_key like '%' || product_key || '%' );
  else
    v_dup := 0;
  end if;

  v_is_dup := (v_dup > 0);
  -- ⚠️ 즉시 지급 없음. 상품 50P는 재인증에서 확정. 중복이면 재인증해도 확정 안 됨(아래 verify에서 처리).

  if p_place_id is not null then
    update places set product_count = (select count(*) from posts where place_id = p_place_id)
      where id = p_place_id;
  end if;

  -- 중복이면 이 제보는 확정 대상에서 제외(reward_confirmed를 true로 막아 재인증 확정 방지)
  if v_is_dup then
    update posts set reward_confirmed = true where id = p_post_id; -- 이미 처리됨 취급 → 확정 지급 안 함
  end if;

  return json_build_object('post_reward', 0, 'is_dup', v_is_dup);
end;
$$ language plpgsql security definer;


-- ────────────────────────────────────────────────
-- 3. 가게의 기존 상품 목록 (등록 전 유저에게 보여주기)
-- ────────────────────────────────────────────────
create or replace function place_products(p_place_id uuid)
returns table (id uuid, title text, image_url text, created_at timestamptz) as $$
  select id, title, image_url, created_at
  from posts
  where place_id = p_place_id and coalesce(hidden,false) = false
  order by created_at desc
  limit 20;
$$ language sql stable;


-- ────────────────────────────────────────────────
-- 4. 재인증 verify_post — 즉시분이 0이므로 전액을 여기서 확정
--    확인자 +10P(즉시), 상품 작성자 50P 확정, 가게 등록자 100P 확정
--    (중복 상품은 award_product_report에서 reward_confirmed=true로 막아둠 → 확정 안 됨)
-- ────────────────────────────────────────────────
drop function if exists verify_post(uuid);
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

  -- 이 사람이 '이 제보'를 예전에 확인한 적 있나(쿨다운 아님, 영구 1회 기준)
  select count(*) into v_recent from points_ledger
  where user_id = v_user and reason = 'reverify'
    and ref_id = p_post_id::text;

  -- 신선도 시각은 항상 갱신, 카운트와 보상은 '처음 확인한 사람'만
  if v_recent = 0 then
    update posts set verify_count = coalesce(verify_count,0)+1, last_verified_at = now()
      where id = p_post_id;
    insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
      values (v_user, 10, 'reverify', 'post', p_post_id::text);
    update profiles set point_balance = point_balance + 10 where id = v_user;
    v_my := 10;
  else
    update posts set last_verified_at = now() where id = p_post_id; -- 재방문 확인은 신선도만 갱신
  end if;

  -- 상품 제보 확정(50P) — 미확정(=중복 아님)일 때만
  if not coalesce(v_confirmed,false) then
    update posts set reward_confirmed = true where id = p_post_id;
    insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
      values (v_owner, 50, 'product_confirmed', 'post', p_post_id::text);
    update profiles set point_balance = point_balance + 50 where id = v_owner;
    v_owner_r := 50;
  end if;

  -- 가게 등록 확정(100P)
  if v_place is not null then
    select created_by, reward_confirmed into v_place_owner, v_place_confirmed
    from places where id = v_place;
    if v_place_owner is not null and not coalesce(v_place_confirmed,false) and v_place_owner <> v_user then
      update places set reward_confirmed = true, confirm_count = coalesce(confirm_count,0)+1 where id = v_place;
      insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
        values (v_place_owner, 100, 'place_confirmed', 'place', v_place::text);
      update profiles set point_balance = point_balance + 100 where id = v_place_owner;
      v_place_r := 100;
    end if;
  end if;

  return json_build_object('my_reward', v_my, 'owner_confirmed', v_owner_r, 'place_confirmed', v_place_r,
    'verify_count', (select verify_count from posts where id = p_post_id),
    'already', (v_recent > 0));
end;
$$ language plpgsql security definer;


-- ────────────────────────────────────────────────
-- 5. 유사 상품 조회 (사진 포함) — 입력한 상품명과 비슷한 기존 상품
--    유저에게 팝업으로 보여주고 "같은 거/다른 거" 판단하게 함
-- ────────────────────────────────────────────────
create or replace function similar_products(p_place_id uuid, p_title text)
returns table (id uuid, title text, image_url text, created_at timestamptz) as $$
declare v_key text;
begin
  v_key := lower(regexp_replace(coalesce(p_title,''), '[^가-힣a-zA-Z0-9]', '', 'g'));
  if p_place_id is null or length(v_key) < 2 then return; end if;
  return query
    select p.id, p.title, p.image_url, p.created_at
    from posts p
    where p.place_id = p_place_id
      and coalesce(p.hidden,false) = false
      and p.product_key is not null and length(p.product_key) >= 2
      and (
        -- 완전 일치 또는 포함관계
        p.product_key = v_key
        or p.product_key like '%' || v_key || '%'
        or v_key like '%' || p.product_key || '%'
        -- 공통 접두어 2글자 이상 (파이리중형 vs 파이리대형 → '파이리' 겹침)
        or left(p.product_key, 2) = left(v_key, 2)
      )
    order by p.created_at desc
    limit 10;
end;
$$ language plpgsql stable;


-- ============================================================
--  완료! 이제:
--   - 가게/상품 등록 시 즉시 지급 0
--   - 재인증(verify_post) 받아야 가게 100P/상품 50P 확정
--   - 상품 중복은 정확일치 + 포함관계까지 감지
--   - place_products()로 가게의 기존 상품 목록 조회 가능
-- ============================================================
