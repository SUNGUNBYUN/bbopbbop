# 🧸 뽑뽑 — 어디서 뭘 뽑지?

내 주변 인형뽑기 제보부터 자랑, 중고거래까지. 뽑기 덕후들의 지도.

## 기술 스택

- **Frontend**: Next.js 16 + React 19 + TypeScript
- **Backend**: Supabase (DB + Auth + Storage)
- **지도**: 카카오맵 API
- **폰트**: Pretendard (가변폰트)
- **배포**: Vercel 권장

## 주요 기능

| 탭 | 기능 |
|---|---|
| 🔍 제보 | 업체 제보, 검색/필터/정렬, 좋아요, 댓글, 이미지 최대 5장 |
| 🗺️ 지도 | 카카오맵 주변 업체 마커, 제보 연동 |
| 🛍️ 마켓 | 중고거래, 찜, 문의, 상태 관리 |
| 📸 피드 | 자랑 피드, 좋아요, 댓글 |
| 기타 | 1:1 채팅, 알림, 신고/차단, 마이페이지 |

## 시작하기

### 1. 환경변수 설정

`.env.local` 파일 생성:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_KAKAO_APP_KEY=your-kakao-app-key
```

### 2. Supabase DB 설정

Supabase 대시보드 → **SQL Editor** → `SUPABASE_SETUP.sql` 내용 붙여넣고 실행

### 3. Supabase Storage 설정

대시보드 → Storage → `images` 버킷 생성 → Public 버킷으로 설정

### 4. 카카오맵 설정

[카카오 개발자](https://developers.kakao.com) → 내 앱 → 플랫폼 → Web → 사이트 도메인 등록

### 5. 로컬 실행

```bash
npm install
npm run dev
```

## 배포 (Vercel)

```bash
npm run build  # 빌드 확인
```

Vercel 대시보드에서 GitHub 연결 후 환경변수 설정하면 자동 배포.

## 폴더 구조

```
app/          # Next.js 페이지 및 기존 탭 컴포넌트
components/   # 재사용 UI 컴포넌트
lib/          # 유틸, 타입, Supabase, 소셜 기능
public/       # 정적 파일 (아이콘, manifest)
```
