-- ============================================================
--  조회수를 '본 사람 수'로 통일
--
--  문제:
--   · 마켓: 상세 열 때마다 +1 → 한 사람이 여러 번 봐도 계속 올라감
--   · 제보: 브라우저 세션 동안 1회 → 새로고침하면 다시 셈, 기준이 제각각
--
--  해결:
--   누가 봤는지 기록해서 (사용자 1명 = 1회) 로 셉니다.
--   로그인 안 한 사람은 익명 키(브라우저)로 구분합니다.
--
--  Supabase SQL Editor에서 실행. 여러 번 실행해도 안전.
-- ============================================================


-- ============================================================
--  1. 조회 기록 테이블
--     viewer_key: 로그인 유저면 uuid 문자열, 아니면 브라우저 익명 키
-- ============================================================
create table if not exists post_views (
  post_id uuid not null references posts(id) on delete cascade,
  viewer_key text not null,
  created_at timestamptz default now(),
  primary key (post_id, viewer_key)
);

create table if not exists market_views (
  item_id uuid not null references market_items(id) on delete cascade,
  viewer_key text not null,
  created_at timestamptz default now(),
  primary key (item_id, viewer_key)
);

alter table post_views   enable row level security;
alter table market_views enable row level security;
-- 접근은 아래 함수(security definer)로만


-- ============================================================
--  2. 제보 조회 — 처음 보는 사람일 때만 +1
-- ============================================================
-- 반환 타입이 void→int로 바뀌므로 기존 함수 제거 (replace 불가)
drop function if exists increment_view_count(uuid);
drop function if exists increment_view_count(uuid, text);
-- 파라미터 이름이 컬럼(post_id)과 겹치면 'ambiguous' 오류가 나므로 p_post_id 로 구분
create or replace function increment_view_count(p_post_id uuid, p_viewer text default null)
returns int as $$
declare
  v_key text := coalesce(nullif(p_viewer, ''), auth.uid()::text, gen_random_uuid()::text);
  v_new int;
begin
  insert into post_views(post_id, viewer_key)
  values (p_post_id, v_key)
  on conflict (post_id, viewer_key) do nothing;
  get diagnostics v_new = row_count;   -- 1이면 새로 들어감(처음 본 사람)

  if v_new = 1 then
    update posts set view_count = coalesce(view_count, 0) + 1 where id = p_post_id
      returning view_count into v_new;
  else
    select view_count into v_new from posts where id = p_post_id;
  end if;

  return coalesce(v_new, 0);
end;
$$ language plpgsql security definer;


-- ============================================================
--  3. 마켓 조회 — 처음 보는 사람일 때만 +1
-- ============================================================
drop function if exists increment_market_view(uuid);
drop function if exists increment_market_view(uuid, text);
create or replace function increment_market_view(p_item_id uuid, p_viewer text default null)
returns int as $$
declare
  v_key text := coalesce(nullif(p_viewer, ''), auth.uid()::text, gen_random_uuid()::text);
  v_new int;
begin
  insert into market_views(item_id, viewer_key)
  values (p_item_id, v_key)
  on conflict (item_id, viewer_key) do nothing;
  get diagnostics v_new = row_count;

  if v_new = 1 then
    update market_items set view_count = coalesce(view_count, 0) + 1 where id = p_item_id
      returning view_count into v_new;
  else
    select view_count into v_new from market_items where id = p_item_id;
  end if;

  return coalesce(v_new, 0);
end;
$$ language plpgsql security definer;


-- ============================================================
--  4. 기존 조회수 보정 (선택)
--     지금까지 뻥튀기된 마켓 조회수를 실제 기록 수로 맞추고 싶으면 실행.
--     기록이 없던 과거분은 0이 되니, 신경 쓰이면 주석 처리하세요.
-- ============================================================
-- update market_items m set view_count = (
--   select count(*) from market_views v where v.item_id = m.id
-- );
-- update posts p set view_count = (
--   select count(*) from post_views v where v.post_id = p.id
-- );


-- ============================================================
--  완료!
--   이제 같은 사람이 여러 번 봐도 조회수는 1만 올라갑니다.
--   앱에서 익명 뷰어 키를 함께 넘겨줍니다.
-- ============================================================
