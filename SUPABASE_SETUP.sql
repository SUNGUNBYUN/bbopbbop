-- ============================================================
--  뽑뽑 DB 설정 (Supabase SQL Editor에 붙여넣고 실행)
--  고도화 3단계: 수정/삭제 권한, 신고, 차단, 알림
-- ============================================================
--  ⚠️ 실행 전 확인: 이미 posts, likes, comments, market_items,
--     feed_posts, chat_rooms, messages 테이블이 있다고 가정합니다.
--  이 스크립트는 여러 번 실행해도 안전합니다 (IF NOT EXISTS 사용).
-- ============================================================


-- ────────────────────────────────────────────────
-- 1. 신고 테이블
-- ────────────────────────────────────────────────
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete cascade,
  target_type text not null,          -- 'post' | 'market' | 'feed' | 'comment' | 'user'
  target_id text not null,
  reason text not null,               -- '스팸/광고' | '욕설/비방' | '부적절한 콘텐츠' | '사기 의심' | '기타'
  detail text,
  created_at timestamptz default now()
);

alter table reports enable row level security;

drop policy if exists "누구나 신고 작성" on reports;
create policy "누구나 신고 작성" on reports
  for insert with check (auth.uid() = reporter_id);

drop policy if exists "본인 신고만 조회" on reports;
create policy "본인 신고만 조회" on reports
  for select using (auth.uid() = reporter_id);


-- ────────────────────────────────────────────────
-- 2. 차단 테이블
-- ────────────────────────────────────────────────
create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid references auth.users(id) on delete cascade,
  blocked_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (blocker_id, blocked_id)
);

alter table blocks enable row level security;

drop policy if exists "본인 차단 관리" on blocks;
create policy "본인 차단 관리" on blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);


-- ────────────────────────────────────────────────
-- 3. 알림 테이블
-- ────────────────────────────────────────────────
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,   -- 알림 받는 사람
  actor_id uuid references auth.users(id) on delete set null, -- 알림 유발한 사람
  actor_nickname text,
  type text not null,                 -- 'like' | 'comment' | 'chat' | 'market_like' | 'feed_like' | 'feed_comment'
  target_type text,                   -- 'post' | 'market' | 'feed'
  target_id text,
  target_title text,
  message text,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table notifications enable row level security;

drop policy if exists "본인 알림만 조회" on notifications;
create policy "본인 알림만 조회" on notifications
  for select using (auth.uid() = user_id);

drop policy if exists "누구나 알림 생성" on notifications;
create policy "누구나 알림 생성" on notifications
  for insert with check (true);

drop policy if exists "본인 알림 수정" on notifications;
create policy "본인 알림 수정" on notifications
  for update using (auth.uid() = user_id);

drop policy if exists "본인 알림 삭제" on notifications;
create policy "본인 알림 삭제" on notifications
  for delete using (auth.uid() = user_id);

create index if not exists idx_notifications_user on notifications(user_id, created_at desc);


-- ────────────────────────────────────────────────
-- 4. 게시물 수정/삭제 권한 (RLS)
--    작성자 본인만 수정·삭제 가능하도록
-- ────────────────────────────────────────────────

-- posts
alter table posts enable row level security;
drop policy if exists "posts 조회 공개" on posts;
create policy "posts 조회 공개" on posts for select using (true);
drop policy if exists "posts 작성" on posts;
create policy "posts 작성" on posts for insert with check (auth.uid() = user_id);
drop policy if exists "posts 본인 수정" on posts;
create policy "posts 본인 수정" on posts for update using (auth.uid() = user_id);
drop policy if exists "posts 본인 삭제" on posts;
create policy "posts 본인 삭제" on posts for delete using (auth.uid() = user_id);

-- market_items
alter table market_items enable row level security;
drop policy if exists "market 조회 공개" on market_items;
create policy "market 조회 공개" on market_items for select using (true);
drop policy if exists "market 작성" on market_items;
create policy "market 작성" on market_items for insert with check (auth.uid() = user_id);
drop policy if exists "market 본인 수정" on market_items;
create policy "market 본인 수정" on market_items for update using (auth.uid() = user_id);
drop policy if exists "market 본인 삭제" on market_items;
create policy "market 본인 삭제" on market_items for delete using (auth.uid() = user_id);

-- feed_posts
alter table feed_posts enable row level security;
drop policy if exists "feed 조회 공개" on feed_posts;
create policy "feed 조회 공개" on feed_posts for select using (true);
drop policy if exists "feed 작성" on feed_posts;
create policy "feed 작성" on feed_posts for insert with check (auth.uid() = user_id);
drop policy if exists "feed 본인 수정" on feed_posts;
create policy "feed 본인 수정" on feed_posts for update using (auth.uid() = user_id);
drop policy if exists "feed 본인 삭제" on feed_posts;
create policy "feed 본인 삭제" on feed_posts for delete using (auth.uid() = user_id);


-- ────────────────────────────────────────────────
-- 5. 이미지 여러 장 — posts에 images 컬럼 추가
--    (기존 image_url은 대표 이미지로 유지, 하위호환)
-- ────────────────────────────────────────────────
alter table posts add column if not exists images text[];
alter table market_items add column if not exists images text[];


-- ────────────────────────────────────────────────
-- 6. 조회수 증가 함수 (이미 있으면 교체)
-- ────────────────────────────────────────────────
create or replace function increment_view_count(post_id uuid)
returns void as $$
  update posts set view_count = coalesce(view_count, 0) + 1 where id = post_id;
$$ language sql;


-- ============================================================
--  완료! 이제 앱에서 수정/삭제/신고/알림/다중이미지가 작동합니다.
-- ============================================================
