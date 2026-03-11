import { registerProvider, ImageRequest, ImageResponse, VideoRequest, VideoResponse } from '@/lib/ai/registry'
import { ensureHostedUrl } from '@/lib/ai/utils/anondrop'

// ── SSE parser ─────────────────────────────────────────────

async function parseSSE(response: Response): Promise<any[]> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''
  const events: any[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value)
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() || ''

    for (const chunk of chunks) {
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (raw === '[DONE]' || raw === ': keepalive' || !raw) continue
        try { events.push(JSON.parse(raw)) } catch { }
      }
    }
  }

  return events
}

function extractUrl(events: any[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (e?.data?.[0]?.url) return e.data[0].url
    if (e?.url) return e.url
    if (e?.output?.url) return e.output.url
    if (e?.video?.url) return e.video.url
    if (e?.image?.url) return e.image.url
    if (e?.choices?.[0]?.message?.content) {
      const c = e.choices[0].message.content
      if (typeof c === 'string' && c.startsWith('http')) return c
    }
  }
  return null
}

async function resolveReferenceImages(images?: string[]): Promise<string[]> {
  if (!images?.length) return []
  const results: string[] = []
  for (const img of images) {
    results.push(await ensureHostedUrl(img))
  }
  return results
}

async function downloadAsBase64(url: string, fallbackMime: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const mime = res.headers.get('content-type') || fallbackMime
  return `data:${mime};base64,${buf.toString('base64')}`
}

// ── Provider ───────────────────────────────────────────────

registerProvider({
  name: 'air',

  async generateImage(model, req: ImageRequest, creds): Promise<ImageResponse> {
    const refs = await resolveReferenceImages(req.referenceImages)

    const payload: any = {
      model, prompt: req.prompt, n: 1,
      size: req.config?.aspect_ratio || '1024x1024',
      response_format: 'url', sse: true,
    }
    if (refs.length) payload.image_urls = refs

    const res = await fetch(`${creds.baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.apiKey}` },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${body.substring(0, 300)}`)
    }

    const events = await parseSSE(res)
    const rawUrl = extractUrl(events)
    if (!rawUrl) {
      throw new Error(`No image URL in SSE response. Last events: ${JSON.stringify(events.slice(-2)).substring(0, 300)}`)
    }

    const imageUrl = rawUrl.startsWith('http')
      ? await downloadAsBase64(rawUrl, 'image/png')
      : rawUrl

    return { imageUrl }
  },

  async generateVideo(model, req: VideoRequest, creds): Promise<VideoResponse> {
    const referenceUrl = req.referenceImage
      ? await ensureHostedUrl(req.referenceImage)
      : undefined

    const payload: any = {
      model, prompt: req.prompt, n: 1,
      size: '1024x1024', response_format: 'url', sse: true,
    }

    if (model === 'grok-imagine-video') {
      payload.mode = 'normal'
      if (referenceUrl) payload.image_urls = [referenceUrl]
    } else if (model === 'veo-3.1-fast') {
      if (referenceUrl) payload.reference_image_url = referenceUrl
    } else {
      if (referenceUrl) {
        payload.reference_image_url = referenceUrl
        payload.image_urls = [referenceUrl]
      }
    }

    const res = await fetch(`${creds.baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.apiKey}` },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${body.substring(0, 300)}`)
    }

    const events = await parseSSE(res)
    const rawUrl = extractUrl(events)
    if (!rawUrl) {
      throw new Error(`No video URL in SSE response. Last events: ${JSON.stringify(events.slice(-2)).substring(0, 300)}`)
    }

    const videoUrl = rawUrl.startsWith('http')
      ? await downloadAsBase64(rawUrl, 'video/mp4')
      : rawUrl

    return { videoUrl }
  },
})