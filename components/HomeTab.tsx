'use client'
import { useState, useMemo } from 'react'
import { Post, SortKey } from '@/lib/types'
import { PostCard, PostCardSkeleton } from './PostCard'
import { EmptyState, Button } from './ui'

type Props = {
  posts: Post[]
  loading: boolean
  onSelectPost: (post: Post) => void
  onNewPost: () => void
  onOpenBounty: () => void
  openBountyCount?: number
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: '최신순' },
  { key: 'popular', label: '인기순' },
  { key: 'comments', label: '댓글순' },
]

export function HomeTab({ posts, loading, onSelectPost, onNewPost, onOpenBounty, openBountyCount = 0 }: Props) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  // 인기 태그 추출
  const popularTags = useMemo(() => {
    const counts: Record<string, number> = {}
    posts.forEach(p => {
      (p.tags ?? '').split(/[\s,#]+/).filter(Boolean).forEach(t => {
        counts[t] = (counts[t] ?? 0) + 1
      })
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t)
  }, [posts])

  const filtered = useMemo(() => {
    // 제목·장소뿐 아니라 기계에 든 인형 목록과 태그까지 검색
    const q = search.trim()
    let list = q === '' ? posts : posts.filter(p =>
      p.title.includes(q)
      || (p.location ?? '').includes(q)
      || (p.place_name ?? '').includes(q)
      || (p.tags ?? '').includes(q)
      || (p.products ?? []).some(x => x.includes(q))
    )
    if (activeTag) list = list.filter(p => (p.tags ?? '').includes(activeTag))
    if (sort === 'popular') list = [...list].sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0))
    else if (sort === 'comments') list = [...list].sort((a, b) => (b.comment_count ?? 0) - (a.comment_count ?? 0))
    else list = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return list
  }, [posts, search, activeTag, sort])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* 검색 바 */}
      <div style={{ padding: '12px 16px 10px', background: 'var(--surface)', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            placeholder="인형 이름, 업체명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '12px 14px 12px 42px', borderRadius: 'var(--r-full)',
              border: 'none', background: 'var(--surface-2)', fontSize: '14.5px',
              outline: 'none', boxSizing: 'border-box', color: 'var(--ink)',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'var(--surface-3)', border: 'none', width: '20px', height: '20px', borderRadius: '50%', color: 'var(--ink-3)', fontSize: '11px', cursor: 'pointer' }}>✕</button>
          )}
        </div>

        {/* 인기 태그 */}
        {popularTags.length > 0 && (
          <div className="no-scrollbar" style={{ display: 'flex', gap: '7px', marginTop: '11px', overflowX: 'auto' }}>
            {activeTag && (
              <button
                onClick={() => setActiveTag(null)}
                style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 'var(--r-full)', border: 'none', background: 'var(--ink)', color: '#fff', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
              >✕ 전체</button>
            )}
            {popularTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                style={{
                  flexShrink: 0, padding: '6px 12px', borderRadius: 'var(--r-full)',
                  border: 'none', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
                  background: activeTag === tag ? 'var(--coral)' : 'var(--surface-2)',
                  color: activeTag === tag ? '#fff' : 'var(--ink-2)',
                }}
              >#{tag}</button>
            ))}
          </div>
        )}
      </div>

      {/* 현상금 진입 */}
      <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
        <button
          onClick={onOpenBounty}
          className="pressable"
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '13px 15px', borderRadius: 'var(--r-md)',
            border: '1.5px solid var(--coral)', background: 'var(--coral-soft)',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: '20px', flexShrink: 0 }}>🎯</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 2px' }}>
              제보 현상금
              {openBountyCount > 0 && (
                <span style={{ marginLeft: '6px', fontSize: '11.5px', fontWeight: 800, color: '#fff', background: 'var(--coral)', padding: '2px 7px', borderRadius: 'var(--r-full)' }}>
                  {openBountyCount}
                </span>
              )}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: 0 }}>
              포인트를 걸고 찾는 인형을 물어보세요
            </p>
          </div>
          <span style={{ fontSize: '13px', color: 'var(--coral)', fontWeight: 700, flexShrink: 0 }}>›</span>
        </button>
      </div>

      {/* 정렬 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 4px', flexShrink: 0 }}>
        <span style={{ fontSize: '12.5px', color: 'var(--ink-3)', fontWeight: 500 }}>
          {filtered.length > 0 && `${filtered.length}개의 제보`}
        </span>
        <div style={{ display: 'flex', gap: '3px' }}>
          {SORTS.map(s => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              style={{
                padding: '5px 11px', borderRadius: 'var(--r-full)', border: 'none', cursor: 'pointer',
                fontSize: '12.5px', fontWeight: sort === s.key ? 700 : 500,
                background: sort === s.key ? 'var(--coral-soft)' : 'transparent',
                color: sort === s.key ? 'var(--coral)' : 'var(--ink-3)',
              }}
            >{s.label}</button>
          ))}
        </div>
      </div>

      {/* 리스트 */}
      <main className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 90px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <PostCardSkeleton key={i} />)
        ) : filtered.length === 0 ? (
          search || activeTag ? (
            <EmptyState emoji="🔍" title="검색 결과가 없어요" desc="다른 키워드로 찾아보거나 직접 제보해보세요" />
          ) : (
            <EmptyState
              emoji="🧸" title="아직 제보가 없어요"
              desc="내 주변에서 발견한 인형뽑기를 제일 먼저 알려주세요!"
              action={<Button onClick={onNewPost}>+ 첫 제보 올리기</Button>}
            />
          )
        ) : (
          filtered.map((post, i) => (
            <div key={post.id} className="animate-fade" style={{ animationDelay: `${Math.min(i * 0.03, 0.3)}s`, animationFillMode: 'backwards' }}>
              <PostCard post={post} onClick={() => onSelectPost(post)} />
            </div>
          ))
        )}
      </main>
    </div>
  )
}
