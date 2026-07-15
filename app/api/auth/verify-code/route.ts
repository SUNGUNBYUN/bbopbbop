import { NextResponse } from 'next/server'

// ⚠️ 더 이상 사용하지 않음. 이메일 인증은 Supabase OTP로 전환됨(app/Auth.tsx).
// 이 라우트는 하위호환용 빈 응답만 반환한다. (폴더째 삭제해도 무방)
export async function POST() {
  return NextResponse.json({ error: '이 방식은 더 이상 사용하지 않아요' }, { status: 410 })
}
