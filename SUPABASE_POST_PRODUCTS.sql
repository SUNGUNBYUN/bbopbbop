-- ============================================================
--  제보 단위를 '기계 1대'로 — 인형 목록(products) 추가
--
--  왜:
--   실제 뽑기 기계 한 대에 짱구·헬로키티·시나모롤이 섞여 있습니다.
--   "1 제보 = 1 인형"이면 같은 사진을 여러 번 올려야 하고,
--   무엇보다 title 하나만으로는 나머지가 검색에 안 걸립니다.
--
--  Supabase SQL Editor에서 실행. 여러 번 실행해도 안전.
-- ============================================================


-- ============================================================
--  1. 인형 목록 컬럼
-- ============================================================
alter table posts add column if not exists products text[];

-- 기존 제보는 제목을 인형 목록으로 옮겨둠
update posts
   set products = array[title]
 where products is null
   and coalesce(btrim(title), '') <> '';

create index if not exists posts_products_idx on posts using gin (products);


-- ============================================================
--  2. 인형 이름 정규화 (띄어쓰기·특수문자 제거, 소문자)
--     "헬로 키티!" 와 "헬로키티" 를 같은 것으로 보기 위함
-- ============================================================
create or replace function normalize_product(p text)
returns text as $$
  select lower(regexp_replace(coalesce(p, ''), '[^가-힣a-zA-Z0-9]', '', 'g'));
$$ language sql immutable;


-- ============================================================
--  3. 제보 등록 — 중복 판정을 '인형 목록 겹침' 기준으로
--
--   같은 가게 + 7일 이내 + 인형이 절반 이상 겹치면 중복으로 봅니다.
--   (기계가 여러 대라 한두 개 겹치는 건 자연스러움)
-- ============================================================
create or replace function award_product_report(
  p_post_id uuid, p_place_id uuid, p_title text, p_force boolean default false
) returns json as $$
declare
  v_user uuid := auth.uid();
  v_mine text[];
  v_norm text[];
  v_dup int := 0;
  v_is_dup boolean := false;
  v_reward int := 0;
  r record;
  v_overlap int;
  v_need int;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;

  -- 이 제보의 인형 목록 (없으면 제목을 목록으로)
  select coalesce(products, array[title]) into v_mine from posts where id = p_post_id;
  if v_mine is null then v_mine := array[coalesce(p_title, '')]; end if;

  select array_agg(normalize_product(x)) into v_norm
    from unnest(v_mine) as x
   where btrim(coalesce(x, '')) <> '';

  update posts set place_id = p_place_id where id = p_post_id;

  if p_force or p_place_id is null or v_norm is null or array_length(v_norm, 1) is null then
    v_dup := 0;
  else
    -- 절반 이상 겹치는 기존 제보가 있는지
    v_need := greatest(1, (array_length(v_norm, 1) + 1) / 2);
    for r in
      select p.id, p.products
        from posts p
       where p.place_id = p_place_id
         and p.id <> p_post_id
         and p.created_at > now() - interval '7 days'
         and p.products is not null
    loop
      select count(*) into v_overlap
        from unnest(r.products) as y
       where normalize_product(y) = any (v_norm);

      if v_overlap >= v_need then
        v_dup := 1;
        exit;
      end if;
    end loop;
  end if;

  v_is_dup := (v_dup > 0);

  if p_place_id is not null then
    update places set product_count = (select count(*) from posts where place_id = p_place_id)
     where id = p_place_id;
  end if;

  if v_is_dup then
    update posts set reward_confirmed = true where id = p_post_id;
  else
    v_reward := 10;
    insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
    values (v_user, v_reward, 'report', 'post', p_post_id::text);
    update profiles set point_balance = point_balance + v_reward where id = v_user;
  end if;

  return json_build_object('post_reward', v_reward, 'is_dup', v_is_dup);
end;
$$ language plpgsql security definer;


-- ============================================================
--  4. 가게의 기존 제보 목록 (등록 전 "이미 있나요?" 확인용)
--     인형 목록까지 함께 반환
-- ============================================================
drop function if exists place_products(uuid);
create or replace function place_products(p_place_id uuid)
returns table (id uuid, title text, image_url text, products text[], created_at timestamptz) as $$
  select p.id, p.title, p.image_url, p.products, p.created_at
    from posts p
   where p.place_id = p_place_id
     and coalesce(p.hidden, false) = false
   order by p.created_at desc
   limit 20;
$$ language sql stable;


-- ============================================================
--  5. 비슷한 제보 찾기 (입력 중 안내용)
--     내가 적은 인형과 하나라도 겹치는 기존 제보
-- ============================================================
drop function if exists similar_products(uuid, text);
create or replace function similar_products(p_place_id uuid, p_names text[])
returns table (id uuid, title text, image_url text, products text[], created_at timestamptz) as $$
  select p.id, p.title, p.image_url, p.products, p.created_at
    from posts p
   where p.place_id = p_place_id
     and coalesce(p.hidden, false) = false
     and p.products is not null
     and exists (
       select 1 from unnest(p.products) as y
        where normalize_product(y) = any (
          select normalize_product(x) from unnest(p_names) as x
        )
     )
   order by p.created_at desc
   limit 10;
$$ language sql stable;


-- ============================================================
--  완료!
--   · posts.products 에 인형 이름이 배열로 들어갑니다
--   · 중복은 '같은 가게 + 7일 이내 + 인형 절반 이상 겹침'
--   · 검색은 앱에서 title / tags / products 를 모두 훑습니다
-- ============================================================
