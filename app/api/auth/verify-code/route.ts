import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { email, code, password, nickname } = await req.json()

  if (!email || !code || !password || !nickname) {
    return NextResponse.json({ error: '모든 항목을 입력해주세요' }, { status: 400 })
  }

  const { data: verification } = await supabase
    .from('email_verifications')
    .select('*')
    .eq('email', email)
    .eq('code', code)
    .eq('verified', false)
    .gte('expires_at', new Date().toISOString())
    .single()

  if (!verification) {
    return NextResponse.json({ error: '인증번호가 틀렸거나 만료됐어요' }, { status: 400 })
  }

  const { error: signUpError } = await supabase.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { nickname },
  })

  if (signUpError) {
    return NextResponse.json({ error: '가입 중 오류가 발생했어요' }, { status: 500 })
  }

  await supabase.from('email_verifications').update({ verified: true }).eq('id', verification.id)
  return NextResponse.json({ success: true })
}