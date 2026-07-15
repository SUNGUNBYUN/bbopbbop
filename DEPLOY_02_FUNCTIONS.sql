-- ============================================================
--  뽑뽑 운영 배포 [2/3] — 함수 + 트리거
--  DEPLOY_01_TABLES.sql 실행 후 이걸 실행.
-- ============================================================

-- 신규 유저 → 프로필 자동 생성
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data->>'nickname', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 포인트 적립(피드/일반) — 상한/쿨다운 포함
create or replace function award_points(p_reason text, p_ref_type text default null, p_ref_id text default null)
returns int as $$
declare
  v_user uuid := auth.uid();
  v_amount int;
  v_daily_total int;
  v_today_start timestamptz := date_trunc('day', now());
  v_feed_count int;
  v_recent int;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;
  v_amount := case p_reason
    when 'place_create' then 100
    when 'report' then 30
    when 'reverify' then 10
    when 'feed' then 5
    else 0 end;
  if v_amount = 0 then return 0; end if;
  if p_reason = 'reverify' and p_ref_id is not null then
    select count(*) into v_recent from points_ledger
    where user_id = v_user and reason = 'reverify' and ref_id = p_ref_id and created_at > now() - interval '24 hours';
    if v_recent > 0 then return 0; end if;
  end if;
  if p_reason = 'feed' then
    select count(*) into v_feed_count from points_ledger
    where user_id = v_user and reason = 'feed' and created_at >= v_today_start;
    if v_feed_count >= 3 then return 0; end if;
  end if;
  select coalesce(sum(amount),0) into v_daily_total from points_ledger
    where user_id = v_user and amount > 0 and created_at >= v_today_start;
  if v_daily_total + v_amount > 200 then v_amount := greatest(0, 200 - v_daily_total); end if;
  if v_amount = 0 then return 0; end if;
  insert into points_ledger(user_id, amount, reason, ref_type, ref_id) values (v_user, v_amount, p_reason, p_ref_type, p_ref_id);
  update profiles set point_balance = point_balance + v_amount where id = v_user;
  return v_amount;
end;
$$ language plpgsql security definer;

-- 포인트 차감
create or replace function spend_points(p_amount int, p_reason text, p_ref_type text default null, p_ref_id text default null)
returns int as $$
declare v_user uuid := auth.uid(); v_balance int;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;
  if p_amount <= 0 then raise exception '차감 포인트가 올바르지 않습니다'; end if;
  select point_balance into v_balance from profiles where id = v_user for update;
  if v_balance is null or v_balance < p_amount then raise exception '포인트가 부족합니다'; end if;
  insert into points_ledger(user_id, amount, reason, ref_type, ref_id) values (v_user, -p_amount, p_reason, p_ref_type, p_ref_id);
  update profiles set point_balance = point_balance - p_amount where id = v_user;
  return v_balance - p_amount;
end;
$$ language plpgsql security definer;

-- 마켓 끌어올리기
create or replace function bump_market_item(p_item_id uuid, p_cost int)
returns timestamptz as $$
declare v_user uuid := auth.uid(); v_owner uuid; v_last timestamptz;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;
  select user_id, bumped_at into v_owner, v_last from market_items where id = p_item_id;
  if v_owner is null then raise exception '상품을 찾을 수 없습니다'; end if;
  if v_owner <> v_user then raise exception '본인 상품만 끌어올릴 수 있습니다'; end if;
  if v_last is not null and v_last > now() - interval '1 hour' then raise exception '아직 끌어올릴 수 없어요 (1시간에 한 번)'; end if;
  perform spend_points(p_cost, 'spend_bump', 'market', p_item_id::text);
  update market_items set bumped_at = now() where id = p_item_id;
  return now();
end;
$$ language plpgsql security definer;

-- 근처 가게 후보
create or replace function find_nearby_places(p_lat double precision, p_lng double precision, p_kakao_id text default null)
returns table (id uuid, place_name text, address text, latitude double precision, longitude double precision, product_count int, distance_m double precision) as $$
  select p.id, p.place_name, p.address, p.latitude, p.longitude, p.product_count,
    (6371000 * acos(least(1.0, greatest(-1.0,
      cos(radians(p_lat))*cos(radians(p.latitude))*cos(radians(p.longitude)-radians(p_lng)) +
      sin(radians(p_lat))*sin(radians(p.latitude)))))) as distance_m
  from places p
  where (p_kakao_id is not null and p.kakao_place_id = p_kakao_id)
     or (p.latitude between p_lat - 0.0006 and p_lat + 0.0006 and p.longitude between p_lng - 0.0006 and p_lng + 0.0006)
  order by distance_m asc limit 5;
$$ language sql stable;

-- 가게 확보 (즉시 지급 0 — 재인증 시 확정)
create or replace function get_or_create_place(p_place_name text, p_address text, p_lat double precision, p_lng double precision, p_kakao_id text default null, p_existing_place_id uuid default null)
returns json as $$
declare v_user uuid := auth.uid(); v_place_id uuid; v_is_new boolean := false;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;
  if p_existing_place_id is not null then
    v_place_id := p_existing_place_id;
  else
    insert into places(place_name, address, latitude, longitude, kakao_place_id, created_by, created_nickname)
      values (p_place_name, p_address, p_lat, p_lng, p_kakao_id, v_user, (select nickname from profiles where id = v_user))
      returning id into v_place_id;
    v_is_new := true;
  end if;
  return json_build_object('place_id', v_place_id, 'place_reward', 0, 'is_new_place', v_is_new);
end;
$$ language plpgsql security definer;

-- 상품 제보 (즉시 0 + 중복 판정)
create or replace function award_product_report(p_post_id uuid, p_place_id uuid, p_title text, p_force boolean default false)
returns json as $$
declare v_user uuid := auth.uid(); v_key text; v_dup int; v_is_dup boolean := false;
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
  else v_dup := 0; end if;
  v_is_dup := (v_dup > 0);
  if p_place_id is not null then
    update places set product_count = (select count(*) from posts where place_id = p_place_id) where id = p_place_id;
  end if;
  if v_is_dup then update posts set reward_confirmed = true where id = p_post_id; end if;
  return json_build_object('post_reward', 0, 'is_dup', v_is_dup);
end;
$$ language plpgsql security definer;

-- 재인증
create or replace function verify_post(p_post_id uuid)
returns json as $$
declare v_user uuid := auth.uid(); v_owner uuid; v_confirmed boolean; v_place uuid;
  v_recent int; v_my int := 0; v_owner_r int := 0; v_place_owner uuid; v_place_confirmed boolean; v_place_r int := 0;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;
  select user_id, reward_confirmed, place_id into v_owner, v_confirmed, v_place from posts where id = p_post_id;
  if v_owner is null then raise exception '제보를 찾을 수 없습니다'; end if;
  if v_owner = v_user then raise exception '본인 제보는 확인할 수 없어요'; end if;
  select count(*) into v_recent from points_ledger where user_id = v_user and reason = 'reverify' and ref_id = p_post_id::text;
  if v_recent = 0 then
    update posts set verify_count = coalesce(verify_count,0)+1, last_verified_at = now() where id = p_post_id;
    insert into points_ledger(user_id, amount, reason, ref_type, ref_id) values (v_user, 10, 'reverify', 'post', p_post_id::text);
    update profiles set point_balance = point_balance + 10 where id = v_user;
    v_my := 10;
  else
    update posts set last_verified_at = now() where id = p_post_id;
  end if;
  if not coalesce(v_confirmed,false) then
    update posts set reward_confirmed = true where id = p_post_id;
    insert into points_ledger(user_id, amount, reason, ref_type, ref_id) values (v_owner, 50, 'product_confirmed', 'post', p_post_id::text);
    update profiles set point_balance = point_balance + 50 where id = v_owner;
    v_owner_r := 50;
  end if;
  if v_place is not null then
    select created_by, reward_confirmed into v_place_owner, v_place_confirmed from places where id = v_place;
    if v_place_owner is not null and not coalesce(v_place_confirmed,false) and v_place_owner <> v_user then
      update places set reward_confirmed = true, confirm_count = coalesce(confirm_count,0)+1 where id = v_place;
      insert into points_ledger(user_id, amount, reason, ref_type, ref_id) values (v_place_owner, 100, 'place_confirmed', 'place', v_place::text);
      update profiles set point_balance = point_balance + 100 where id = v_place_owner;
      v_place_r := 100;
    end if;
  end if;
  return json_build_object('my_reward', v_my, 'owner_confirmed', v_owner_r, 'place_confirmed', v_place_r,
    'verify_count', (select verify_count from posts where id = p_post_id), 'already', (v_recent > 0));
end;
$$ language plpgsql security definer;

-- 가게 상품 목록 / 유사 상품(사진)
create or replace function place_products(p_place_id uuid)
returns table (id uuid, title text, image_url text, created_at timestamptz) as $$
  select id, title, image_url, created_at from posts
  where place_id = p_place_id and coalesce(hidden,false) = false
  order by created_at desc limit 20;
$$ language sql stable;

create or replace function similar_products(p_place_id uuid, p_title text)
returns table (id uuid, title text, image_url text, created_at timestamptz) as $$
declare v_key text;
begin
  v_key := lower(regexp_replace(coalesce(p_title,''), '[^가-힣a-zA-Z0-9]', '', 'g'));
  if p_place_id is null or length(v_key) < 2 then return; end if;
  return query
    select p.id, p.title, p.image_url, p.created_at from posts p
    where p.place_id = p_place_id and coalesce(p.hidden,false) = false
      and p.product_key is not null and length(p.product_key) >= 2
      and (p.product_key = v_key or p.product_key like '%'||v_key||'%' or v_key like '%'||p.product_key||'%' or left(p.product_key,2) = left(v_key,2))
    order by p.created_at desc limit 10;
end;
$$ language plpgsql stable;

-- 카운트 안전 증감
create or replace function increment_view_count(post_id uuid)
returns void as $$ update posts set view_count = coalesce(view_count,0)+1 where id = post_id; $$ language sql security definer;
create or replace function increment_market_view(item_id uuid)
returns void as $$ update market_items set view_count = coalesce(view_count,0)+1 where id = item_id; $$ language sql security definer;

create or replace function sync_post_like_count(p_post_id uuid) returns int as $$
declare c int; begin select count(*) into c from likes where post_id = p_post_id; update posts set like_count = c where id = p_post_id; return c; end; $$ language plpgsql security definer;
create or replace function sync_post_comment_count(p_post_id uuid) returns int as $$
declare c int; begin select count(*) into c from comments where post_id = p_post_id; update posts set comment_count = c where id = p_post_id; return c; end; $$ language plpgsql security definer;
create or replace function sync_market_like_count(p_item_id uuid) returns int as $$
declare c int; begin select count(*) into c from market_likes where item_id = p_item_id; update market_items set like_count = c where id = p_item_id; return c; end; $$ language plpgsql security definer;
create or replace function sync_feed_like_count(p_feed_id uuid) returns int as $$
declare c int; begin select count(*) into c from feed_likes where feed_id = p_feed_id; update feed_posts set like_count = c where id = p_feed_id; return c; end; $$ language plpgsql security definer;
create or replace function sync_feed_comment_count(p_feed_id uuid) returns int as $$
declare c int; begin select count(*) into c from feed_comments where feed_id = p_feed_id; update feed_posts set comment_count = c where id = p_feed_id; return c; end; $$ language plpgsql security definer;

-- 신고 누적 → 자동 숨김 + 관리자 큐
create or replace function auto_hide_on_reports()
returns trigger as $$
declare v_cnt int;
begin
  if new.target_type = 'post' then
    select count(distinct reporter_id) into v_cnt from reports where target_type = 'post' and target_id = new.target_id;
    if v_cnt >= 3 then update posts set hidden = true where id = new.target_id::uuid; end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_auto_hide on reports;
create trigger trg_auto_hide after insert on reports for each row execute function auto_hide_on_reports();

create or replace view admin_report_queue as
select p.id, p.title, p.nickname, p.hidden, p.created_at,
  count(distinct r.reporter_id) as report_count, array_agg(distinct r.reason) as reasons
from posts p join reports r on r.target_type = 'post' and r.target_id = p.id::text
group by p.id order by report_count desc, p.created_at desc;

-- ============================================================
--  [2/3] 완료 → DEPLOY_03_RLS_STORAGE.sql 실행
-- ============================================================
