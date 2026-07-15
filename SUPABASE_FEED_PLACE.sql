-- ============================================================
--  피드에 장소 정보 컬럼 추가 (선택적으로 "어디서 뽑았는지")
--  운영 DB에서 실행. 여러 번 실행해도 안전.
-- ============================================================
alter table feed_posts add column if not exists place_name text;
alter table feed_posts add column if not exists location text;
alter table feed_posts add column if not exists latitude double precision;
alter table feed_posts add column if not exists longitude double precision;

-- ============================================================
--  완료! 이제 피드 작성 시 장소를 선택적으로 넣을 수 있어요.
-- ============================================================
