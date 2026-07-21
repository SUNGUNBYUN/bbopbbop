-- ============================================================
--  중복 후보 판정 정밀화
--
--  문제:
--   반경 150m 안이면 이름이 달라도 "이미 등록된 가게"로 떴습니다.
--   노량진처럼 한 골목에 뽑기방이 7곳씩 몰린 곳에서는
--   전혀 다른 가게가 계속 후보로 잡힙니다.
--
--  기준 변경:
--   · 카카오 장소 ID가 같으면      → 같은 가게 (거리 무관)
--   · 이름이 같거나 포함관계면     → 600m 이내까지 같은 가게로 봄
--     (예: "토이즈 팝" ↔ "토이즈팝 노량진점")
--   · 이름이 다르면                → 후보로 보지 않음
--     밀집 지역 오작동이 오타 케이스보다 훨씬 흔합니다.
--
--  Supabase SQL Editor에서 실행. 여러 번 실행해도 안전.
-- ============================================================


-- ============================================================
--  1. 중복 후보 조회 — 이름이 비슷할 때만
-- ============================================================
create or replace function find_nearby_places(
  p_lat double precision,
  p_lng double precision,
  p_kakao_id text default null,
  p_name text default null
)
returns table (
  id uuid, place_name text, address text,
  latitude double precision, longitude double precision,
  product_count int, distance_m double precision
) as $$
  with q as (
    select regexp_replace(coalesce(p_name, ''), '\s', '', 'g') as norm_q
  ),
  base as (
    select
      p.id, p.place_name, p.address, p.latitude, p.longitude,
      coalesce(p.product_count, 0) as product_count,
      p.kakao_place_id,
      regexp_replace(coalesce(p.place_name, ''), '\s', '', 'g') as norm_name,
      (6371000 * acos(least(1.0, greatest(-1.0,
        cos(radians(p_lat)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(p.latitude))
      )))) as distance_m
    from places p
  )
  select b.id, b.place_name, b.address, b.latitude, b.longitude, b.product_count, b.distance_m
  from base b cross join q
  where
    -- 카카오에서 같은 장소로 식별되면 확실한 같은 가게
    (p_kakao_id is not null and b.kakao_place_id = p_kakao_id)
    or (
      -- 이름이 같거나 서로 포함관계일 때만 (띄어쓰기 무시)
      length(q.norm_q) >= 2
      and length(b.norm_name) >= 2
      and (b.norm_name like '%' || q.norm_q || '%' or q.norm_q like '%' || b.norm_name || '%')
      and b.distance_m <= 600
    )
  order by b.distance_m asc
  limit 5;
$$ language sql stable;


-- ============================================================
--  2. 가게 자동 재사용도 같은 기준으로
--
--   주소만 같으면 재사용하던 것을 막습니다.
--   상가 건물이면 같은 주소에 뽑기방이 여러 곳일 수 있습니다.
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
  v_norm text;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;

  v_norm := regexp_replace(coalesce(p_place_name, ''), '\s', '', 'g');

  -- (1) 사용자가 "이 가게 맞아요"로 직접 고른 경우
  if p_existing_place_id is not null then
    v_place_id := p_existing_place_id;
  end if;

  -- (2) 카카오 장소 ID가 같으면 같은 가게
  if v_place_id is null and coalesce(p_kakao_id, '') <> '' then
    select id into v_place_id from places
     where kakao_place_id = p_kakao_id
     limit 1;
  end if;

  -- (3) 이름이 같거나 포함관계 + 300m 이내
  if v_place_id is null and length(v_norm) >= 2 then
    select id into v_place_id from places p
     where length(regexp_replace(coalesce(p.place_name,''), '\s', '', 'g')) >= 2
       and (
             regexp_replace(coalesce(p.place_name,''), '\s', '', 'g') like '%' || v_norm || '%'
          or v_norm like '%' || regexp_replace(coalesce(p.place_name,''), '\s', '', 'g') || '%'
           )
       and (6371000 * acos(least(1.0, greatest(-1.0,
             cos(radians(p_lat)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(p_lng)) +
             sin(radians(p_lat)) * sin(radians(p.latitude))
           )))) <= 300
     order by (6371000 * acos(least(1.0, greatest(-1.0,
             cos(radians(p_lat)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(p_lng)) +
             sin(radians(p_lat)) * sin(radians(p.latitude))
           )))) asc
     limit 1;
  end if;

  -- (4) 위 어느 것도 아니면 새 가게 (+20P)
  --     ※ 주소만 같은 경우는 더 이상 재사용하지 않습니다.
  --       같은 건물에 다른 뽑기방이 있을 수 있기 때문입니다.
  if v_place_id is null then
    insert into places(place_name, address, latitude, longitude, kakao_place_id, created_by, created_nickname)
      values (p_place_name, p_address, p_lat, p_lng, nullif(p_kakao_id, ''), v_user,
              (select nickname from profiles where id = v_user))
      returning id into v_place_id;
    v_is_new := true;

    v_reward := 20;
    insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
    values (v_user, v_reward, 'place_create', 'place', v_place_id::text);
    update profiles set point_balance = point_balance + v_reward where id = v_user;
  else
    -- 기존 가게에 카카오 ID가 비어 있으면 채워둠
    if coalesce(p_kakao_id, '') <> '' then
      update places set kakao_place_id = p_kakao_id
       where id = v_place_id and coalesce(kakao_place_id, '') = '';
    end if;
  end if;

  return json_build_object('place_id', v_place_id, 'place_reward', v_reward, 'is_new_place', v_is_new);
end;
$$ language plpgsql security definer;


-- ============================================================
--  3. 자동 병합도 같은 기준 (이름 유사 + 500m) — 이미 그렇게 되어 있으나
--     주소만 같은 쌍은 자동 병합하지 않도록 뷰도 조정
-- ============================================================
create or replace view place_duplicate_candidates as
with n as (
  select
    p.id, p.place_name, p.address, p.latitude, p.longitude,
    coalesce(p.product_count, 0) as product_count,
    p.created_at,
    regexp_replace(coalesce(p.place_name, ''), '\s', '', 'g') as norm_name
  from places p
)
select
  a.id            as keep_id,
  a.place_name    as keep_name,
  a.product_count as keep_posts,
  b.id            as drop_id,
  b.place_name    as drop_name,
  b.product_count as drop_posts,
  a.address       as keep_address,
  b.address       as drop_address,
  round((6371000 * acos(least(1.0, greatest(-1.0,
    cos(radians(a.latitude)) * cos(radians(b.latitude)) * cos(radians(b.longitude) - radians(a.longitude)) +
    sin(radians(a.latitude)) * sin(radians(b.latitude))
  ))))::numeric, 0) as distance_m
from n a
join n b
  on a.id <> b.id
 -- 이름이 서로 포함관계일 때만 (주소만 같은 건 다른 가게일 수 있음)
 and length(a.norm_name) >= 2 and length(b.norm_name) >= 2
 and (a.norm_name like '%' || b.norm_name || '%' or b.norm_name like '%' || a.norm_name || '%')
where (a.product_count > b.product_count)
   or (a.product_count = b.product_count and a.created_at <= b.created_at)
order by distance_m;


-- ============================================================
--  완료!
--   이제 "대빵 오락실" 등록 시 115m 떨어진 "토이즈 팝"은
--   후보로 뜨지 않습니다.
-- ============================================================
