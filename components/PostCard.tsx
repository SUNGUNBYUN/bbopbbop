'use client'
import { Post } from '@/lib/types'
import { timeAgo, compactNumber } from '@/lib/utils'
import { Card, Stat } from './ui'

export function PostCard({ post, onClick }: { post: Post; onClick: () => void }) {
  return (
    <Card onClick={onClick} style={{ display: 'flex', gap: '13px', alignItems: 'stretch', padding: '12px' }}>
      {/* 썸네일 */}
      <div style={{
        width: '84px', height: '84px', borderRadius: 'var(--r-md)', flexShrink: 0,
        background: 'var(--surface-2)', overflow: 'hidden', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {post.image_url
          ? <img src={post.image_url} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: '30px', opacity: 0.5 }}>🧸</span>}
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <p style={{
            fontSize: '15px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px',
            lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{post.title}</p>

          {post.location && (
            <p style={{
              fontSize: '12.5px', color: 'var(--ink-3)', margin: '0 0 3px',
              display: 'flex', alignItems: 'center', gap: '3px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              <span style={{ flexShrink: 0 }}>📍</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.location}</span>
            </p>
          )}

          {post.tags && (
            <p style={{
              fontSize: '11.5px', color: 'var(--coral)', margin: 0, fontWeight: 600,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{post.tags}</p>
          )}
        </div>

        {/* 메타 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--ink-4)', fontWeight: 500 }}>
            {post.nickname ?? '익명'} · {timeAgo(post.created_at)}
          </span>
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <Stat icon="👁" value={compactNumber(post.view_count ?? 0)} />
            <Stat icon="❤️" value={compactNumber(post.like_count ?? 0)} />
          </div>
        </div>
      </div>
    </Card>
  )
}

/** 로딩 스켈레톤 */
export function PostCardSkeleton() {
  return (
    <div style={{ display: 'flex', gap: '13px', padding: '12px', background: 'var(--surface)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="skeleton" style={{ width: '84px', height: '84px', borderRadius: 'var(--r-md)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
        <div className="skeleton" style={{ width: '70%', height: '15px' }} />
        <div className="skeleton" style={{ width: '50%', height: '12px' }} />
        <div className="skeleton" style={{ width: '40%', height: '11px', marginTop: 'auto' }} />
      </div>
    </div>
  )
}
