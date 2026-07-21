-- ============================================================
--  마켓·피드·현상금도 가게(place_id)로 연결
--
--  왜:
--   지금까지 제보(posts)만 place_id로 제대로 연결돼 있고,
--   마켓·피드·현상금은 가게 '이름 문자열'만 들고 있었습니다.
--   이름으로만 묶으면 표기가 조금만 달라도 다른 가게가 되고,
--   가게를 병합하거나 이름을 고칠 때 따라오지 못합니다.
--
--  Supabase SQL Editor에서 실행. 여러 번 실행해도 안전.
-- ============================================================


-- ============================================================
--  1. 컬럼 추가
-- ============================================================
alter table market_items add column if not exists place_id uuid references places(id) on delete set null;
alter table feed_posts  add column if not exists place_id uuid references places(id) on delete set null;
alter table bounties    add column if not exists place_id uuid references places(id) on delete set null;

create index if not exists market_items_place_idx on market_items(place_id);
create index if not exists feed_posts_place_idx   on feed_posts(place_id);
create index if not exists bounties_place_idx     on bounties(place_id);


-- ============================================================
--  2. 기존 데이터 백필 — 이름으로 찾아 연결
--     (띄어쓰기 무시하고 비교)
-- ============================================================
update market_items m
   set place_id = p.id
  from places p
 where m.place_id is null
   and m.place_name is not null
   and regexp_replace(m.place_name, '\s', '', 'g') = regexp_replace(p.place_name, '\s', '', 'g');

update feed_posts f
   set place_id = p.id
  from places p
 where f.place_id is null
   and f.place_name is not null
   and regexp_replace(f.place_name, '\s', '', 'g') = regexp_replace(p.place_name, '\s', '', 'g');

update bounties b
   set place_id = p.id
  from places p
 where b.place_id is null
   and b.place_name is not null
   and regexp_replace(b.place_name, '\s', '', 'g') = regexp_replace(p.place_name, '\s', '', 'g');


-- ============================================================
--  3. 병합 시 세 테이블도 함께 이동
--     (지금까지는 이름으로만 맞춰서 표기가 어긋나면 놓쳤습니다)
-- ============================================================
create or replace function merge_places(p_keep uuid, p_drop uuid)
returns json as $$
declare
  v_name text;
  v_addr text;
  v_lat  double precision;
  v_lng  double precision;
  v_drop_name text;
  v_moved   int := 0;
  v_synced  int := 0;
  v_legacy  int := 0;
  v_market  int := 0;
  v_feed    int := 0;
  v_bounty  int := 0;
begin
  if p_keep = p_drop then
    raise exception '같은 가게끼리는 합칠 수 없습니다';
  end if;

  select place_name, address, latitude, longitude
    into v_name, v_addr, v_lat, v_lng
    from places where id = p_keep;
  if v_name is null then raise exception '남길 가게를 찾을 수 없습니다'; end if;

  select place_name into v_drop_name from places where id = p_drop;
  if v_drop_name is null then raise exception '합칠 가게를 찾을 수 없습니다'; end if;

  -- 제보 이동
  update posts
     set place_id = p_keep, place_name = v_name, location = v_addr,
         latitude = v_lat, longitude = v_lng
   where place_id = p_drop;
  get diagnostics v_moved = row_count;

  -- 남는 가게 쪽 제보도 표기 통일
  update posts
     set place_name = v_name, location = v_addr, latitude = v_lat, longitude = v_lng
   where place_id = p_keep
     and (coalesce(place_name,'') is distinct from v_name
       or coalesce(location,'')   is distinct from coalesce(v_addr,''));
  get diagnostics v_synced = row_count;

  -- place_id 없이 이름만 남은 옛 제보
  update posts
     set place_id = p_keep, place_name = v_name, location = v_addr,
         latitude = v_lat, longitude = v_lng
   where place_id is null
     and place_name in (v_drop_name, v_name);
  get diagnostics v_legacy = row_count;

  -- 마켓
  update market_items
     set place_id = p_keep, place_name = v_name, location = v_addr,
         latitude = v_lat, longitude = v_lng
   where place_id = p_drop
      or (place_id is null and place_name in (v_drop_name, v_name));
  get diagnostics v_market = row_count;

  -- 피드
  update feed_posts
     set place_id = p_keep, place_name = v_name, location = v_addr,
         latitude = v_lat, longitude = v_lng
   where place_id = p_drop
      or (place_id is null and place_name in (v_drop_name, v_name));
  get diagnostics v_feed = row_count;

  -- 현상금
  update bounties
     set place_id = p_keep, place_name = v_name, location = v_addr,
         latitude = v_lat, longitude = v_lng
   where place_id = p_drop
      or (place_id is null and place_name in (v_drop_name, v_name));
  get diagnostics v_bounty = row_count;

  update places
     set product_count = (select count(*) from posts where place_id = p_keep)
   where id = p_keep;

  delete from places where id = p_drop;

  return json_build_object(
    'kept_name',      v_name,
    'merged_name',    v_drop_name,
    'moved_posts',    v_moved,
    'synced_posts',   v_synced,
    'renamed_posts',  v_legacy,
    'moved_markets',  v_market,
    'moved_feeds',    v_feed,
    'moved_bounties', v_bounty
  );
end;
$$ language plpgsql security definer;

revoke all on function merge_places(uuid, uuid) from public;
revoke all on function merge_places(uuid, uuid) from anon;
revoke all on function merge_places(uuid, uuid) from authenticated;


-- ============================================================
--  4. 위치 수정 시에도 세 테이블 함께 갱신
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
  v_feeds int := 0;
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

  update posts
     set latitude = p_lat, longitude = p_lng, location = v_addr, place_name = v_name
   where place_id = p_place_id
      or (place_id is null and place_name = v_name);
  get diagnostics v_posts = row_count;

  update market_items
     set latitude = p_lat, longitude = p_lng, location = v_addr, place_name = v_name
   where place_id = p_place_id
      or (place_id is null and place_name = v_name);
  get diagnostics v_mkts = row_count;

  update feed_posts
     set latitude = p_lat, longitude = p_lng, location = v_addr, place_name = v_name
   where place_id = p_place_id
      or (place_id is null and place_name = v_name);
  get diagnostics v_feeds = row_count;

  update bounties
     set latitude = p_lat, longitude = p_lng, location = v_addr, place_name = v_name
   where place_id = p_place_id
      or (place_id is null and place_name = v_name);

  return json_build_object(
    'place_name',      v_name,
    'address',         v_addr,
    'updated_posts',   v_posts,
    'updated_markets', v_mkts,
    'updated_feeds',   v_feeds
  );
end;
$$ language plpgsql security definer;


-- ============================================================
--  5. 현상금 등록 시 place_id 받기
-- ============================================================
create or replace function create_bounty(
  p_title text,
  p_description text default null,
  p_place_name text default null,
  p_location text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_place_id uuid default null,
  p_reward int default 50,
  p_days int default 7
) returns uuid as $$
declare
  v_user uuid := auth.uid();
  v_nick text;
  v_id uuid;
  v_open int;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception '무엇을 찾는지 입력해주세요'; end if;
  if p_reward < 10 then raise exception '현상금은 최소 10P부터예요'; end if;
  if p_reward > 5000 then raise exception '현상금은 최대 5000P까지예요'; end if;
  if p_days < 1 or p_days > 30 then raise exception '기간은 1~30일로 정해주세요'; end if;

  select count(*) into v_open from bounties where user_id = v_user and status = 'open';
  if v_open >= 5 then raise exception '진행 중인 현상금은 최대 5개까지예요'; end if;

  select nickname into v_nick from profiles where id = v_user;

  v_id := gen_random_uuid();

  perform spend_points(p_reward, 'spend_bounty', 'bounty', v_id::text);

  insert into bounties(id, user_id, nickname, title, description,
                       place_name, location, latitude, longitude, place_id,
                       reward, expires_at)
  values (v_id, v_user, v_nick, trim(p_title), nullif(trim(coalesce(p_description,'')), ''),
          p_place_name, p_location, p_lat, p_lng, p_place_id,
          p_reward, now() + (p_days || ' days')::interval);

  return v_id;
end;
$$ language plpgsql security definer;

-- 인자가 늘었으므로 예전 시그니처는 제거 (있으면)
drop function if exists create_bounty(text, text, text, text, double precision, double precision, int, int);


-- ============================================================
--  완료!
--   이제 가게를 병합하거나 위치를 고치면
--   제보뿐 아니라 마켓·피드·현상금까지 함께 따라옵니다.
-- ============================================================
