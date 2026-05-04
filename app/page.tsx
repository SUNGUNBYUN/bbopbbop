'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Post = {
  id: string
  title: string
  location: string | null
  tags: string | null
  created_at: string
}

export default function Home() {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [tags, setTags] = useState('')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  // 데이터 불러오기
  useEffect(() => {
    fetchPosts()
  }, [])

  async function fetchPosts() {
    setLoading(true)
    const { data } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setPosts(data)
    setLoading(false)
  }

  // 제보 등록
  async function handleSubmit() {
    if (!title) return
    const { error } = await supabase
      .from('posts')
      .insert({ title, location, tags })
    if (!error) {
      setTitle('')
      setLocation('')
      setTags('')
      setShowForm(false)
      fetchPosts()
    }
  }

  // 시간 표시
  function timeAgo(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return '방금 전'
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
    return `${Math.floor(diff / 86400)}일 전`
  }

  const filtered = posts.filter(p =>
    p.title.includes(search) || (p.location ?? '').includes(search)
  )

  if (showForm) {
    return (
      <div style={{ maxWidth: '430px', margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
        <header style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setShowForm(false)} style={{ fontSize: '14px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>취소</button>
          <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>제보하기</h2>
          <button onClick={handleSubmit} style={{ fontSize: '14px', color: title ? '#FF6B6B' : '#ccc', fontWeight: '600', background: 'none', border: 'none', cursor: title ? 'pointer' : 'default' }}>올리기</button>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ width: '100%', height: '180px', borderRadius: '12px', border: '2px dashed #f0f0f0', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: '8px' }}>
            <span style={{ fontSize: '36px' }}>📷</span>
            <p style={{ fontSize: '14px', color: '#aaa', margin: 0 }}>사진 추가 (필수)</p>
            <p style={{ fontSize: '12px', color: '#ccc', margin: 0 }}>최대 3장</p>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>제목 <span style={{ color: '#FF6B6B' }}>*</span></label>
            <input
              type="text"
              placeholder="예) 피카츄 소형 인형 있어요!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #f0f0f0', fontSize: '14px', outline: 'none', backgroundColor: '#fafafa' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>업체 위치 <span style={{ fontSize: '11px', color: '#aaa', fontWeight: '400' }}>선택</span></label>
            <input
              type="text"
              placeholder="예) 홍대 뽑기왕 2층"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #f0f0f0', fontSize: '14px', outline: 'none', backgroundColor: '#fafafa' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>태그 <span style={{ fontSize: '11px', color: '#aaa', fontWeight: '400' }}>선택</span></label>
            <input
              type="text"
              placeholder="#피카츄 #포켓몬"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #f0f0f0', fontSize: '14px', outline: 'none', backgroundColor: '#fafafa' }}
            />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '430px', margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
      <header style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#FF6B6B', margin: 0 }}>🧸 뽑뽑</h1>
        <button style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>로그인</button>
      </header>

      <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0' }}>
        <input
          type="text"
          placeholder="🔍  인형 이름, 업체명으로 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #f0f0f0', backgroundColor: '#fafafa', fontSize: '14px', outline: 'none' }}
        />
      </div>

      <main style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <p style={{ color: '#aaa', textAlign: 'center', marginTop: '40px' }}>불러오는 중... 🔄</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: '#aaa', textAlign: 'center', marginTop: '40px' }}>
            {search ? '검색 결과가 없어요 😢' : '아직 제보가 없어요. 첫 번째로 제보해보세요! 🎯'}
          </p>
        ) : (
          filtered.map(item => (
            <div key={item.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', borderRadius: '12px', border: '1px solid #f0f0f0', cursor: 'pointer' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '10px', backgroundColor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0 }}>
                🧸
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: '600', color: '#222', margin: '0 0 4px' }}>{item.title}</p>
                {item.location && <p style={{ fontSize: '12px', color: '#888', margin: '0 0 2px' }}>📍 {item.location}</p>}
                {item.tags && <p style={{ fontSize: '11px', color: '#FF6B6B', margin: '0 0 2px' }}>{item.tags}</p>}
                <p style={{ fontSize: '11px', color: '#bbb', margin: 0 }}>{timeAgo(item.created_at)}</p>
              </div>
            </div>
          ))
        )}
      </main>

      <button
        onClick={() => setShowForm(true)}
        style={{ position: 'fixed', bottom: '72px', right: 'calc(50% - 215px + 20px)', width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#FF6B6B', color: '#fff', fontSize: '24px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,107,107,0.4)' }}>
        +
      </button>

      <nav style={{ borderTop: '1px solid #f0f0f0', display: 'flex', backgroundColor: '#fff' }}>
        {[
          { icon: '🔍', label: '검색' },
          { icon: '🗺️', label: '지도' },
          { icon: '🛍️', label: '마켓' },
          { icon: '📸', label: '피드' },
        ].map((item, i) => (
          <button key={item.label} style={{ flex: 1, padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: '20px' }}>{item.icon}</span>
            <span style={{ fontSize: '11px', color: i === 0 ? '#FF6B6B' : '#888', fontWeight: i === 0 ? '600' : '400' }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}