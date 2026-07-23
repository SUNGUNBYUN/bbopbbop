-- ============================================================
--  최소 사용자 정보 (선택 입력) — 성별 · 연령대 · 지역
--
--  향후 타깃·통계·광고 기획용. 자가입력, 본인인증 불필요.
--  포인트 잔액 등 민감 컬럼이 노출되지 않도록, 이 3개 컬럼만
--  바꾸는 security definer 함수로만 수정한다.
--
--  Supabase SQL Editor에서 실행. 여러 번 실행해도 안전.
-- ============================================================

alter table profiles add column if not exists gender    text;   -- male / female / other
alter table profiles add column if not exists age_group text;   -- 10s / 20s / 30s / 40s+
alter table profiles add column if not exists region    text;   -- 서울 / 경기·인천 / ...

-- 내 정보만 안전하게 수정 (다른 컬럼은 못 건드림)
create or replace function update_my_info(p_gender text, p_age_group text, p_region text)
returns void as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;
  update profiles
     set gender    = nullif(btrim(coalesce(p_gender, '')), ''),
         age_group = nullif(btrim(coalesce(p_age_group, '')), ''),
         region    = nullif(btrim(coalesce(p_region, '')), '')
   where id = auth.uid();
end;
$$ language plpgsql security definer;
