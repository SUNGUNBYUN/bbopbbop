-- ============================================================
--  가게 위치(좌표) 수정
--
--  왜 필요한가:
--   카카오에 같은 가게가 좌표가 다른 여러 항목으로 등록돼 있으면
--   병합 후 남은 좌표가 실제 위치와 다를 수 있습니다.
--   그때마다 SQL로 고치기 번거로우니 앱에서 지도로 고칠 수 있게 합니다.
--
--  Supabase SQL Editor에서 실행. 여러 번 실행해도 안전.
-- ============================================================


-- ============================================================
--  가게 좌표·주소 수정 + 연결된 제보/마켓까지 함께 갱신
--
--  수정 권한 (셋 중 하나면 가능):
--   · 그 가게를 등록한 사람
--   · 그 가게에 제보를 올린 사람 (실제로 가본 사람)
--   · 등록자 정보가 없는 예전 가게
--
--  틀린 핀은 모두에게 피해라서, 최초 등록자만 고칠 수 있게 하면
--  영영 안 고쳐집니다. 대신 아무나는 못 바꾸도록 '가본 사람'으로 제한합니다.
--
--   · 주소를 넘기지 않으면 기존 주소 유지
-- ============================================================
create or replace function update_place_location(
  p_place_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_address text default null
) returns json as $$
declare
  v_user  uuid := auth.uid();
  v_owner uuid;
  v_name  text;
  v_addr  text;
  v_posts int := 0;
  v_mkts  int := 0;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;
  if p_lat is null or p_lng is null then raise exception '위치가 올바르지 않습니다'; end if;

  select created_by, place_name, address
    into v_owner, v_name, v_addr
    from places where id = p_place_id;

  if v_name is null then raise exception '가게를 찾을 수 없습니다'; end if;

  -- 등록자이거나, 이 가게에 제보를 올린 적이 있으면 수정 가능
  if v_owner is not null
     and v_owner <> v_user
     and not exists (
       select 1 from posts
        where user_id = v_user
          and (place_id = p_place_id or place_name = v_name)
     )
  then
    raise exception '이 가게에 제보를 올린 분만 위치를 수정할 수 있어요';
  end if;

  v_addr := coalesce(nullif(btrim(coalesce(p_address, '')), ''), v_addr);

  update places
     set latitude = p_lat, longitude = p_lng, address = v_addr
   where id = p_place_id;

  -- 연결된 제보 좌표·주소 동기화
  update posts
     set latitude = p_lat, longitude = p_lng, location = v_addr, place_name = v_name
   where place_id = p_place_id;
  get diagnostics v_posts = row_count;

  -- 이름으로만 연결된 옛 제보도 함께
  update posts
     set latitude = p_lat, longitude = p_lng, location = v_addr
   where place_id is null and place_name = v_name;

  -- 마켓 글도 함께
  update market_items
     set latitude = p_lat, longitude = p_lng, location = v_addr
   where place_name = v_name;
  get diagnostics v_mkts = row_count;

  return json_build_object(
    'place_name',   v_name,
    'address',      v_addr,
    'updated_posts',   v_posts,
    'updated_markets', v_mkts
  );
end;
$$ language plpgsql security definer;


-- ============================================================
--  참고: SQL로 바로 고치고 싶을 때
--
--   select id, place_name, address, latitude, longitude
--     from places order by place_name;
--
--   update places
--      set latitude = 37.5000, longitude = 126.9400
--    where id = '고칠-가게-id';
--
--   -- 그 다음 제보까지 맞추려면 SUPABASE_PLACE_RESYNC.sql 의 2번을 다시 실행
-- ============================================================
