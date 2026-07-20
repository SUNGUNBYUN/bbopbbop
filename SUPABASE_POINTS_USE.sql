-- ============================================================
--  포인트 활용 3종
--   1) 제보 현상금 (포인트를 걸고 제보 요청 → 채택하면 지급)
--   2) 등급·뱃지 (누적 적립 포인트 기준)
--   3) 마켓 노출 강화 (상단 고정 / 강조)
--
--  Supabase SQL Editor에서 실행. 여러 번 실행해도 안전.
-- ============================================================


-- ============================================================
--  0. 공용: 특정 유저에게 포인트 지급 (내부 전용)
--     현상금 지급·환불에 사용. 클라이언트가 직접 호출 못 하도록 권한 차단.
-- ============================================================
create or replace function credit_points(
  p_user uuid, p_amount int, p_reason text,
  p_ref_type text default null, p_ref_id text default null
) returns void as $$
begin
  if p_amount <= 0 then return; end if;
  insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
  values (p_user, p_amount, p_reason, p_ref_type, p_ref_id);
  update profiles set point_balance = point_balance + p_amount where id = p_user;
end;
$$ language plpgsql security definer;

-- 클라이언트에서 직접 호출 금지 (다른 함수 안에서만 사용)
revoke all on function credit_points(uuid, int, text, text, text) from public;
revoke all on function credit_points(uuid, int, text, text, text) from anon;
revoke all on function credit_points(uuid, int, text, text, text) from authenticated;


-- ============================================================
--  1. 등급 (누적 적립 포인트)
-- ============================================================
alter table profiles add column if not exists total_earned int not null default 0;

-- 기존 데이터 채워넣기 (적립분만 합산)
update profiles p
   set total_earned = coalesce((
     select sum(l.amount) from points_ledger l
      where l.user_id = p.id and l.amount > 0
   ), 0);

-- 앞으로는 적립될 때마다 자동 누적
create or replace function trg_add_total_earned() returns trigger as $$
begin
  if new.amount > 0 then
    update profiles set total_earned = total_earned + new.amount where id = new.user_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists points_ledger_total_earned on points_ledger;
create trigger points_ledger_total_earned
  after insert on points_ledger
  for each row execute function trg_add_total_earned();


-- ============================================================
--  2. 마켓 노출 강화
-- ============================================================
alter table market_items add column if not exists pinned_until    timestamptz;
alter table market_items add column if not exists highlight_until timestamptz;

-- 상단 고정 / 강조 구매
create or replace function boost_market_item(p_item_id uuid, p_kind text, p_cost int)
returns timestamptz as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_until timestamptz;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;
  if p_kind not in ('pin', 'highlight') then raise exception '알 수 없는 옵션입니다'; end if;

  select user_id into v_owner from market_items where id = p_item_id;
  if v_owner is null then raise exception '상품을 찾을 수 없습니다'; end if;
  if v_owner <> v_user then raise exception '본인 상품만 설정할 수 있습니다'; end if;

  -- 비용은 서버가 결정 (클라이언트 값 신뢰하지 않음)
  if p_kind = 'pin' then
    if p_cost <> 100 then raise exception '가격이 올바르지 않습니다'; end if;
  else
    if p_cost <> 50 then raise exception '가격이 올바르지 않습니다'; end if;
  end if;

  perform spend_points(p_cost, 'spend_' || p_kind, 'market', p_item_id::text);

  v_until := now() + interval '24 hours';
  if p_kind = 'pin' then
    update market_items
       set pinned_until = greatest(coalesce(pinned_until, now()), now()) + interval '24 hours'
     where id = p_item_id
     returning pinned_until into v_until;
  else
    update market_items
       set highlight_until = greatest(coalesce(highlight_until, now()), now()) + interval '24 hours'
     where id = p_item_id
     returning highlight_until into v_until;
  end if;

  return v_until;
end;
$$ language plpgsql security definer;


-- ============================================================
--  3. 제보 현상금
-- ============================================================
create table if not exists bounties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text,
  title text not null,
  description text,
  place_name text,
  location text,
  latitude double precision,
  longitude double precision,
  reward int not null check (reward > 0),
  status text not null default 'open',      -- open | resolved | canceled | expired
  winner_user_id uuid references auth.users(id) on delete set null,
  winner_answer_id uuid,
  answer_count int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create index if not exists bounties_status_idx on bounties(status, created_at desc);

create table if not exists bounty_answers (
  id uuid primary key default gen_random_uuid(),
  bounty_id uuid not null references bounties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text,
  post_id uuid references posts(id) on delete set null,
  comment text,
  created_at timestamptz default now(),
  unique (bounty_id, user_id)               -- 한 현상금에 한 사람당 한 번
);

create index if not exists bounty_answers_bounty_idx on bounty_answers(bounty_id, created_at);


-- ---------- 현상금 등록 (포인트 선차감 = 에스크로) ----------
create or replace function create_bounty(
  p_title text,
  p_description text default null,
  p_place_name text default null,
  p_location text default null,
  p_lat double precision default null,
  p_lng double precision default null,
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

  -- 동시에 너무 많이 열지 못하게 (스팸 방지)
  select count(*) into v_open from bounties where user_id = v_user and status = 'open';
  if v_open >= 5 then raise exception '진행 중인 현상금은 최대 5개까지예요'; end if;

  select nickname into v_nick from profiles where id = v_user;

  v_id := gen_random_uuid();

  -- 포인트를 먼저 차감해서 묶어둠 (채택 시 지급 / 취소·만료 시 환불)
  perform spend_points(p_reward, 'spend_bounty', 'bounty', v_id::text);

  insert into bounties(id, user_id, nickname, title, description,
                       place_name, location, latitude, longitude,
                       reward, expires_at)
  values (v_id, v_user, v_nick, trim(p_title), nullif(trim(coalesce(p_description,'')), ''),
          p_place_name, p_location, p_lat, p_lng,
          p_reward, now() + (p_days || ' days')::interval);

  return v_id;
end;
$$ language plpgsql security definer;


-- ---------- 현상금에 제보 답변 달기 ----------
create or replace function answer_bounty(
  p_bounty_id uuid,
  p_post_id uuid default null,
  p_comment text default null
) returns uuid as $$
declare
  v_user uuid := auth.uid();
  v_nick text;
  v_owner uuid;
  v_status text;
  v_expires timestamptz;
  v_id uuid;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;

  select user_id, status, expires_at into v_owner, v_status, v_expires
    from bounties where id = p_bounty_id;

  if v_owner is null then raise exception '현상금을 찾을 수 없습니다'; end if;
  if v_owner = v_user then raise exception '내가 건 현상금에는 답변할 수 없어요'; end if;
  if v_status <> 'open' then raise exception '이미 종료된 현상금이에요'; end if;
  if v_expires < now() then raise exception '기간이 지난 현상금이에요'; end if;
  if p_post_id is null and coalesce(trim(p_comment), '') = '' then
    raise exception '제보를 연결하거나 내용을 적어주세요';
  end if;

  select nickname into v_nick from profiles where id = v_user;

  insert into bounty_answers(bounty_id, user_id, nickname, post_id, comment)
  values (p_bounty_id, v_user, v_nick, p_post_id, nullif(trim(coalesce(p_comment,'')), ''))
  returning id into v_id;

  update bounties set answer_count = answer_count + 1 where id = p_bounty_id;

  return v_id;
end;
$$ language plpgsql security definer;


-- ---------- 채택 (현상금 지급) ----------
create or replace function resolve_bounty(p_bounty_id uuid, p_answer_id uuid)
returns int as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_status text;
  v_reward int;
  v_winner uuid;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;

  select user_id, status, reward into v_owner, v_status, v_reward
    from bounties where id = p_bounty_id for update;

  if v_owner is null then raise exception '현상금을 찾을 수 없습니다'; end if;
  if v_owner <> v_user then raise exception '내가 건 현상금만 채택할 수 있어요'; end if;
  if v_status <> 'open' then raise exception '이미 종료된 현상금이에요'; end if;

  select user_id into v_winner from bounty_answers
   where id = p_answer_id and bounty_id = p_bounty_id;
  if v_winner is null then raise exception '답변을 찾을 수 없습니다'; end if;

  -- 묶어둔 포인트를 답변자에게 지급
  perform credit_points(v_winner, v_reward, 'bounty_reward', 'bounty', p_bounty_id::text);

  update bounties
     set status = 'resolved',
         winner_user_id = v_winner,
         winner_answer_id = p_answer_id,
         resolved_at = now()
   where id = p_bounty_id;

  return v_reward;
end;
$$ language plpgsql security definer;


-- ---------- 취소 (환불) ----------
create or replace function cancel_bounty(p_bounty_id uuid)
returns int as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_status text;
  v_reward int;
  v_answers int;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;

  select user_id, status, reward, answer_count
    into v_owner, v_status, v_reward, v_answers
    from bounties where id = p_bounty_id for update;

  if v_owner is null then raise exception '현상금을 찾을 수 없습니다'; end if;
  if v_owner <> v_user then raise exception '내가 건 현상금만 취소할 수 있어요'; end if;
  if v_status <> 'open' then raise exception '이미 종료된 현상금이에요'; end if;
  if v_answers > 0 then raise exception '답변이 달린 현상금은 취소할 수 없어요. 채택해주세요'; end if;

  perform credit_points(v_user, v_reward, 'bounty_refund', 'bounty', p_bounty_id::text);
  update bounties set status = 'canceled', resolved_at = now() where id = p_bounty_id;

  return v_reward;
end;
$$ language plpgsql security definer;


-- ---------- 기간 지난 현상금 자동 환불 ----------
--  앱을 열 때 가볍게 호출해도 안전 (처리할 게 없으면 아무 일도 안 함)
create or replace function expire_bounties()
returns int as $$
declare
  r record;
  v_count int := 0;
begin
  for r in
    select id, user_id, reward from bounties
     where status = 'open' and expires_at < now()
     for update skip locked
  loop
    perform credit_points(r.user_id, r.reward, 'bounty_refund', 'bounty', r.id::text);
    update bounties set status = 'expired', resolved_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$ language plpgsql security definer;


-- ============================================================
--  4. RLS (조회는 공개, 쓰기는 위 함수로만)
-- ============================================================
alter table bounties enable row level security;
drop policy if exists "현상금 조회 공개" on bounties;
create policy "현상금 조회 공개" on bounties for select using (true);

alter table bounty_answers enable row level security;
drop policy if exists "현상금 답변 조회 공개" on bounty_answers;
create policy "현상금 답변 조회 공개" on bounty_answers for select using (true);

-- 답변 삭제는 본인만 (오답 정리용)
drop policy if exists "현상금 답변 본인 삭제" on bounty_answers;
create policy "현상금 답변 본인 삭제" on bounty_answers for delete using (auth.uid() = user_id);


-- ============================================================
--  완료!
--   · 현상금 최소 10P / 최대 5000P, 진행 중 5개까지
--   · 상단 고정 100P, 강조 50P (각 24시간)
--   · 등급은 누적 적립 포인트 기준 (쓴다고 내려가지 않아요)
-- ============================================================
