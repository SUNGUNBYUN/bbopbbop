-- ============================================================
--  피드: 여러 장 사진 + 장소 컬럼
--  Supabase SQL Editor에서 실행. 여러 번 실행해도 안전.
-- ============================================================

-- 1) 여러 장 사진 (마켓과 동일한 방식)
alter table feed_posts add column if not exists images text[];

-- 2) 장소 컬럼 (이미 있으면 넘어감)
alter table feed_posts add column if not exists place_name text;
alter table feed_posts add column if not exists location text;
alter table feed_posts add column if not exists latitude double precision;
alter table feed_posts add column if not exists longitude double precision;

-- 3) 수정 시각 (수정 기능용)
alter table feed_posts  add column if not exists updated_at timestamptz;
alter table market_items add column if not exists updated_at timestamptz;

-- 4) 기존 글의 단일 사진을 images 배열로 채워넣기 (1회성, 안전)
update feed_posts
   set images = array[image_url]
 where image_url is not null
   and (images is null or cardinality(images) = 0);

-- ============================================================
--  완료!
-- ============================================================
