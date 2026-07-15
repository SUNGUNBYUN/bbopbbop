-- ============================================================
--  뽑뽑 Storage 업로드 권한 수정
--  증상: 사진 업로드 시 "new row violates row-level security policy"
--  원인: images 버킷(storage.objects)에 insert 허용 정책이 없음
--  ⚠️ Supabase SQL Editor에서 실행
-- ============================================================

-- 1) images 버킷을 Public으로 (조회 가능하게)
update storage.buckets set public = true where id = 'images';

-- 버킷이 아예 없다면 생성(있으면 무시)
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update set public = true;


-- 2) storage.objects RLS 정책 (images 버킷 한정)
--    - 조회: 누구나 (public 버킷이므로)
--    - 업로드/수정/삭제: 로그인한 사용자

drop policy if exists "images 공개 조회" on storage.objects;
create policy "images 공개 조회" on storage.objects
  for select using ( bucket_id = 'images' );

drop policy if exists "images 로그인 업로드" on storage.objects;
create policy "images 로그인 업로드" on storage.objects
  for insert with check ( bucket_id = 'images' and auth.role() = 'authenticated' );

drop policy if exists "images 로그인 수정" on storage.objects;
create policy "images 로그인 수정" on storage.objects
  for update using ( bucket_id = 'images' and auth.role() = 'authenticated' );

drop policy if exists "images 본인 삭제" on storage.objects;
create policy "images 본인 삭제" on storage.objects
  for delete using ( bucket_id = 'images' and auth.role() = 'authenticated' );


-- ============================================================
--  완료! 이제 로그인 유저가 images 버킷에 사진을 올릴 수 있어요.
-- ============================================================
