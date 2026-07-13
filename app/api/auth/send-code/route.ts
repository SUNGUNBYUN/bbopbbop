import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email) return NextResponse.json({ error: '이메일을 입력해주세요' }, { status: 400 })

  const { data: existing } = await supabase.auth.admin.listUsers()
  const alreadyExists = existing?.users?.some(u => u.email === email)
  if (alreadyExists) {
    return NextResponse.json({ error: '이미 가입된 이메일이에요' }, { status: 409 })
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await supabase.from('email_verifications').delete().eq('email', email)
  await supabase.from('email_verifications').insert({
    email, code, expires_at: expiresAt.toISOString(),
  })

  const { error } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: email,
    subject: '[뽑뽑] 이메일 인증번호',
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:40px 20px;">
        <h1 style="color:#FF5A5F;font-size:28px;margin-bottom:8px;">🧸 뽑뽑</h1>
        <p style="color:#4A4458;font-size:15px;margin-bottom:32px;">아래 인증번호를 입력해주세요.</p>
        <div style="background:#FFF0F0;border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
          <p style="font-size:42px;font-weight:800;color:#FF5A5F;letter-spacing:8px;margin:0;">${code}</p>
        </div>
        <p style="color:#8A8496;font-size:13px;text-align:center;">10분 안에 입력해주세요.</p>
      </div>
    `,
  })

  if (error) return NextResponse.json({ error: '이메일 발송 실패' }, { status: 500 })
  return NextResponse.json({ success: true })
}