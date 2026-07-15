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

// 업로드 전 이미지 압축/리사이즈 (Canvas 사용, 추가 라이브러리 불필요)
// 폰 사진(수 MB)을 긴 변 maxSize 이하 + JPEG 품질로 줄여 업로드 실패/용량 문제 방지.
async function compressImage(file: File, maxSize = 1600, quality = 0.82): Promise<Blob> {
  if (file.size < 500 * 1024) return file // 이미 작으면 그대로

  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const image: HTMLImageElement = await new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = reject
    im.src = dataUrl
  })

  let width = image.width
  let height = image.height
  if (width > maxSize || height > maxSize) {
    if (width >= height) { height = Math.round(height * (maxSize / width)); width = maxSize }
    else { width = Math.round(width * (maxSize / height)); height = maxSize }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(image, 0, 0, width, height)

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  )
  if (!blob || blob.size >= file.size) return file // 압축 결과가 없거나 더 크면 원본
  return blob
}

// 여러 이미지를 Supabase Storage에 업로드하고 URL 배열 반환 (자동 압축 포함)
export async function uploadImages(
  supabase: any,
  images: ImageSlot[],
  prefix = ''
): Promise<string[]> {
  const urls: string[] = []
  for (const img of images) {
    let body: Blob = img.file
    try { body = await compressImage(img.file) } catch { body = img.file }

    const fileName = `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`
    const { data, error } = await supabase.storage.from('images').upload(fileName, body, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/jpeg',
    })
    if (error) {
      console.error('[uploadImages] 업로드 실패:', error)
      throw new Error(`사진 업로드 실패: ${error.message}`)
    }
    if (data) {
      const { data: urlData } = supabase.storage.from('images').getPublicUrl(data.path)
      urls.push(urlData.publicUrl)
    }
  }
  return urls
}
