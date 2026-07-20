import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 이미지 외부 도메인 허용 (Supabase storage)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // 보안 헤더 + 캐시 정책
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      // 페이지(HTML)는 캐시하지 않음.
      // 사파리가 예전 HTML을 들고 있으면 새 배포 후 사라진 JS를 찾다가
      // 앱이 멈추거나 예전 화면이 뜨는 문제가 생겨요.
      {
        source: '/',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/privacy',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/terms',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      // 해시가 붙은 정적 파일은 오래 캐시해도 안전
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default nextConfig;
