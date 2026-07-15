-- ============================================================
--  뽑뽑 포인트 제도 — Phase 2
--  조건부 지급(어뷰징 방지) + 중복 감지 + 신고 큐
--  ⚠️ SUPABASE_POINTS.sql(Phase 1)을 먼저 실행한 뒤 이걸 실행하세요.
--  여러 번 실행해도 안전합니다.
-- ============================================================


-- ────────────────────────────────────────────────
-- 1. posts에 검증/신선도 컬럼 추가
--    verify_count : 다른 유저가 "진짜 있어요" 눌러준 횟수
--    last_verified_at : 마지막 확인 시각(신선도용)
--    reward_confirmed : 조건부 포인트가 확정 지급됐는지
--    hidden : 신고 누적으로 자동 숨김됐는지
-- ────────────────────────────────────────────────
alter table posts add column if not exists verify_count int default 0;
alter table posts add column if not exists last_verified_at timestamptz default now();
alter table posts add column if not exists reward_confirmed boolean default false;
alter table posts add column if not exists hidden boolean default false;
alter table posts add column if not exists place_id uuid;


-- ────────────────────────────────────────────────
-- 2. 가게(위치 단위) 테이블 — 중복 감지의 기준
-- ────────────────────────────────────────────────
create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  place_name text not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  kakao_place_id text,
  created_by uuid references auth.users(id) on delete set null,
  confirm_count int default 0,          -- 이 가게가 실재한다고 확인된 횟수
  created_at timestamptz default now()
);
-- ⚠️ 이미 존재하던 places 테이블에도 컬럼을 보강(create table if not exists는 컬럼을 안 채워줌)
alter table places add column if not exists place_name text;
alter table places add column if not exists address text;
alter table places add column if not exists latitude double precision;
alter table places add column if not exists longitude double precision;
alter table places add column if not exists kakao_place_id text;
alter table places add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table places add column if not exists confirm_count int default 0;
alter table places add column if not exists created_at timestamptz default now();

create index if not exists idx_places_lat on places(latitude);
create index if not exists idx_places_lng on places(longitude);
create index if not exists idx_places_kakao on places(kakao_place_id);

alter table places enable row level security;
drop policy if exists "places 조회 공개" on places;
create policy "places 조회 공개" on places for select using (true);
-- 등록은 아래 함수로만(직접 insert 금지) → 정책 안 만듦


-- ────────────────────────────────────────────────
-- 3. 중복 감지: 근처 같은 가게 후보 찾기
--    반경 약 50m + (있으면) kakao_place_id 우선
--    앱에서 등록 전에 호출해 "이 가게 아닌가요?" 후보를 띄운다.
-- ────────────────────────────────────────────────
create or replace function find_nearby_places(
  p_lat double precision,
  p_lng double precision,
  p_kakao_id text default null
)
returns table (
  id uuid, place_name text, address text,
  latitude double precision, longitude double precision,
  distance_m double precision
) as $$
  select p.id, p.place_name, p.address, p.latitude, p.longitude,
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
-- 4. 가게 등록(최초/보강) — 조건부 포인트
--    p_place_id 가 있으면 = 기존 가게 "보강"(중복 확인)
--    없으면 = 신규 가게 등록
--    ⚠️ 포인트는 여기서 '즉시 전액'을 주지 않는다.
--       신규: 즉시 10P + 재인증 시 확정 90P (합 100P)
--       보강: 즉시 5P (소액이라 바로 지급)
--    반환: json { place_id, immediate_points, is_new }
-- ────────────────────────────────────────────────
create or replace function register_place(
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
  v_immediate int;
  v_is_new boolean;
  v_dup int;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다';
  end if;

  if p_existing_place_id is not null then
    -- 보강(중복 확인): 소액 즉시 지급
    v_place_id := p_existing_place_id;
    v_is_new := false;

    -- 같은 가게 하루 1회만 보강 포인트
    select count(*) into v_dup from points_ledger
    where user_id = v_user and reason = 'place_confirm'
      and ref_id = v_place_id::text and created_at > now() - interval '24 hours';

    update places set confirm_count = confirm_count + 1 where id = v_place_id;

    if v_dup = 0 then
      insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
        values (v_user, 5, 'place_confirm', 'place', v_place_id::text);
      update profiles set point_balance = point_balance + 5 where id = v_user;
      v_immediate := 5;
    else
      v_immediate := 0;
    end if;
  else
    -- 신규 등록: 즉시 10P만(나머지 90P는 재인증 시 확정)
    insert into places(place_name, address, latitude, longitude, kakao_place_id, created_by)
      values (p_place_name, p_address, p_lat, p_lng, p_kakao_id, v_user)
      returning id into v_place_id;
    v_is_new := true;

    insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
      values (v_user, 10, 'place_create', 'place', v_place_id::text);
    update profiles set point_balance = point_balance + 10 where id = v_user;
    v_immediate := 10;
  end if;

  return json_build_object(
    'place_id', v_place_id,
    'immediate_points', v_immediate,
    'is_new', v_is_new
  );
end;
$$ language plpgsql security definer;


-- ────────────────────────────────────────────────
-- 5. 재인증 "진짜 있어요" — 커뮤니티 검수의 핵심
--    다른 유저가 누르면:
--      - 제보의 verify_count +1, last_verified_at 갱신(신선도 리셋)
--      - 눌러준 사람에게 +10P (같은 대상 24h 쿨다운, 본인 제보 제외)
--      - 제보가 아직 미확정이면 → 작성자에게 확정 90P 지급(1회)
--    이 구조 때문에 "아무도 확인 안 해주는 가짜 제보"는 큰 포인트를 못 받는다.
-- ────────────────────────────────────────────────
create or replace function verify_post(p_post_id uuid)
returns json as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_confirmed boolean;
  v_recent int;
  v_my_reward int := 0;
  v_owner_reward int := 0;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다';
  end if;

  select user_id, reward_confirmed into v_owner, v_confirmed
  from posts where id = p_post_id;
  if v_owner is null then
    raise exception '제보를 찾을 수 없습니다';
  end if;
  if v_owner = v_user then
    raise exception '본인 제보는 확인할 수 없어요';
  end if;

  -- 같은 제보 24h 쿨다운
  select count(*) into v_recent from points_ledger
  where user_id = v_user and reason = 'reverify'
    and ref_id = p_post_id::text and created_at > now() - interval '24 hours';

  -- 카운트/신선도는 쿨다운과 무관하게 갱신
  update posts
    set verify_count = coalesce(verify_count,0) + 1,
        last_verified_at = now()
    where id = p_post_id;

  -- 확인해준 사람 보상(쿨다운 통과 시)
  if v_recent = 0 then
    insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
      values (v_user, 10, 'reverify', 'post', p_post_id::text);
    update profiles set point_balance = point_balance + 10 where id = v_user;
    v_my_reward := 10;
  end if;

  -- 작성자 조건부 포인트 확정(최초 1회)
  if not coalesce(v_confirmed, false) then
    update posts set reward_confirmed = true where id = p_post_id;
    insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
      values (v_owner, 90, 'report_confirmed', 'post', p_post_id::text);
    update profiles set point_balance = point_balance + 90 where id = v_owner;
    v_owner_reward := 90;
  end if;

  return json_build_object('my_reward', v_my_reward, 'owner_confirmed', v_owner_reward);
end;
$$ language plpgsql security definer;


-- ────────────────────────────────────────────────
-- 6. 신고 누적 → 자동 숨김 + 관리자 큐
--    같은 대상 신고가 3회 이상이면 posts.hidden = true
--    (신고는 기존 reports 테이블 사용)
-- ────────────────────────────────────────────────
create or replace function auto_hide_on_reports()
returns trigger as $$
declare
  v_cnt int;
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
create trigger trg_auto_hide
  after insert on reports
  for each row execute function auto_hide_on_reports();

-- 관리자 검수 큐: 신고 있는 제보 + 신고 수 (관리자 화면에서 조회)
create or replace view admin_report_queue as
select
  p.id, p.title, p.nickname, p.hidden, p.created_at,
  count(distinct r.reporter_id) as report_count,
  array_agg(distinct r.reason) as reasons
from posts p
join reports r on r.target_type = 'post' and r.target_id = p.id::text
group by p.id
order by report_count desc, p.created_at desc;


-- ============================================================
--  완료! 이제:
--   - register_place(...)   : 최초/보강 등록 + 중복 감지 연동
--   - find_nearby_places(..): 등록 전 중복 후보 조회
--   - verify_post(...)      : "진짜 있어요" → 확정 지급 + 신선도 리셋
--   - 신고 3회 → 자동 숨김, admin_report_queue 로 검수
-- ============================================================
