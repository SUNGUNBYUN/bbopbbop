-- ============================================================
--  같은 가게가 두 번 등록된 것 합치기 + 재발 방지
--
--  왜 생겼나:
--   지도는 posts.place_name 문자열이 똑같아야 하나로 묶습니다.
--   카카오 검색에서 "토이즈 팝"과 "토이즈팝 노량진점"이
--   좌표가 살짝 다른 별개 항목으로 나오면 각각 등록돼 핀이 2개가 됩니다.
--
--  Supabase SQL Editor에서 실행. 여러 번 실행해도 안전.
-- ============================================================


-- ============================================================
--  1. 중복 후보 찾기 (먼저 이걸 실행해서 눈으로 확인하세요)
--     500m 안에 있으면서 이름이 서로 포함관계인 쌍을 보여줍니다.
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
 and (
      -- 이름이 서로 포함관계 (띄어쓰기 무시)
      (length(a.norm_name) >= 2 and length(b.norm_name) >= 2
       and (a.norm_name like '%' || b.norm_name || '%' or b.norm_name like '%' || a.norm_name || '%'))
      -- 또는 주소가 완전히 같음
      or (a.address is not null and a.address = b.address)
     )
-- 제보가 많은 쪽을 남기도록 정렬 (같으면 먼저 만들어진 쪽)
where (a.product_count > b.product_count)
   or (a.product_count = b.product_count and a.created_at <= b.created_at)
order by distance_m;

comment on view place_duplicate_candidates is
  '중복으로 의심되는 가게 쌍. keep_id를 남기고 drop_id를 합치면 됩니다.';


-- ============================================================
--  2. 병합 함수
--     남길 가게(p_keep)로 합칠 가게(p_drop)의 제보를 모두 옮기고,
--     표시 이름·주소·좌표까지 통일한 뒤 합칠 가게를 삭제합니다.
-- ============================================================
create or replace function merge_places(p_keep uuid, p_drop uuid)
returns json as $$
declare
  v_name text;
  v_addr text;
  v_lat  double precision;
  v_lng  double precision;
  v_drop_name text;
  v_moved  int := 0;
  v_market int := 0;
  v_legacy int := 0;
begin
  if p_keep = p_drop then
    raise exception '같은 가게끼리는 합칠 수 없습니다';
  end if;

  select place_name, address, latitude, longitude
    into v_name, v_addr, v_lat, v_lng
    from places where id = p_keep;
  if v_name is null then
    raise exception '남길 가게를 찾을 수 없습니다';
  end if;

  select place_name into v_drop_name from places where id = p_drop;
  if v_drop_name is null then
    raise exception '합칠 가게를 찾을 수 없습니다';
  end if;

  -- (1) 합칠 가게에 연결된 제보를 남길 가게로 이동 + 표시 정보 통일
  update posts
     set place_id   = p_keep,
         place_name = v_name,
         location   = v_addr,
         latitude   = v_lat,
         longitude  = v_lng
   where place_id = p_drop;
  get diagnostics v_moved = row_count;

  -- (2) place_id 없이 이름만 남아있는 예전 제보도 통일
  update posts
     set place_name = v_name,
         location   = v_addr,
         latitude   = v_lat,
         longitude  = v_lng
   where place_id is null
     and place_name = v_drop_name;
  get diagnostics v_legacy = row_count;

  -- (3) 마켓 글의 장소 표기도 통일
  update market_items
     set place_name = v_name,
         location   = v_addr,
         latitude   = v_lat,
         longitude  = v_lng
   where place_name = v_drop_name;
  get diagnostics v_market = row_count;

  -- (4) 상품 수 다시 계산 후 중복 가게 삭제
  update places
     set product_count = (select count(*) from posts where place_id = p_keep)
   where id = p_keep;

  delete from places where id = p_drop;

  return json_build_object(
    'kept_name',     v_name,
    'merged_name',   v_drop_name,
    'moved_posts',   v_moved,
    'renamed_posts', v_legacy,
    'moved_markets', v_market
  );
end;
$$ language plpgsql security definer;

-- 관리 작업이므로 앱에서는 호출 불가 (SQL Editor에서만)
revoke all on function merge_places(uuid, uuid) from public;
revoke all on function merge_places(uuid, uuid) from anon;
revoke all on function merge_places(uuid, uuid) from authenticated;


-- ============================================================
--  3. 이름만 다르게 저장된 제보 일괄 정리
--     가게 테이블에는 하나뿐인데 제보의 place_name만 제각각일 때 사용.
-- ============================================================
create or replace function rename_place_in_posts(p_from text, p_to text)
returns int as $$
declare
  v_addr text; v_lat double precision; v_lng double precision; v_n int := 0;
begin
  select address, latitude, longitude into v_addr, v_lat, v_lng
    from places where place_name = p_to limit 1;

  update posts
     set place_name = p_to,
         location   = coalesce(v_addr, location),
         latitude   = coalesce(v_lat, latitude),
         longitude  = coalesce(v_lng, longitude)
   where place_name = p_from;
  get diagnostics v_n = row_count;

  update market_items
     set place_name = p_to,
         location   = coalesce(v_addr, location),
         latitude   = coalesce(v_lat, latitude),
         longitude  = coalesce(v_lng, longitude)
   where place_name = p_from;

  return v_n;
end;
$$ language plpgsql security definer;

revoke all on function rename_place_in_posts(text, text) from public;
revoke all on function rename_place_in_posts(text, text) from anon;
revoke all on function rename_place_in_posts(text, text) from authenticated;


-- ============================================================
--  4. 재발 방지 — 중복 후보 탐지 강화
--     · 반경 60m → 150m
--     · 이름이 비슷하면 600m까지 후보로 인정
--       ("토이즈 팝" ↔ "토이즈팝 노량진점" 같은 경우)
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
  with base as (
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
  ),
  q as (
    select regexp_replace(coalesce(p_name, ''), '\s', '', 'g') as norm_q
  )
  select b.id, b.place_name, b.address, b.latitude, b.longitude, b.product_count, b.distance_m
  from base b cross join q
  where
       (p_kakao_id is not null and b.kakao_place_id = p_kakao_id)
    or (b.distance_m <= 150)
    or (
         length(q.norm_q) >= 2
     and b.distance_m <= 600
     and (b.norm_name like '%' || q.norm_q || '%' or q.norm_q like '%' || b.norm_name || '%')
       )
  order by b.distance_m asc
  limit 5;
$$ language sql stable;


-- ============================================================
--  사용법
--
--  1) 중복 후보 확인
--       select * from place_duplicate_candidates;
--
--  2) 합치기 (keep_id 를 남기고 drop_id 를 흡수)
--       select merge_places('여기에-keep_id', '여기에-drop_id');
--
--  3) 확인
--       select id, place_name, address, product_count from places order by place_name;
-- ============================================================
