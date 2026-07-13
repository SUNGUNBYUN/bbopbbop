import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '이용약관 — 뽑뽑',
}

export default function TermsPage() {
  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '40px 20px', fontFamily: 'sans-serif', color: '#1A1523', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>이용약관</h1>
      <p style={{ color: '#8A8496', fontSize: '13px', marginBottom: '40px' }}>시행일: 2025년 7월 1일</p>

      <Section title="제1조 (목적)">
        <p>이 약관은 <strong>[아트웍스]</strong>(이하 "회사")이 운영하는 뽑뽑 서비스(이하 "서비스")의 이용 조건 및 절차, 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.</p>
      </Section>

      <Section title="제2조 (정의)">
        <ul>
          <li>"서비스"란 회사가 제공하는 인형뽑기 제보·지도·마켓·피드·채팅 등 일체의 서비스를 말합니다.</li>
          <li>"이용자"란 본 약관에 동의하고 서비스를 이용하는 자를 말합니다.</li>
          <li>"회원"이란 이메일 인증을 통해 가입한 이용자를 말합니다.</li>
          <li>"게시물"이란 이용자가 서비스에 올린 글, 사진, 댓글 등 모든 콘텐츠를 말합니다.</li>
        </ul>
      </Section>

      <Section title="제3조 (약관의 효력 및 변경)">
        <ul>
          <li>이 약관은 서비스 화면에 게시하거나 이용자에게 공지함으로써 효력이 발생합니다.</li>
          <li>회사는 관련 법령에 위배되지 않는 범위에서 약관을 개정할 수 있으며, 변경 시 7일 전 공지합니다.</li>
        </ul>
      </Section>

      <Section title="제4조 (회원가입)">
        <ul>
          <li>이용자는 이메일 인증을 통해 회원가입을 신청할 수 있습니다.</li>
          <li>1인 1계정 원칙이며, 타인의 정보를 도용한 가입은 금지됩니다.</li>
          <li>만 14세 미만은 가입할 수 없습니다.</li>
        </ul>
      </Section>

      <Section title="제5조 (서비스 이용)">
        <ul>
          <li>서비스는 연중무휴 24시간 제공을 원칙으로 하나, 시스템 점검·장애 등으로 일시 중단될 수 있습니다.</li>
          <li>회사는 서비스 내용을 변경하거나 종료할 수 있으며, 사전에 공지합니다.</li>
        </ul>
      </Section>

      <Section title="제6조 (이용자의 의무)">
        <p>이용자는 다음 행위를 해서는 안 됩니다.</p>
        <ul>
          <li>타인의 정보 도용 및 허위 정보 등록</li>
          <li>타인을 비방·모욕하거나 명예를 훼손하는 행위</li>
          <li>음란물, 폭력적 콘텐츠 게시</li>
          <li>스팸, 광고, 사기성 게시물 작성</li>
          <li>서비스 운영을 방해하는 행위</li>
          <li>지적재산권을 침해하는 행위</li>
          <li>관련 법령에 위반되는 행위</li>
        </ul>
      </Section>

      <Section title="제7조 (게시물의 관리)">
        <ul>
          <li>이용자가 작성한 게시물의 저작권은 이용자에게 있습니다.</li>
          <li>이용자는 게시물을 서비스에 게시함으로써 회사가 서비스 운영 목적으로 이를 사용할 수 있는 권리를 부여합니다.</li>
          <li>회사는 제6조를 위반한 게시물을 사전 통지 없이 삭제할 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="제8조 (회원 탈퇴 및 자격 정지)">
        <ul>
          <li>회원은 언제든지 탈퇴를 요청할 수 있으며, 즉시 처리됩니다.</li>
          <li>회사는 제6조를 위반한 회원의 서비스 이용을 제한하거나 강제 탈퇴시킬 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="제9조 (책임의 제한)">
        <ul>
          <li>회사는 천재지변, 불가항력적 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다.</li>
          <li>회사는 이용자 간 거래(마켓)에서 발생한 분쟁에 개입하지 않으며 책임을 지지 않습니다.</li>
          <li>이용자가 게시한 정보의 정확성에 대해 회사는 책임을 지지 않습니다.</li>
        </ul>
      </Section>

      <Section title="제10조 (분쟁 해결)">
        <ul>
          <li>서비스 이용과 관련하여 분쟁이 발생한 경우 회사와 이용자는 상호 협의하여 해결합니다.</li>
          <li>협의가 이루어지지 않을 경우 회사 소재지 관할 법원을 전속 관할 법원으로 합니다.</li>
        </ul>
      </Section>

      <Section title="제11조 (운영자 정보)">
        <ul>
          <li>상호: <strong>[아트웍스]</strong></li>
          <li>대표자: <strong>[변성훈]</strong></li>
          <li>사업자등록번호: <strong>[887-44-01206]</strong></li>
          <li>주소: <strong>[서울특별시 송파구 중대로 24, 212동]</strong></li>
          <li>이메일: <strong>[tlgja005@naver.com]</strong></li>
          <li>업태/종목: 소매업 / 전자상거래 소매업</li>
        </ul>
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