-- ============================================================
--  업체 검색을 '띄어쓰기 무시'로
--
--  문제: ilike '%토이즈팝%' 은 "토이즈 팝"(공백 포함)을 못 찾음.
--        그래서 같은 가게인데 띄어쓰기에 따라 결과가 달라짐.
--
--  해결: 이름과 검색어 양쪽에서 공백을 없애고 비교.
--
--  Supabase SQL Editor에서 실행. 여러 번 실행해도 안전.
-- ============================================================

create or replace function search_places(p_q text)
returns table (
  id uuid,
  place_name text,
  address text,
  latitude double precision,
  longitude double precision
)
language sql
stable
as $$
  select p.id, p.place_name, p.address, p.latitude, p.longitude
    from places p
   where regexp_replace(lower(p.place_name), '\s', '', 'g')
         like '%' || regexp_replace(lower(coalesce(p_q, '')), '\s', '', 'g') || '%'
   order by p.place_name
   limit 15;
$$;
