import { registerProvider, ImageRequest, ImageResponse, VideoRequest, VideoResponse } from '../registry'
import { ensureHostedUrl } from '../utils/anondrop'

// ── SSE parser — used by both image and video ──────────────

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
        try {
          events.push(JSON.parse(raw))
        } catch { }
      }
    }
  }

  return events
}

function extractUrl(events: any[]): string | null {
  // Walk events backwards — result is usually in the last meaningful event
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    // Common shapes from the API
    if (e?.data?.[0]?.url) return e.data[0].url
    if (e?.url) return e.url
    if (e?.output?.url) return e.output.url
    if (e?.video?.url) return e.video.url
    if (e?.image?.url) return e.image.url
    // Nested in choices (OpenAI-ish)
    if (e?.choices?.[0]?.message?.content) {
      const content = e.choices[0].message.content
      if (typeof content === 'string' && content.startsWith('http')) return content
    }
  }
  return null
}

// ── Resolve reference images — Air needs hosted URLs, never base64 ──

async function resolveReferenceImages(images?: string[]): Promise<string[]> {
  if (!images?.length) return []
  const results: string[] = []
  for (const img of images) {
    try {
      const url = await ensureHostedUrl(img)
      results.push(url)
    } catch (e: any) {
      console.warn(`[air] Failed to resolve reference image: ${e.message}`)
    }
  }
  return results
}

// ── Provider ───────────────────────────────────────────────

registerProvider({
  name: 'air',

  async generateImage(model, req: ImageRequest, creds): Promise<ImageResponse> {
    // Resolve base64 reference images → AnonDrop URLs
    const refs = await resolveReferenceImages(req.referenceImages)

    const payload: any = {
      model,
      prompt: req.prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
      sse: true,
    }

    // Image models use image_urls for references
    if (refs.length) {
      payload.image_urls = refs
    }

    if (req.config?.aspect_ratio) {
      // Map aspect ratio to size if needed
      const ratioMap: Record<string, string> = {
        '16:9': '1792x1024',
        '9:16': '1024x1792',
        '1:1': '1024x1024',
      }
      payload.size = ratioMap[req.config.aspect_ratio] || '1024x1024'
    }

    console.log(`[air/image] ${model} payload:`, JSON.stringify({ ...payload, image_urls: payload.image_urls?.map((u: string) => u.substring(0, 50) + '...') }, null, 2))

    const res = await fetch(`${creds.baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${(await res.text()).substring(0, 200)}`)
    }

    const events = await parseSSE(res)
    const rawUrl = extractUrl(events)

    if (!rawUrl) {
      console.error('[air/image] No URL found in SSE events:', JSON.stringify(events.slice(-3), null, 2))
      throw new Error('No image URL in Air SSE response')
    }

    let imageUrl = rawUrl;
    if (rawUrl.startsWith('http')) {
      try {
        const dRes = await fetch(rawUrl);
        if (!dRes.ok) throw new Error(`HTTP ${dRes.status}`);
        const arrayBuffer = await dRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = dRes.headers.get('content-type') || 'image/png';
        imageUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
      } catch (e: any) {
        throw new Error(`Failed to convert Air image to base64: ${e.message}`);
      }
    }

    return { imageUrl }
  },

  async generateVideo(model, req: VideoRequest, creds): Promise<VideoResponse> {
    // Resolve reference image → AnonDrop URL
    let referenceUrl: string | undefined
    if (req.referenceImage) {
      try {
        referenceUrl = await ensureHostedUrl(req.referenceImage)
      } catch (e: any) {
        console.warn(`[air/video] Failed to resolve reference image: ${e.message}`)
      }
    }

    // Model-specific payload construction
    const payload: any = {
      model,
      prompt: req.prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
      sse: true,
    }

    if (model === 'grok-imagine-video') {
      // Grok uses image_urls (array) and mode
      payload.mode = 'normal'
      if (referenceUrl) {
        payload.image_urls = [referenceUrl]
      }
    } else if (model === 'veo-3.1-fast') {
      // Veo uses reference_image_url (singular string)
      if (referenceUrl) {
        payload.reference_image_url = referenceUrl
      }
    } else {
      // Unknown video model — try both patterns
      if (referenceUrl) {
        payload.reference_image_url = referenceUrl
        payload.image_urls = [referenceUrl]
      }
    }

    console.log(`[air/video] ${model} payload:`, JSON.stringify({
      ...payload,
      image_urls: payload.image_urls?.map((u: string) => u.substring(0, 50) + '...'),
      reference_image_url: payload.reference_image_url ? payload.reference_image_url.substring(0, 50) + '...' : undefined,
    }, null, 2))

    const res = await fetch(`${creds.baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${(await res.text()).substring(0, 200)}`)
    }

    const events = await parseSSE(res)
    const rawUrl = extractUrl(events)

    if (!rawUrl) {
      console.error('[air/video] No URL found in SSE events:', JSON.stringify(events.slice(-3), null, 2))
      throw new Error('No video URL in Air SSE response')
    }

    let videoUrl = rawUrl;
    if (rawUrl.startsWith('http')) {
      try {
        const dRes = await fetch(rawUrl);
        if (!dRes.ok) throw new Error(`HTTP ${dRes.status}`);
        const arrayBuffer = await dRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = dRes.headers.get('content-type') || 'video/mp4';
        videoUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
      } catch (e: any) {
        throw new Error(`Failed to convert Air video to base64: ${e.message}`);
      }
    }

    return { videoUrl }
  },
})