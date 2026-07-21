-- ============================================================
--  가게 중복 생성 근본 차단 + 기존 중복 자동 정리
--
--  왜 계속 쌓였나:
--   get_or_create_place 가 기존 가게를 확인하지 않고 무조건 새로 만들었습니다.
--   사용자가 "이 가게 맞아요"를 직접 눌러야만 재사용되고,
--   안 누르면 같은 가게라도 매번 새 행이 생겼습니다.
--   (그래서 제보 0개짜리 가게가 여러 개 생김)
--
--  ※ SUPABASE_MERGE_PLACES.sql 을 먼저 실행한 뒤 이 파일을 실행하세요.
--    (merge_places 함수를 사용합니다)
-- ============================================================


-- ============================================================
--  1. 주소 표기 정리
--     "토이즈팝 노량진점 (서울...로 162)" → "서울...로 162"
--     가게명이 앞에 붙어 저장된 것들을 주소만 남기도록 통일
-- ============================================================
update places
   set address = btrim(substring(address from '\(([^)]*)\)$'))
 where address ~ '\([^)]*\)$'
   and btrim(substring(address from '\(([^)]*)\)$')) <> '';


-- ============================================================
--  2. 기존 중복 자동 병합
--     이름이 같거나 서로 포함관계이고 500m 안이면 하나로 합칩니다.
--     (이름이 아예 다르면 자동 병합하지 않고 남겨둡니다 — 직접 판단 필요)
-- ============================================================
create or replace function auto_merge_duplicate_places()
returns json as $$
declare
  r record;
  v_keep uuid;
  v_merged int := 0;
  v_loops int := 0;
begin
  loop
    v_loops := v_loops + 1;
    exit when v_loops > 200;   -- 안전장치

    -- 합칠 쌍 하나 찾기
    select
      a.id as keep_id, b.id as drop_id
      into r
    from places a
    join places b
      on a.id <> b.id
     and (
          -- 띄어쓰기 무시하고 이름이 서로 포함관계
          regexp_replace(coalesce(a.place_name,''), '\s', '', 'g') <> ''
      and regexp_replace(coalesce(b.place_name,''), '\s', '', 'g') <> ''
      and (
            regexp_replace(coalesce(a.place_name,''), '\s', '', 'g')
              like '%' || regexp_replace(coalesce(b.place_name,''), '\s', '', 'g') || '%'
         or regexp_replace(coalesce(b.place_name,''), '\s', '', 'g')
              like '%' || regexp_replace(coalesce(a.place_name,''), '\s', '', 'g') || '%'
          )
         )
     and (6371000 * acos(least(1.0, greatest(-1.0,
           cos(radians(a.latitude)) * cos(radians(b.latitude)) * cos(radians(b.longitude) - radians(a.longitude)) +
           sin(radians(a.latitude)) * sin(radians(b.latitude))
         )))) <= 500
    -- 남길 쪽: 제보 많은 것 → 같으면 먼저 만들어진 것
    where (coalesce(a.product_count,0) > coalesce(b.product_count,0))
       or (coalesce(a.product_count,0) = coalesce(b.product_count,0) and a.created_at <= b.created_at)
    limit 1;

    exit when not found;

    perform merge_places(r.keep_id, r.drop_id);
    v_merged := v_merged + 1;
  end loop;

  return json_build_object('merged_count', v_merged);
end;
$$ language plpgsql security definer;

revoke all on function auto_merge_duplicate_places() from public;
revoke all on function auto_merge_duplicate_places() from anon;
revoke all on function auto_merge_duplicate_places() from authenticated;


-- ============================================================
--  3. 근본 차단 — get_or_create_place 가 스스로 중복을 확인
--
--   순서대로 확인해서 이미 있으면 그 가게를 재사용합니다.
--    (1) 사용자가 직접 고른 가게 (existingPlaceId)
--    (2) 같은 카카오 장소 ID
--    (3) 이름이 같거나 포함관계이면서 300m 이내
--    (4) 주소가 같으면서 300m 이내
--    (5) 위 어느 것도 아니면 그때 새로 생성 (+20P)
-- ============================================================
create or replace function get_or_create_place(
  p_place_name text, p_address text,
  p_lat double precision, p_lng double precision,
  p_kakao_id text default null, p_existing_place_id uuid default null
) returns json as $$
declare
  v_user uuid := auth.uid();
  v_place_id uuid;
  v_is_new boolean := false;
  v_reward int := 0;
  v_norm text;
begin
  if v_user is null then raise exception '로그인이 필요합니다'; end if;

  v_norm := regexp_replace(coalesce(p_place_name, ''), '\s', '', 'g');

  -- (1) 사용자가 직접 고른 가게
  if p_existing_place_id is not null then
    v_place_id := p_existing_place_id;
  end if;

  -- (2) 같은 카카오 장소 ID
  if v_place_id is null and coalesce(p_kakao_id, '') <> '' then
    select id into v_place_id from places
     where kakao_place_id = p_kakao_id
     limit 1;
  end if;

  -- (3) 이름이 같거나 포함관계 + 300m 이내
  if v_place_id is null and length(v_norm) >= 2 then
    select id into v_place_id from places p
     where regexp_replace(coalesce(p.place_name,''), '\s', '', 'g') <> ''
       and (
             regexp_replace(coalesce(p.place_name,''), '\s', '', 'g') like '%' || v_norm || '%'
          or v_norm like '%' || regexp_replace(coalesce(p.place_name,''), '\s', '', 'g') || '%'
           )
       and (6371000 * acos(least(1.0, greatest(-1.0,
             cos(radians(p_lat)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(p_lng)) +
             sin(radians(p_lat)) * sin(radians(p.latitude))
           )))) <= 300
     order by (6371000 * acos(least(1.0, greatest(-1.0,
             cos(radians(p_lat)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(p_lng)) +
             sin(radians(p_lat)) * sin(radians(p.latitude))
           )))) asc
     limit 1;
  end if;

  -- (4) 주소가 같고 300m 이내
  if v_place_id is null and coalesce(btrim(p_address), '') <> '' then
    select id into v_place_id from places p
     where btrim(coalesce(p.address,'')) = btrim(p_address)
       and (6371000 * acos(least(1.0, greatest(-1.0,
             cos(radians(p_lat)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(p_lng)) +
             sin(radians(p_lat)) * sin(radians(p.latitude))
           )))) <= 300
     limit 1;
  end if;

  -- (5) 정말 없으면 새로 생성
  if v_place_id is null then
    insert into places(place_name, address, latitude, longitude, kakao_place_id, created_by, created_nickname)
      values (p_place_name, p_address, p_lat, p_lng, nullif(p_kakao_id, ''), v_user,
              (select nickname from profiles where id = v_user))
      returning id into v_place_id;
    v_is_new := true;

    v_reward := 20;
    insert into points_ledger(user_id, amount, reason, ref_type, ref_id)
    values (v_user, v_reward, 'place_create', 'place', v_place_id::text);
    update profiles set point_balance = point_balance + v_reward where id = v_user;
  else
    -- 기존 가게에 카카오 ID가 비어 있으면 채워둠 (다음부터 더 정확히 매칭)
    if coalesce(p_kakao_id, '') <> '' then
      update places set kakao_place_id = p_kakao_id
       where id = v_place_id and coalesce(kakao_place_id, '') = '';
    end if;
  end if;

  return json_build_object('place_id', v_place_id, 'place_reward', v_reward, 'is_new_place', v_is_new);
end;
$$ language plpgsql security definer;


-- ============================================================
--  4. 제보 없는 유령 가게 정리
--     어떤 제보에서도 참조하지 않는 가게를 삭제합니다.
--     (병합 후 남은 껍데기 제거용)
-- ============================================================
create or replace function cleanup_empty_places()
returns int as $$
declare v_n int := 0;
begin
  delete from places p
   where not exists (select 1 from posts   x where x.place_id = p.id)
     and not exists (select 1 from posts   x where x.place_name = p.place_name)
     and not exists (select 1 from market_items m where m.place_name = p.place_name);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$ language plpgsql security definer;

revoke all on function cleanup_empty_places() from public;
revoke all on function cleanup_empty_places() from anon;
revoke all on function cleanup_empty_places() from authenticated;


-- ============================================================
--  실행 순서
--
--   select auto_merge_duplicate_places();   -- 이름 비슷한 중복 자동 병합
--   select cleanup_empty_places();          -- 아무도 안 쓰는 빈 가게 삭제
--   select * from place_duplicate_candidates;  -- 남은 건 눈으로 확인
--
--   이름이 아예 다른 쌍(예: 젬마젬마 / 잼나잼나)은 자동 병합되지 않습니다.
--   같은 가게가 맞다면 직접:
--     select merge_places('남길-id', '합칠-id');
-- ============================================================
