-- ============================================================
--  조회수가 안 오르는 원인 진단
--  Supabase SQL Editor에서 "한 줄씩" 실행하며 결과를 확인하세요.
-- ============================================================


-- 1) 함수가 p_viewer 를 받는 최신 버전인지 확인
--    결과에 increment_view_count(post_id uuid, p_viewer text)  가 보여야 정상.
--    만약 increment_view_count(post_id uuid) 만 나오면 → 옛 버전입니다.
--    이 경우 SUPABASE_VIEW_COUNT.sql 을 "다시" 실행하세요.
select p.proname,
       pg_get_function_arguments(p.oid)  as args,
       pg_get_function_result(p.oid)     as returns
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where p.proname in ('increment_view_count', 'increment_market_view')
 order by p.proname;


-- 2) 기록 테이블이 있는지
select table_name
  from information_schema.tables
 where table_name in ('post_views', 'market_views');


-- 3) 실제로 한 번 올려보기 (아무 제보 하나로 테스트)
--    아래를 순서대로 실행하면 조회수가 0 → 1 로 바뀌어야 합니다.
--    (같은 viewer 로 또 부르면 그대로 1 — 정상)
do $$
declare
  v_id uuid;
  v_before int;
  v_after  int;
begin
  select id, coalesce(view_count,0) into v_id, v_before
    from posts order by created_at desc limit 1;

  v_after := increment_view_count(v_id, 'debug_viewer_1');

  raise notice '제보 %  before=%  after=%', v_id, v_before, v_after;
end $$;


-- 4) 방금 테스트 기록 정리(선택)
-- delete from post_views where viewer_key = 'debug_viewer_1';
