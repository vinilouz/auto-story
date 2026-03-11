import fs from 'fs/promises'
import path from 'path'

const ANONDROP_BASE = 'https://anondrop.net'

/**
 * Uploads a base64 image to AnonDrop and returns the public URL.
 * Air provider cannot accept base64 — all reference images must be hosted URLs.
 */
export async function uploadToAnonDrop(base64Data: string, filename?: string): Promise<string> {
  const key = process.env.ANONDROP_KEY
  if (!key) throw new Error('ANONDROP_KEY not set')

  // Strip data URL prefix if present
  let raw = base64Data
  let mimeType = 'image/png'
  const match = raw.match(/^data:([^;]+);base64,(.+)$/)
  if (match) {
    mimeType = match[1]
    raw = match[2]
  }

  const buffer = Buffer.from(raw, 'base64')
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
  const name = filename || `ref-${Date.now()}.${ext}`

  const form = new FormData()
  form.append('file', new Blob([buffer], { type: mimeType }), name)

  const res = await fetch(`${ANONDROP_BASE}/upload?key=${key}`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`AnonDrop upload failed: ${res.status} ${text.substring(0, 200)}`)
  }

  const data = await res.json()

  // Response contains the file ID/path — construct the public URL
  const fileId = data.id || data.fileId || data.file_id
  if (!fileId) {
    // Try to find URL directly in response
    const url = data.url || data.download_url || data.direct_url
    if (url) return url
    throw new Error(`AnonDrop: no file ID in response: ${JSON.stringify(data).substring(0, 200)}`)
  }

  return `${ANONDROP_BASE}/${fileId}/img.png`
}

/**
 * Upload from a remote URL via AnonDrop's remote upload.
 */
export async function remoteUploadToAnonDrop(sourceUrl: string, filename?: string): Promise<string> {
  const key = process.env.ANONDROP_KEY
  if (!key) throw new Error('ANONDROP_KEY not set')

  const name = filename || `ref-${Date.now()}.png`
  const res = await fetch(
    `${ANONDROP_BASE}/remoteuploadurl?key=${key}&url=${encodeURIComponent(sourceUrl)}&filename=${encodeURIComponent(name)}`
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`AnonDrop remote upload failed: ${res.status} ${text.substring(0, 200)}`)
  }

  const data = await res.json()
  const fileId = data.id || data.fileId || data.file_id
  if (!fileId) {
    const url = data.url || data.download_url || data.direct_url
    if (url) return url
    throw new Error(`AnonDrop: no file ID in response`)
  }

  return `${ANONDROP_BASE}/${fileId}/img.png`
}

/**
 * Ensures a URL is a hosted public URL (not base64).
 * If it's base64, uploads to AnonDrop first.
 * If it's already a URL, returns as-is.
 */
export async function ensureHostedUrl(urlOrBase64: string): Promise<string> {
  if (urlOrBase64.startsWith('http://') || urlOrBase64.startsWith('https://')) {
    return urlOrBase64
  }
  if (urlOrBase64.startsWith('data:') || (!urlOrBase64.includes(' ') && urlOrBase64.length > 200)) {
    return uploadToAnonDrop(urlOrBase64)
  }
  if (urlOrBase64.startsWith('/')) {
    const filePath = path.join(process.cwd(), 'public', urlOrBase64)
    const buf = await fs.readFile(filePath)
    const ext = path.extname(urlOrBase64).replace('.', '')
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext || 'png'}`
    const base64 = `data:${mime};base64,${buf.toString('base64')}`
    return uploadToAnonDrop(base64, path.basename(urlOrBase64))
  }
  throw new Error(`Cannot resolve to hosted URL: ${urlOrBase64.substring(0, 80)}`)
}