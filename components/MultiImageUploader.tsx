'use client'
import { useRef } from 'react'

export type ImageSlot = { file: File; preview: string }

type Props = {
  images: ImageSlot[]
  onChange: (images: ImageSlot[]) => void
  max?: number
  error?: boolean
}

export function MultiImageUploader({ images, onChange, max = 5, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const remaining = max - images.length
    const next = files.slice(0, remaining).map(file => ({ file, preview: URL.createObjectURL(file) }))
    onChange([...images, ...next])
    if (inputRef.current) inputRef.current.value = ''
  }

  function remove(idx: number) {
    onChange(images.filter((_, i) => i !== idx))
  }

  return (
    <div className="no-scrollbar" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '2px' }}>
      {/* 추가 버튼 */}
      {images.length < max && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="pressable"
          style={{
            width: '92px', height: '92px', borderRadius: 'var(--r-md)', flexShrink: 0,
            border: `2px dashed ${error ? 'var(--danger)' : 'var(--line-2)'}`,
            background: 'var(--surface-2)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: '4px',
          }}
        >
          <span style={{ fontSize: '24px' }}>📷</span>
          <span style={{ fontSize: '11px', color: error ? 'var(--danger)' : 'var(--ink-3)', fontWeight: 600 }}>
            {images.length}/{max}
          </span>
        </button>
      )}

      {/* 미리보기 */}
      {images.map((img, i) => (
        <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
          <img
            src={img.preview}
            alt={`사진 ${i + 1}`}
            style={{ width: '92px', height: '92px', borderRadius: 'var(--r-md)', objectFit: 'cover' }}
          />
          {i === 0 && (
            <span style={{
              position: 'absolute', bottom: '5px', left: '5px', background: 'var(--coral)',
              color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: 'var(--r-full)',
            }}>대표</span>
          )}
          <button
            type="button"
            onClick={() => remove(i)}
            style={{
              position: 'absolute', top: '5px', right: '5px', width: '22px', height: '22px',
              borderRadius: '50%', background: 'rgba(26,21,35,0.65)', color: '#fff',
              fontSize: '11px', border: 'none', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>
      ))}

      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleSelect} style={{ display: 'none' }} />
    </div>
  )
}

/** 여러 이미지를 Supabase Storage에 업로드하고 URL 배열 반환 */
export async function uploadImages(
  supabase: any,
  images: ImageSlot[],
  prefix = ''
): Promise<string[]> {
  const urls: string[] = []
  for (const img of images) {
    const fileName = `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${img.file.name}`
    const { data, error } = await supabase.storage.from('images').upload(fileName, img.file)
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('images').getPublicUrl(data.path)
      urls.push(urlData.publicUrl)
    }
  }
  return urls
}
