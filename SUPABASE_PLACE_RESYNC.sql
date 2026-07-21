-- ============================================================
--  가게 표기 재동기화
--
--  증상:
--   같은 가게인데 제보마다 표기가 달랐습니다.
--     · "서울특별시 동작구 노량진로 162"        (주소만)
--     · "토이즈 팝 (서울특별시 동작구 노량진로 162)"  (옛 형식)
--
--  원인:
--   merge_places 가 '옮겨오는' 제보만 갱신하고,
--   남는 가게에 원래 붙어 있던 제보는 그대로 뒀습니다.
--
--  Supabase SQL Editor에서 실행. 여러 번 실행해도 안전.
-- ============================================================


-- ============================================================
--  1. places.address 표기 정리 (혹시 남아 있으면)
--     "가게명 (주소)" → "주소"
-- ============================================================
update places
   set address = btrim(substring(address from '\(([^)]*)\)$'))
 where address ~ '\([^)]*\)$'
   and btrim(substring(address from '\(([^)]*)\)$')) <> '';


-- ============================================================
--  2. place_id 가 연결된 모든 제보를 가게 정보와 일치시킴
-- ============================================================
update posts p
   set place_name = pl.place_name,
       location   = pl.address,
       latitude   = pl.latitude,
       longitude  = pl.longitude
  from places pl
 where p.place_id = pl.id
   and (
        coalesce(p.place_name, '') is distinct from coalesce(pl.place_name, '')
     or coalesce(p.location, '')   is distinct from coalesce(pl.address, '')
     or p.latitude  is distinct from pl.latitude
     or p.longitude is distinct from pl.longitude
       );


-- ============================================================
--  3. place_id 가 없는 옛 제보도 이름으로 찾아 연결 + 정리
-- ============================================================
update posts p
   set place_id   = pl.id,
       place_name = pl.place_name,
       location   = pl.address,
       latitude   = pl.latitude,
       longitude  = pl.longitude
  from places pl
 where p.place_id is null
   and p.place_name is not null
   and regexp_replace(p.place_name, '\s', '', 'g') = regexp_replace(pl.place_name, '\s', '', 'g');


-- ============================================================
--  4. 마켓 글도 같은 기준으로 정리
-- ============================================================
update market_items m
   set place_name = pl.place_name,
       location   = pl.address,
       latitude   = pl.latitude,
       longitude  = pl.longitude
  from places pl
 where m.place_name is not null
   and regexp_replace(m.place_name, '\s', '', 'g') = regexp_replace(pl.place_name, '\s', '', 'g')
   and (
        coalesce(m.location, '') is distinct from coalesce(pl.address, '')
     or m.latitude  is distinct from pl.latitude
     or m.longitude is distinct from pl.longitude
       );


-- ============================================================
--  5. 상품 수 다시 계산
-- ============================================================
update places pl
   set product_count = (select count(*) from posts x where x.place_id = pl.id);


-- ============================================================
--  6. merge_places 개선
--     앞으로 병합할 때 '남는 쪽' 제보 표기까지 함께 맞춥니다.
--     (지금까지는 옮겨오는 제보만 갱신해서 표기가 섞였습니다)
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
  v_synced int := 0;
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

  -- (1) 합칠 가게의 제보를 남길 가게로 이동
  update posts
     set place_id = p_keep, place_name = v_name, location = v_addr,
         latitude = v_lat, longitude = v_lng
   where place_id = p_drop;
  get diagnostics v_moved = row_count;

  -- (2) 남는 가게에 원래 붙어 있던 제보도 표기 통일  ← 이번에 추가된 부분
  update posts
     set place_name = v_name, location = v_addr,
         latitude = v_lat, longitude = v_lng
   where place_id = p_keep
     and (coalesce(place_name,'') is distinct from v_name
       or coalesce(location,'')   is distinct from coalesce(v_addr,''));
  get diagnostics v_synced = row_count;

  -- (3) place_id 없이 이름만 남은 옛 제보
  update posts
     set place_id = p_keep, place_name = v_name, location = v_addr,
         latitude = v_lat, longitude = v_lng
   where place_id is null
     and place_name in (v_drop_name, v_name);
  get diagnostics v_legacy = row_count;

  -- (4) 마켓 글 표기 통일
  update market_items
     set place_name = v_name, location = v_addr,
         latitude = v_lat, longitude = v_lng
   where place_name in (v_drop_name, v_name);
  get diagnostics v_market = row_count;

  update places
     set product_count = (select count(*) from posts where place_id = p_keep)
   where id = p_keep;

  delete from places where id = p_drop;

  return json_build_object(
    'kept_name',     v_name,
    'merged_name',   v_drop_name,
    'moved_posts',   v_moved,
    'synced_posts',  v_synced,
    'renamed_posts', v_legacy,
    'moved_markets', v_market
  );
end;
$$ language plpgsql security definer;

revoke all on function merge_places(uuid, uuid) from public;
revoke all on function merge_places(uuid, uuid) from anon;
revoke all on function merge_places(uuid, uuid) from authenticated;


-- ============================================================
--  확인용
--
--   select place_name, location, count(*)
--     from posts group by place_name, location order by place_name;
--
--   → 같은 가게가 한 줄로만 나오면 정리 완료
-- ============================================================
