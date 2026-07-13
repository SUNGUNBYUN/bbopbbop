import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '개인정보처리방침 — 뽑뽑',
}

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '40px 20px', fontFamily: 'sans-serif', color: '#1A1523', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>개인정보처리방침</h1>
      <p style={{ color: '#8A8496', fontSize: '13px', marginBottom: '40px' }}>시행일: 2025년 7월 1일</p>

      <p>
        <strong>[아트웍스]</strong>(이하 "회사")은 「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립·공개합니다.
      </p>

      <Section title="1. 수집하는 개인정보 항목 및 수집 방법">
        <p><strong>필수 수집 항목</strong></p>
        <ul>
          <li>이메일 주소 — 회원가입 및 로그인</li>
          <li>닉네임 — 서비스 이용 및 게시물 작성</li>
          <li>비밀번호 (암호화 저장)</li>
        </ul>
        <p><strong>선택 수집 항목</strong></p>
        <ul>
          <li>위치정보 — 주변 인형뽑기 업체 검색 (이용자 동의 시)</li>
          <li>사진 및 이미지 — 제보, 마켓, 피드 게시물 작성 시</li>
        </ul>
        <p><strong>자동 수집 항목</strong></p>
        <ul>
          <li>서비스 이용기록, 접속 로그, IP 주소</li>
          <li>기기 정보 (브라우저 종류, OS)</li>
        </ul>
        <p><strong>수집 방법</strong>: 홈페이지 회원가입, 서비스 이용 과정에서 자동 수집</p>
      </Section>

      <Section title="2. 개인정보의 수집 및 이용 목적">
        <ul>
          <li>회원 가입 및 관리, 본인 확인</li>
          <li>서비스 제공 (제보, 지도, 마켓, 피드, 채팅)</li>
          <li>부정 이용 방지 및 서비스 개선</li>
          <li>공지사항 전달 및 고객 지원</li>
        </ul>
      </Section>

      <Section title="3. 개인정보의 보유 및 이용 기간">
        <p>회원 탈퇴 시 즉시 삭제합니다. 단, 관련 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다.</p>
        <ul>
          <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)</li>
          <li>소비자 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)</li>
          <li>접속에 관한 기록: 3개월 (통신비밀보호법)</li>
        </ul>
      </Section>

      <Section title="4. 개인정보의 제3자 제공">
        <p>회사는 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다. 다만, 아래의 경우는 예외입니다.</p>
        <ul>
          <li>이용자가 사전에 동의한 경우</li>
          <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
        </ul>
      </Section>

      <Section title="5. 개인정보 처리 위탁">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#F7F5F2' }}>
              <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ECE9E4' }}>수탁업체</th>
              <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ECE9E4' }}>위탁 업무</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '10px', border: '1px solid #ECE9E4' }}>Supabase Inc.</td>
              <td style={{ padding: '10px', border: '1px solid #ECE9E4' }}>데이터베이스 및 인증 서비스 운영</td>
            </tr>
            <tr>
              <td style={{ padding: '10px', border: '1px solid #ECE9E4' }}>Resend Inc.</td>
              <td style={{ padding: '10px', border: '1px solid #ECE9E4' }}>이메일 발송 서비스</td>
            </tr>
            <tr>
              <td style={{ padding: '10px', border: '1px solid #ECE9E4' }}>Vercel Inc.</td>
              <td style={{ padding: '10px', border: '1px solid #ECE9E4' }}>서버 및 웹 호스팅</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="6. 이용자의 권리와 행사 방법">
        <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
        <ul>
          <li>개인정보 열람 요청</li>
          <li>오류 정정 요청</li>
          <li>삭제 요청</li>
          <li>처리 정지 요청</li>
        </ul>
        <p>권리 행사는 아래 개인정보 보호책임자에게 이메일로 요청하실 수 있으며, 지체 없이 조치하겠습니다.</p>
      </Section>

      <Section title="7. 개인정보 보호책임자">
        <ul>
          <li>성명: <strong>[변성훈]</strong></li>
          <li>상호: <strong>[아트웍스]</strong></li>
          <li>이메일: <strong>[tlgja005@naver.com]</strong></li>
          <li>사업자등록번호: <strong>[887-44-01206]</strong></li>
          <li>주소: <strong>[서울특별시 송파구 중대로 24, 212동]</strong></li>
        </ul>
      </Section>

      <Section title="8. 개인정보의 안전성 확보 조치">
        <ul>
          <li>비밀번호 암호화 저장</li>
          <li>HTTPS 보안 통신 적용</li>
          <li>Row Level Security(RLS)를 통한 접근 제어</li>
          <li>정기적인 보안 점검</li>
        </ul>
      </Section>

      <Section title="9. 개인정보처리방침 변경">
        <p>이 방침은 2025년 7월 1일부터 적용되며, 변경 시 앱 내 공지를 통해 사전 안내합니다.</p>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #ECE9E4' }}>{title}</h2>
      {children}
    </div>
  )
}