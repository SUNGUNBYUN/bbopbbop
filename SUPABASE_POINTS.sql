-- ============================================================
--  뽑뽑 포인트 제도 — Phase 1
--  (Supabase SQL Editor에 붙여넣고 실행)
--
--  ⚠️ 핵심 원칙:
--   - 포인트 적립/차감은 '서버 함수(SECURITY DEFINER)'로만 처리한다.
--   - 클라이언트가 point_balance를 직접 UPDATE 못 하도록 RLS로 막는다.
--   - 모든 변동은 points_ledger에 기록(append-only)한다.
--  이 스크립트는 여러 번 실행해도 안전하다.
-- ============================================================


-- ────────────────────────────────────────────────
-- 1. 프로필 테이블 (포인트 잔액 보관)
--    auth.users 1:1. 없으면 만들고, 있으면 컬럼만 보강.
-- ────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  point_balance int not null default 0,
  created_at timestamptz default now()
);

alter table profiles add column if not exists point_balance int not null default 0;

alter table profiles enable row level security;

-- 프로필은 누구나 조회 가능(닉네임·포인트 노출), 수정은 서버 함수로만.
drop policy if exists "profiles 조회 공개" on profiles;
create policy "profiles 조회 공개" on profiles for select using (true);

-- 본인 프로필 최초 생성만 허용(닉네임 등). point_balance는 아래 트리거로 0 고정.
drop policy if exists "profiles 본인 생성" on profiles;
create policy "profiles 본인 생성" on profiles for insert with check (auth.uid() = id);

-- ⚠️ UPDATE 정책을 '일부러' 만들지 않는다.
--    → 클라이언트는 point_balance를 직접 못 바꾼다.
--    → 오직 아래 SECURITY DEFINER 함수(award/spend)만 잔액을 바꾼다.

-- 신규 유저 가입 시 프로필 자동 생성
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data->>'nickname', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 기존 유저들 프로필 백필(이미 가입한 사람들)
insert into profiles (id, nickname)
select u.id, coalesce(u.raw_user_meta_data->>'nickname', u.email)
from auth.users u
on conflict (id) do nothing;


-- ────────────────────────────────────────────────
-- 2. 포인트 원장 (모든 적립/차감 이력)
-- ────────────────────────────────────────────────
create table if not exists points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  amount int not null,                 -- +적립 / -차감
  reason text not null,                -- 'place_create'|'report'|'reverify'|'feed'|'spend_bump' ...
  ref_type text,                       -- 'post'|'market'|'place' ...
  ref_id text,
  created_at timestamptz default now()
);
create index if not exists idx_ledger_user_time on points_ledger(user_id, created_at desc);
create index if not exists idx_ledger_reason on points_ledger(user_id, reason, created_at desc);

alter table points_ledger enable row level security;

drop policy if exists "ledger 본인만 조회" on points_ledger;
create policy "ledger 본인만 조회" on points_ledger for select using (auth.uid() = user_id);
-- INSERT 정책 없음 → 클라이언트 직접 삽입 불가. 함수로만.


-- ────────────────────────────────────────────────
-- 3. 적립 정책 상수 (일일 상한/쿨다운)
--    코드 안에 하드코딩. 필요하면 여기 값만 조정.
-- ────────────────────────────────────────────────
-- 정책:
--   place_create : 100p  (하루 무제한이지만 중복검사 통과분만)
--   report       :  30p  (하루 상한 없음, 하지만 daily cap에 걸림)
--   reverify     :  10p  (같은 ref 24h 쿨다운)
--   feed         :   5p  (하루 3건 = 15p 상한)
--   일일 총 획득 상한 : 200p


-- ────────────────────────────────────────────────
-- 4. 포인트 적립 함수 (SECURITY DEFINER)
--    - 호출자는 auth.uid() 본인에게만 적립 가능
--    - 일일 상한/쿨다운/피드 건수 제한을 서버에서 강제
--    - 반환: 실제 적립된 포인트(제한에 걸리면 0)
-- ────────────────────────────────────────────────
create or replace function award_points(
  p_reason text,
  p_ref_type text default null,
  p_ref_id text default null
)
returns int as $$
declare
  v_user uuid := auth.uid();
  v_amount int;
  v_daily_total int;
  v_today_start timestamptz := date_trunc('day', now());
  v_feed_count int;
  v_recent int;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다';
  end if;

  -- 사유별 기본 포인트
  v_amount := case p_reason
    when 'place_create' then 100
    when 'report'       then 30
    when 'reverify'     then 10
    when 'feed'         then 5
    else 0
  end;

  if v_amount = 0 then
    return 0; -- 알 수 없는 사유 → 무지급
  end if;

  -- (a) 재인증 쿨다운: 같은 ref 24h 내 재지급 방지
  if p_reason = 'reverify' and p_ref_id is not null then
    select count(*) into v_recent
    from points_ledger
    where user_id = v_user and reason = 'reverify'
      and ref_id = p_ref_id and created_at > now() - interval '24 hours';
    if v_recent > 0 then
      return 0;
    end if;
  end if;

  -- (b) 피드: 하루 3건까지만 지급
  if p_reason = 'feed' then
    select count(*) into v_feed_count
    from points_ledger
    where user_id = v_user and reason = 'feed' and created_at >= v_today_start;
    if v_feed_count >= 3 then
      return 0;
    end if;
  end if;

  -- (c) 같은 ref 중복 적립 방지(place_create/report는 대상당 1회)
  if p_reason in ('place_create', 'report') and p_ref_id is not null then
    select count(*) into v_recent
    from points_ledger
    where user_id = v_user and reason = p_reason and ref_id = p_ref_id;
    if v_recent > 0 then
      return 0;
    end if;
  end if;

  -- (d) 일일 총 획득 상한 200p
  select coalesce(sum(amount), 0) into v_daily_total
  from points_ledger
  where user_id = v_user and amount > 0 and created_at >= v_today_start;
  if v_daily_total + v_amount > 200 then
    v_amount := greatest(0, 200 - v_daily_total);
  end if;

  if v_amount = 0 then
    return 0;
  end if;

  -- 기록 + 잔액 반영
  insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
    values (v_user, v_amount, p_reason, p_ref_type, p_ref_id);
  update profiles set point_balance = point_balance + v_amount where id = v_user;

  return v_amount;
end;
$$ language plpgsql security definer;


-- ────────────────────────────────────────────────
-- 5. 포인트 차감 함수 (SECURITY DEFINER)
--    - 잔액 부족 시 예외
--    - 결제수단과 분리: 이 함수는 '포인트 차감'만 담당.
--      (나중에 현금결제를 얹을 땐 이 함수를 호출 안 하고 별도 처리)
-- ────────────────────────────────────────────────
create or replace function spend_points(
  p_amount int,
  p_reason text,
  p_ref_type text default null,
  p_ref_id text default null
)
returns int as $$
declare
  v_user uuid := auth.uid();
  v_balance int;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다';
  end if;
  if p_amount <= 0 then
    raise exception '차감 포인트가 올바르지 않습니다';
  end if;

  select point_balance into v_balance from profiles where id = v_user for update;
  if v_balance is null or v_balance < p_amount then
    raise exception '포인트가 부족합니다';
  end if;

  insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
    values (v_user, -p_amount, p_reason, p_ref_type, p_ref_id);
  update profiles set point_balance = point_balance - p_amount where id = v_user;

  return v_balance - p_amount; -- 남은 잔액
end;
$$ language plpgsql security definer;


-- ────────────────────────────────────────────────
-- 6. 마켓 끌어올리기: bumped_at 컬럼
--    정렬 기준을 created_at → coalesce(bumped_at, created_at)로.
-- ────────────────────────────────────────────────
alter table market_items add column if not exists bumped_at timestamptz;

-- 끌어올리기 함수: 포인트 차감 + bumped_at 갱신을 한 트랜잭션으로
create or replace function bump_market_item(p_item_id uuid, p_cost int)
returns timestamptz as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_last timestamptz;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다';
  end if;

  select user_id, bumped_at into v_owner, v_last
  from market_items where id = p_item_id;

  if v_owner is null then
    raise exception '상품을 찾을 수 없습니다';
  end if;
  if v_owner <> v_user then
    raise exception '본인 상품만 끌어올릴 수 있습니다';
  end if;

  -- 끌어올리기 쿨다운: 마지막 끌어올림/등록 후 1시간
  if v_last is not null and v_last > now() - interval '1 hour' then
    raise exception '아직 끌어올릴 수 없어요 (1시간에 한 번)';
  end if;

  -- 포인트 차감(부족하면 여기서 예외 발생 → 롤백)
  perform spend_points(p_cost, 'spend_bump', 'market', p_item_id::text);

  update market_items set bumped_at = now() where id = p_item_id;
  return now();
end;
$$ language plpgsql security definer;


-- ============================================================
--  완료!
--  이제 앱에서:
--   - 제보/재인증 시  award_points(...) 호출로 적립
--   - 마켓 끌어올리기 시 bump_market_item(...) 호출로 차감+정렬
--  잔액은 profiles.point_balance 에서 읽는다.
-- ============================================================
