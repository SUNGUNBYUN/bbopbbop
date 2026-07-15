-- ============================================================
--  뽑뽑 보안 강화 (배포 전 필수)
--  1) 좋아요/댓글/채팅 RLS 정책 (특히 채팅 프라이버시)
--  2) 카운트(조회수/좋아요/댓글) 서버 함수로 안전 증감
--  3) email_verifications.created_at 보강 (rate limit용)
--  ⚠️ Supabase SQL Editor에서 실행. 여러 번 실행해도 안전.
-- ============================================================


-- ────────────────────────────────────────────────
-- 1. likes (제보 좋아요)
-- ────────────────────────────────────────────────
alter table likes enable row level security;
drop policy if exists "likes 조회 공개" on likes;
create policy "likes 조회 공개" on likes for select using (true);
drop policy if exists "likes 본인 추가" on likes;
create policy "likes 본인 추가" on likes for insert with check (auth.uid() = user_id);
drop policy if exists "likes 본인 삭제" on likes;
create policy "likes 본인 삭제" on likes for delete using (auth.uid() = user_id);


-- ────────────────────────────────────────────────
-- 2. comments (제보 댓글)
-- ────────────────────────────────────────────────
alter table comments enable row level security;
drop policy if exists "comments 조회 공개" on comments;
create policy "comments 조회 공개" on comments for select using (true);
drop policy if exists "comments 본인 작성" on comments;
create policy "comments 본인 작성" on comments for insert with check (auth.uid() = user_id);
drop policy if exists "comments 본인 수정" on comments;
create policy "comments 본인 수정" on comments for update using (auth.uid() = user_id);
drop policy if exists "comments 본인 삭제" on comments;
create policy "comments 본인 삭제" on comments for delete using (auth.uid() = user_id);


-- ────────────────────────────────────────────────
-- 3. market_likes / market_comments
-- ────────────────────────────────────────────────
alter table market_likes enable row level security;
drop policy if exists "market_likes 조회 공개" on market_likes;
create policy "market_likes 조회 공개" on market_likes for select using (true);
drop policy if exists "market_likes 본인 추가" on market_likes;
create policy "market_likes 본인 추가" on market_likes for insert with check (auth.uid() = user_id);
drop policy if exists "market_likes 본인 삭제" on market_likes;
create policy "market_likes 본인 삭제" on market_likes for delete using (auth.uid() = user_id);

alter table market_comments enable row level security;
drop policy if exists "market_comments 조회 공개" on market_comments;
create policy "market_comments 조회 공개" on market_comments for select using (true);
drop policy if exists "market_comments 본인 작성" on market_comments;
create policy "market_comments 본인 작성" on market_comments for insert with check (auth.uid() = user_id);
drop policy if exists "market_comments 본인 삭제" on market_comments;
create policy "market_comments 본인 삭제" on market_comments for delete using (auth.uid() = user_id);


-- ────────────────────────────────────────────────
-- 3-2. feed_likes / feed_comments
-- ────────────────────────────────────────────────
alter table feed_likes enable row level security;
drop policy if exists "feed_likes 조회 공개" on feed_likes;
create policy "feed_likes 조회 공개" on feed_likes for select using (true);
drop policy if exists "feed_likes 본인 추가" on feed_likes;
create policy "feed_likes 본인 추가" on feed_likes for insert with check (auth.uid() = user_id);
drop policy if exists "feed_likes 본인 삭제" on feed_likes;
create policy "feed_likes 본인 삭제" on feed_likes for delete using (auth.uid() = user_id);

alter table feed_comments enable row level security;
drop policy if exists "feed_comments 조회 공개" on feed_comments;
create policy "feed_comments 조회 공개" on feed_comments for select using (true);
drop policy if exists "feed_comments 본인 작성" on feed_comments;
create policy "feed_comments 본인 작성" on feed_comments for insert with check (auth.uid() = user_id);
drop policy if exists "feed_comments 본인 삭제" on feed_comments;
create policy "feed_comments 본인 삭제" on feed_comments for delete using (auth.uid() = user_id);


-- ────────────────────────────────────────────────
-- 4. 채팅 — ⚠️ 프라이버시 핵심: 참여자만 조회/작성
-- ────────────────────────────────────────────────
alter table chat_rooms enable row level security;
drop policy if exists "chat_rooms 참여자 조회" on chat_rooms;
create policy "chat_rooms 참여자 조회" on chat_rooms
  for select using (auth.uid() = user1_id or auth.uid() = user2_id);
drop policy if exists "chat_rooms 참여자 생성" on chat_rooms;
create policy "chat_rooms 참여자 생성" on chat_rooms
  for insert with check (auth.uid() = user1_id or auth.uid() = user2_id);
-- 참여자는 방 정보(last_message 등) 갱신 가능
drop policy if exists "chat_rooms 참여자 수정" on chat_rooms;
create policy "chat_rooms 참여자 수정" on chat_rooms
  for update using (auth.uid() = user1_id or auth.uid() = user2_id);

alter table messages enable row level security;
-- 메시지는 '그 방의 참여자'만 조회 가능
drop policy if exists "messages 참여자 조회" on messages;
create policy "messages 참여자 조회" on messages
  for select using (
    exists (
      select 1 from chat_rooms r
      where r.id = messages.room_id
        and (auth.uid() = r.user1_id or auth.uid() = r.user2_id)
    )
  );
-- 메시지 작성은 본인이 sender이고, 그 방 참여자일 때만
drop policy if exists "messages 참여자 작성" on messages;
create policy "messages 참여자 작성" on messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from chat_rooms r
      where r.id = messages.room_id
        and (auth.uid() = r.user1_id or auth.uid() = r.user2_id)
    )
  );


-- ────────────────────────────────────────────────
-- 5. 카운트 안전 증감 (클라이언트 직접 조작 방지)
--    클라이언트는 이 함수만 호출. 실제 숫자는 서버가 계산.
-- ────────────────────────────────────────────────

-- 조회수 +1 (이미 있을 수 있음 → 교체)
create or replace function increment_view_count(post_id uuid)
returns void as $$
  update posts set view_count = coalesce(view_count, 0) + 1 where id = post_id;
$$ language sql security definer;

-- 마켓 조회수 +1
create or replace function increment_market_view(item_id uuid)
returns void as $$
  update market_items set view_count = coalesce(view_count, 0) + 1 where id = item_id;
$$ language sql security definer;

-- 제보 좋아요 카운트 동기화(실제 likes row 수로)
create or replace function sync_post_like_count(p_post_id uuid)
returns int as $$
declare c int;
begin
  select count(*) into c from likes where post_id = p_post_id;
  update posts set like_count = c where id = p_post_id;
  return c;
end;
$$ language plpgsql security definer;

-- 제보 댓글 카운트 동기화
create or replace function sync_post_comment_count(p_post_id uuid)
returns int as $$
declare c int;
begin
  select count(*) into c from comments where post_id = p_post_id;
  update posts set comment_count = c where id = p_post_id;
  return c;
end;
$$ language plpgsql security definer;

-- 마켓 좋아요 카운트 동기화
create or replace function sync_market_like_count(p_item_id uuid)
returns int as $$
declare c int;
begin
  select count(*) into c from market_likes where item_id = p_item_id;
  update market_items set like_count = c where id = p_item_id;
  return c;
end;
$$ language plpgsql security definer;

-- 피드 좋아요 카운트 동기화
create or replace function sync_feed_like_count(p_feed_id uuid)
returns int as $$
declare c int;
begin
  select count(*) into c from feed_likes where feed_id = p_feed_id;
  update feed_posts set like_count = c where id = p_feed_id;
  return c;
end;
$$ language plpgsql security definer;

-- 피드 댓글 카운트 동기화
create or replace function sync_feed_comment_count(p_feed_id uuid)
returns int as $$
declare c int;
begin
  select count(*) into c from feed_comments where feed_id = p_feed_id;
  update feed_posts set comment_count = c where id = p_feed_id;
  return c;
end;
$$ language plpgsql security definer;


-- ────────────────────────────────────────────────
-- 6. email_verifications: created_at 보강 (rate limit용)
-- ────────────────────────────────────────────────
alter table email_verifications add column if not exists created_at timestamptz default now();


-- ============================================================
--  완료!
--  ⚠️ 이제 posts/market/feed의 like_count/comment_count를
--     클라이언트가 직접 UPDATE 못 함(RLS로 막힘). 반드시 위 함수 사용.
--     (다음 커밋에서 클라이언트 코드를 함수 호출로 교체)
-- ============================================================
