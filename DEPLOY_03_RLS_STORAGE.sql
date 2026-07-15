-- ============================================================
--  뽑뽑 운영 배포 [3/3] — RLS 정책 + Storage
--  DEPLOY_02_FUNCTIONS.sql 실행 후 이걸 실행. (마지막 단계)
-- ============================================================

-- posts / market_items / feed_posts (본인만 수정·삭제)
alter table posts enable row level security;
drop policy if exists "posts 조회 공개" on posts;
create policy "posts 조회 공개" on posts for select using (true);
drop policy if exists "posts 작성" on posts;
create policy "posts 작성" on posts for insert with check (auth.uid() = user_id);
drop policy if exists "posts 본인 수정" on posts;
create policy "posts 본인 수정" on posts for update using (auth.uid() = user_id);
drop policy if exists "posts 본인 삭제" on posts;
create policy "posts 본인 삭제" on posts for delete using (auth.uid() = user_id);

alter table market_items enable row level security;
drop policy if exists "market 조회 공개" on market_items;
create policy "market 조회 공개" on market_items for select using (true);
drop policy if exists "market 작성" on market_items;
create policy "market 작성" on market_items for insert with check (auth.uid() = user_id);
drop policy if exists "market 본인 수정" on market_items;
create policy "market 본인 수정" on market_items for update using (auth.uid() = user_id);
drop policy if exists "market 본인 삭제" on market_items;
create policy "market 본인 삭제" on market_items for delete using (auth.uid() = user_id);

alter table feed_posts enable row level security;
drop policy if exists "feed 조회 공개" on feed_posts;
create policy "feed 조회 공개" on feed_posts for select using (true);
drop policy if exists "feed 작성" on feed_posts;
create policy "feed 작성" on feed_posts for insert with check (auth.uid() = user_id);
drop policy if exists "feed 본인 수정" on feed_posts;
create policy "feed 본인 수정" on feed_posts for update using (auth.uid() = user_id);
drop policy if exists "feed 본인 삭제" on feed_posts;
create policy "feed 본인 삭제" on feed_posts for delete using (auth.uid() = user_id);

-- places (조회 공개, 쓰기는 함수로만)
alter table places enable row level security;
drop policy if exists "places 조회 공개" on places;
create policy "places 조회 공개" on places for select using (true);

-- points_ledger (본인만 조회, 쓰기는 함수로만)
alter table points_ledger enable row level security;
drop policy if exists "ledger 본인만 조회" on points_ledger;
create policy "ledger 본인만 조회" on points_ledger for select using (auth.uid() = user_id);

-- profiles (조회 공개, 최초 생성만, 잔액 수정은 함수로만)
alter table profiles enable row level security;
drop policy if exists "profiles 조회 공개" on profiles;
create policy "profiles 조회 공개" on profiles for select using (true);
drop policy if exists "profiles 본인 생성" on profiles;
create policy "profiles 본인 생성" on profiles for insert with check (auth.uid() = id);

-- likes / comments
alter table likes enable row level security;
drop policy if exists "likes 조회 공개" on likes;
create policy "likes 조회 공개" on likes for select using (true);
drop policy if exists "likes 본인 추가" on likes;
create policy "likes 본인 추가" on likes for insert with check (auth.uid() = user_id);
drop policy if exists "likes 본인 삭제" on likes;
create policy "likes 본인 삭제" on likes for delete using (auth.uid() = user_id);

alter table comments enable row level security;
drop policy if exists "comments 조회 공개" on comments;
create policy "comments 조회 공개" on comments for select using (true);
drop policy if exists "comments 본인 작성" on comments;
create policy "comments 본인 작성" on comments for insert with check (auth.uid() = user_id);
drop policy if exists "comments 본인 수정" on comments;
create policy "comments 본인 수정" on comments for update using (auth.uid() = user_id);
drop policy if exists "comments 본인 삭제" on comments;
create policy "comments 본인 삭제" on comments for delete using (auth.uid() = user_id);

-- market_likes / market_comments
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

-- feed_likes / feed_comments
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

-- 채팅 (참여자만)
alter table chat_rooms enable row level security;
drop policy if exists "chat_rooms 참여자 조회" on chat_rooms;
create policy "chat_rooms 참여자 조회" on chat_rooms for select using (auth.uid() = user1_id or auth.uid() = user2_id);
drop policy if exists "chat_rooms 참여자 생성" on chat_rooms;
create policy "chat_rooms 참여자 생성" on chat_rooms for insert with check (auth.uid() = user1_id or auth.uid() = user2_id);
drop policy if exists "chat_rooms 참여자 수정" on chat_rooms;
create policy "chat_rooms 참여자 수정" on chat_rooms for update using (auth.uid() = user1_id or auth.uid() = user2_id);

alter table messages enable row level security;
drop policy if exists "messages 참여자 조회" on messages;
create policy "messages 참여자 조회" on messages for select using (
  exists (select 1 from chat_rooms r where r.id = messages.room_id and (auth.uid() = r.user1_id or auth.uid() = r.user2_id)));
drop policy if exists "messages 참여자 작성" on messages;
create policy "messages 참여자 작성" on messages for insert with check (
  auth.uid() = sender_id and exists (select 1 from chat_rooms r where r.id = messages.room_id and (auth.uid() = r.user1_id or auth.uid() = r.user2_id)));

-- email_verifications: RLS 켜고 정책 없음 → 서비스롤(서버)만 접근 가능
alter table email_verifications enable row level security;

-- notifications / reports / blocks
alter table notifications enable row level security;
drop policy if exists "본인 알림만 조회" on notifications;
create policy "본인 알림만 조회" on notifications for select using (auth.uid() = user_id);
drop policy if exists "누구나 알림 생성" on notifications;
create policy "누구나 알림 생성" on notifications for insert with check (true);
drop policy if exists "본인 알림 수정" on notifications;
create policy "본인 알림 수정" on notifications for update using (auth.uid() = user_id);
drop policy if exists "본인 알림 삭제" on notifications;
create policy "본인 알림 삭제" on notifications for delete using (auth.uid() = user_id);

alter table reports enable row level security;
drop policy if exists "누구나 신고 작성" on reports;
create policy "누구나 신고 작성" on reports for insert with check (auth.uid() = reporter_id);
drop policy if exists "본인 신고만 조회" on reports;
create policy "본인 신고만 조회" on reports for select using (auth.uid() = reporter_id);

alter table blocks enable row level security;
drop policy if exists "본인 차단 관리" on blocks;
create policy "본인 차단 관리" on blocks for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);


-- ────────────────────────────────────────────────
-- Storage: images 버킷 + 정책
-- ────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('images', 'images', true)
  on conflict (id) do update set public = true;

drop policy if exists "images 공개 조회" on storage.objects;
create policy "images 공개 조회" on storage.objects for select using (bucket_id = 'images');
drop policy if exists "images 로그인 업로드" on storage.objects;
create policy "images 로그인 업로드" on storage.objects for insert with check (bucket_id = 'images' and auth.role() = 'authenticated');
drop policy if exists "images 로그인 수정" on storage.objects;
create policy "images 로그인 수정" on storage.objects for update using (bucket_id = 'images' and auth.role() = 'authenticated');
drop policy if exists "images 본인 삭제" on storage.objects;
create policy "images 본인 삭제" on storage.objects for delete using (bucket_id = 'images' and auth.role() = 'authenticated');

-- ============================================================
--  [3/3] 완료! 운영 DB 세팅 끝.
--  ⚠️ email_verifications는 RLS 없음(서버 서비스롤로만 접근하므로).
--     혹시 클라이언트 접근 우려 시 RLS enable 후 정책 없이 두면 서비스롤만 접근 가능.
-- ============================================================
