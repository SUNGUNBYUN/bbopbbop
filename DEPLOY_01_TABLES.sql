-- ============================================================
--  뽑뽑 운영 배포 [1/3] — 테이블 생성
--  ⚠️ 새 Supabase 프로젝트의 SQL Editor에서 순서대로 실행:
--     DEPLOY_01_TABLES.sql → DEPLOY_02_FUNCTIONS.sql → DEPLOY_03_RLS_STORAGE.sql
--  이 파일은 빈 DB에 모든 테이블을 만든다. (auth.users는 Supabase 기본 제공)
-- ============================================================

-- 프로필 (포인트 잔액)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  point_balance int not null default 0,
  created_at timestamptz default now()
);

-- 제보 (상품 제보)
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  location text,
  tags text,
  created_at timestamptz default now(),
  image_url text,
  user_id uuid,
  nickname text,
  view_count int default 0,
  like_count int default 0,
  comment_count int default 0,
  latitude double precision,
  longitude double precision,
  place_name text,
  images text[],
  verify_count int default 0,
  last_verified_at timestamptz default now(),
  reward_confirmed boolean default false,
  hidden boolean default false,
  place_id uuid,
  product_key text
);

-- 가게 (위치 단위)
create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  place_name text not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  kakao_place_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_nickname text,
  confirm_count int default 0,
  reward_confirmed boolean default false,
  product_count int default 0,
  created_at timestamptz default now()
);

-- 좋아요 / 댓글 (제보)
create table if not exists likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid,
  user_id uuid not null,
  created_at timestamptz default now()
);
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid,
  user_id uuid not null,
  nickname text,
  content text not null,
  created_at timestamptz default now()
);

-- 마켓
create table if not exists market_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  price int,
  is_free boolean default false,
  trade_type text default 'both',
  image_url text,
  status text default 'selling',
  user_id uuid not null,
  nickname text,
  location text,
  latitude double precision,
  longitude double precision,
  place_name text,
  view_count int default 0,
  like_count int default 0,
  created_at timestamptz default now(),
  images text[],
  bumped_at timestamptz
);
create table if not exists market_likes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid,
  user_id uuid not null,
  created_at timestamptz default now()
);
create table if not exists market_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid,
  user_id uuid not null,
  nickname text,
  content text not null,
  created_at timestamptz default now()
);

-- 피드
create table if not exists feed_posts (
  id uuid primary key default gen_random_uuid(),
  content text,
  image_url text,
  user_id uuid not null,
  nickname text,
  like_count int default 0,
  comment_count int default 0,
  created_at timestamptz default now()
);
create table if not exists feed_likes (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid,
  user_id uuid not null,
  created_at timestamptz default now()
);
create table if not exists feed_comments (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid,
  user_id uuid not null,
  nickname text,
  content text not null,
  created_at timestamptz default now()
);

-- 채팅
create table if not exists chat_rooms (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid not null,
  user2_id uuid not null,
  user1_nickname text,
  user2_nickname text,
  last_message text,
  last_message_at timestamptz default now(),
  post_id uuid,
  post_title text,
  created_at timestamptz default now(),
  source_type text default 'post',
  source_id text
);
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid,
  sender_id uuid not null,
  sender_nickname text,
  content text not null,
  created_at timestamptz default now()
);

-- 포인트 원장
create table if not exists points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  amount int not null,
  reason text not null,
  ref_type text,
  ref_id text,
  created_at timestamptz default now()
);

-- 알림 / 신고 / 차단
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_nickname text,
  type text not null,
  target_type text,
  target_id text,
  target_title text,
  message text,
  is_read boolean default false,
  created_at timestamptz default now()
);
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  reason text not null,
  detail text,
  created_at timestamptz default now()
);
create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid references auth.users(id) on delete cascade,
  blocked_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (blocker_id, blocked_id)
);

-- 이메일 인증
create table if not exists email_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  verified boolean default false,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- 인덱스
create index if not exists idx_ledger_user_time on points_ledger(user_id, created_at desc);
create index if not exists idx_places_lat on places(latitude);
create index if not exists idx_places_lng on places(longitude);
create index if not exists idx_places_kakao on places(kakao_place_id);
create index if not exists idx_notifications_user on notifications(user_id, created_at desc);

-- ============================================================
--  [1/3] 완료 → DEPLOY_02_FUNCTIONS.sql 실행
-- ============================================================
