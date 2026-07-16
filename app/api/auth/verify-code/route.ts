import { NextResponse } from 'next/server'

// 이 라우트는 더 이상 사용하지 않음. 인증은 Supabase OTP로 전환됨(app/Auth.tsx).
export async function POST() {
  return NextResponse.json({ error: '이 방식은 더 이상 사용하지 않아요' }, { status: 410 })
}
