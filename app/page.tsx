'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type Post = {
  id: string
  title: string
  location: string | null
  tags: string | null
  image_url: string | null
  created_at: string
}

type Errors = {
  image?: string
  title?: string
  location?: string
}

export default function Home() {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [tags, setTags] = useState('')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchPosts() }, [])

  async function fetchPosts() {
    setLoading(true)
    const { data } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setPosts(data)
    setLoading(false)
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setErrors(prev => ({ ...prev, image: undefined }))
  }

  function handleImageRemove(e: React.MouseEvent) {
    e.stopPropagation()
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function validate() {
    const newErrors: Errors = {}
    if (!imageFile) newErrors.image = '사진을 추가해주세요'
    if (!title.trim()) newErrors.title = '뭐가 있는지 알려주세요'
    if (!location.trim()) newErrors.location = '업체 위치를 입력해주세요'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setUploading(true)

    let image_url = null

    if (imageFile) {
      const fileName = `${Date.now()}_${imageFile.name}`
      const { data, error } = await supabase.storage
        .from('images')
        .upload(fileName, imageFile)
      if (!error && data) {
        const { data: urlData } = supabase.storage
          .from('images')
          .getPublicUrl(data.path)
        image_url = urlData.publicUrl
      }
    }

    const { error } = await supabase
      .from('posts')
      .insert({ title, location, tags, image_url })

    if (!error) {
      setTitle('')
      setLocation('')
      setTags('')
      setImageFile(null)
      setImagePreview(null)
      setErrors({})
      setShowForm(false)
      fetchPosts()
    }
    setUploading(false)
  }

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
          <button onClick={() => { setShowForm(false); setImagePreview(null); setImageFile(null); setErrors({}) }} style={{ fontSize: '14px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>취소</button>
          <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>제보하기</h2>
          <button
            onClick={handleSubmit}
            disabled={uploading}
            style={{ fontSize: '14px', color: '#fff', fontWeight: '600', background: '#FF6B6B', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: '20px', opacity: uploading ? 0.6 : 1 }}
          >
            {uploading ? '올리는 중...' : '올리기'}
          </button>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 사진 */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>
              사진 <span style={{ color: '#FF6B6B' }}>*</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{ width: '100%', height: '200px', borderRadius: '16px', border: errors.image ? '2px dashed #FF6B6B' : imagePreview ? 'none' : '2px dashed #f0f0f0', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}
            >
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="미리보기" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    onClick={handleImageRemove}
                    style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >✕</button>
                  <div style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '11px', padding: '4px 8px', borderRadius: '8px' }}>탭해서 변경</div>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '36px' }}>📷</span>
                  <p style={{ fontSize: '14px', color: errors.image ? '#FF6B6B' : '#aaa', margin: '8px 0 0' }}>사진 추가하기</p>
                  <p style={{ fontSize: '12px', color: '#ccc', margin: '4px 0 0' }}>탭해서 사진 선택</p>
                </>
              )}
            </div>
            {errors.image && (
              <p style={{ fontSize: '12px', color: '#FF6B6B', margin: '6px 0 0' }}>⚠ {errors.image}</p>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
          </div>

          {/* 뭐가 있어요 */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>
              뭐가 있어요? <span style={{ color: '#FF6B6B' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="예) 피카츄 인형, 산리오 가챠"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setErrors(prev => ({ ...prev, title: undefined })) }}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: `1.5px solid ${errors.title ? '#FF6B6B' : title ? '#FF6B6B' : '#f0f0f0'}`, fontSize: '14px', outline: 'none', backgroundColor: '#fafafa', boxSizing: 'border-box' }}
            />
            {errors.title && (
              <p style={{ fontSize: '12px', color: '#FF6B6B', margin: '6px 0 0' }}>⚠ {errors.title}</p>
            )}
          </div>

          {/* 업체 위치 */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>
              업체 위치 <span style={{ color: '#FF6B6B' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="예) 홍대 뽑기왕 2층"
              value={location}
              onChange={(e) => { setLocation(e.target.value); setErrors(prev => ({ ...prev, location: undefined })) }}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: `1.5px solid ${errors.location ? '#FF6B6B' : location ? '#FF6B6B' : '#f0f0f0'}`, fontSize: '14px', outline: 'none', backgroundColor: '#fafafa', boxSizing: 'border-box' }}
            />
            {errors.location && (
              <p style={{ fontSize: '12px', color: '#FF6B6B', margin: '6px 0 0' }}>⚠ {errors.location}</p>
            )}
          </div>

          {/* 태그 */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>
              태그 <span style={{ fontSize: '11px', color: '#aaa', fontWeight: '400' }}>선택</span>
            </label>
            <input
              type="text"
              placeholder="#피카츄 #포켓몬"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #f0f0f0', fontSize: '14px', outline: 'none', backgroundColor: '#fafafa', boxSizing: 'border-box' }}
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
          style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #f0f0f0', backgroundColor: '#fafafa', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
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
              <div style={{ width: '64px', height: '64px', borderRadius: '12px', backgroundColor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
                {item.image_url ? (
                  <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '28px' }}>🧸</span>
                )}
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
          <button key={item.label} onClick={() => setActiveTab(i)} style={{ flex: 1, padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: '20px' }}>{item.icon}</span>
            <span style={{ fontSize: '11px', color: activeTab === i ? '#FF6B6B' : '#888', fontWeight: activeTab === i ? '600' : '400' }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}