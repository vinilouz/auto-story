You're right, my bad on the proxy system. That's free transcription, obviously it stays. Let me give you the complete rewrite — every file that matters.

---

## Structure

```
DELETE:
  src/lib/pipeline.ts
  src/lib/ai/providers/custom-client.ts
  src/components/createForm.tsx
  src/components/flows/          ← entire directory
  src/components/shared/         ← entire directory
  src/lib/flows/use-audio-generation.ts
  src/lib/flows/use-image-generation.ts
  src/lib/flows/use-transcription.ts
  src/lib/flows/use-video-generation.ts
  src/lib/flows/use-project.ts
  src/app/api/generate/route.ts  ← unused by UI

UNCHANGED (keep as-is):
  package.json, tsconfig.json, jest.config.js
  src/app/layout.tsx, src/app/globals.css
  src/components/ui/*            ← all shadcn
  src/components/video/*         ← all remotion components
  src/remotion/*
  src/lib/video/*                ← aligner + types
  src/lib/storage.ts
  src/lib/text-segmentation.ts
  src/lib/utils.ts
  src/lib/networking/*           ← PROXY STAYS
  src/lib/ai/transcription/*     ← ELEVENLABS FREE STT STAYS
  src/lib/ai/prompts/prompts.ts
  src/lib/ai/utils/text-splitter.ts
```

---

## `.env.example`

```env
VOID_BASE_URL="..."
VOID_API_KEY="..."

NAGA_BASE_URL="..."
NAGA_API_KEY="..."

AIR_BASE_URL="..."
AIR_API_KEY="..."

DEBUG_LOG="false"
```

---

## `src/lib/ai/config.ts`

```typescript
export type ActionType = 'generateText' | 'generateImage' | 'generateAudio'

export interface ModelConfig {
  provider: string
  model: string
}

// THE source of truth. Reorder = change priority. Add a line = add fallback.
export const ACTIONS: Record<ActionType, ModelConfig[]> = {
  generateText: [
    { provider: 'void', model: 'gemini-3-flash-preview' },
  ],
  generateImage: [
    { provider: 'void', model: 'gemini-3-pro-image-preview' },
    { provider: 'air', model: 'nano-banana-2' },
    { provider: 'air', model: 'seedream-4.5' },
  ],
  generateAudio: [
    { provider: 'naga', model: 'eleven-multilingual-v2:free' },
  ],
}

export function getCredentials(provider: string) {
  const key = provider.toUpperCase()
  const baseUrl = process.env[`${key}_BASE_URL`] || ''
  const apiKey = process.env[`${key}_API_KEY`] || ''
  if (!baseUrl || !apiKey) return null
  return { baseUrl, apiKey }
}
```

---

## `src/lib/ai/registry.ts`

```typescript
import { ActionType, ACTIONS, getCredentials } from './config'

// ── Request/Response types ────────────────────────────────

export interface TextRequest { prompt: string }
export interface TextResponse { text: string }

export interface ImageRequest {
  prompt: string
  referenceImages?: string[]
  config?: { aspect_ratio?: string; image_size?: string }
}
export interface ImageResponse { imageUrl: string }

export interface AudioRequest { text: string; voice: string }
export interface AudioResponse { audioBuffer: ArrayBuffer }

interface ActionMap {
  generateText:  { req: TextRequest;  res: TextResponse }
  generateImage: { req: ImageRequest; res: ImageResponse }
  generateAudio: { req: AudioRequest; res: AudioResponse }
}

// ── Provider interface ────────────────────────────────────

type Handler<Req, Res> = (model: string, req: Req, creds: { baseUrl: string; apiKey: string }) => Promise<Res>

export interface Provider {
  name: string
  generateText?:  Handler<TextRequest, TextResponse>
  generateImage?: Handler<ImageRequest, ImageResponse>
  generateAudio?: Handler<AudioRequest, AudioResponse>
}

const providers = new Map<string, Provider>()
export const registerProvider = (p: Provider) => providers.set(p.name, p)

// ── Execute with automatic fallback ───────────────────────

export async function execute<A extends ActionType>(
  action: A,
  request: ActionMap[A]['req']
): Promise<ActionMap[A]['res']> {
  const chain = ACTIONS[action]
  if (!chain?.length) throw new Error(`No models for action: ${action}`)

  const errors: string[] = []

  for (const { provider: name, model } of chain) {
    const provider = providers.get(name)
    const handler = provider?.[action] as Handler<any, any> | undefined
    const creds = getCredentials(name)

    if (!provider || !handler || !creds) {
      errors.push(`${name}/${model}: ${!provider ? 'unknown provider' : !handler ? 'unsupported action' : 'no credentials'}`)
      continue
    }

    try {
      console.log(`[AI] ${action} → ${name}/${model}`)
      return await handler(model, request, creds)
    } catch (e: any) {
      const msg = e?.message || String(e)
      console.warn(`[AI] ${name}/${model} failed: ${msg}`)
      errors.push(`${name}/${model}: ${msg}`)
    }
  }

  throw new Error(`All providers failed for ${action}:\n${errors.join('\n')}`)
}
```

---

## `src/lib/ai/providers/void.ts`

```typescript
import { registerProvider, TextRequest, TextResponse, ImageRequest, ImageResponse } from '../registry'

registerProvider({
  name: 'void',

  async generateText(model, req: TextRequest, creds): Promise<TextResponse> {
    const res = await fetch(`${creds.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: req.prompt }], stream: true }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).substring(0, 200)}`)

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No body')
    const decoder = new TextDecoder()
    let text = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const line of decoder.decode(value).split('\n')) {
        if (!line.startsWith('data: ') || line.slice(6) === '[DONE]') continue
        try { text += JSON.parse(line.slice(6)).choices?.[0]?.delta?.content || '' } catch {}
      }
    }

    if (!text) throw new Error('Empty text response')
    return { text }
  },

  async generateImage(model, req: ImageRequest, creds): Promise<ImageResponse> {
    const content: any[] = [{ type: 'text', text: req.prompt }]
    req.referenceImages?.forEach(url => content.push({ type: 'image_url', image_url: { url } }))

    const payload: any = { model, messages: [{ role: 'user', content }], responseModalities: ['IMAGE'] }
    if (req.config) {
      payload.image_config = { aspect_ratio: req.config.aspect_ratio || '16:9', image_size: req.config.image_size || '2K' }
    }

    const res = await fetch(`${creds.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.apiKey}` },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).substring(0, 200)}`)

    const data = await res.json()
    const img = data.choices?.[0]?.message?.images?.[0]
    const imageUrl = img?.image_url?.url || img?.url
    if (!imageUrl) throw new Error('No image in response')
    return { imageUrl }
  },
})
```

---

## `src/lib/ai/providers/naga.ts`

```typescript
import { registerProvider, AudioRequest, AudioResponse } from '../registry'

registerProvider({
  name: 'naga',

  async generateAudio(model, req: AudioRequest, creds): Promise<AudioResponse> {
    const res = await fetch(`${creds.baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.apiKey}` },
      body: JSON.stringify({ model, input: req.text, voice: req.voice }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).substring(0, 200)}`)

    const audioBuffer = await res.arrayBuffer()
    if (!audioBuffer.byteLength) throw new Error('Empty audio')
    return { audioBuffer }
  },
})
```

---

## `src/lib/ai/providers/air.ts`

```typescript
import { registerProvider, ImageRequest, ImageResponse } from '../registry'

registerProvider({
  name: 'air',

  async generateImage(model, req: ImageRequest, creds): Promise<ImageResponse> {
    const payload: any = { model, prompt: req.prompt }
    if (req.config?.aspect_ratio) payload.aspect_ratio = req.config.aspect_ratio
    if (req.referenceImages?.length) payload.reference_images = req.referenceImages

    const res = await fetch(`${creds.baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.apiKey}` },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).substring(0, 200)}`)

    const data = await res.json()
    const item = data.data?.[0]
    if (item?.b64_json) return { imageUrl: `data:image/png;base64,${item.b64_json}` }
    if (item?.url) return { imageUrl: item.url }
    throw new Error('No image in Air response')
  },
})
```

---

## `src/lib/ai/providers/index.ts`

```typescript
import './void'
import './naga'
import './air'
export { execute } from '../registry'
```

---

## `src/lib/ai/processors/scene-visualizer.ts`

```typescript
import { execute } from '@/lib/ai/providers'
import { SCENE_VISUAL_PROMPT } from '@/lib/ai/prompts/prompts'
import { Segment } from '@/lib/flows/types'

export interface SceneVisualizationRequest {
  segments: Segment[]
  language?: string
  style?: string
  consistency?: boolean
  context?: 'story' | 'commentator'
  commentatorName?: string
  commentatorPersonality?: string
  commentatorImage?: string
}

export async function generateSceneDescriptions(data: SceneVisualizationRequest) {
  if (!data.segments?.length) throw new Error('No segments')

  const prompt = SCENE_VISUAL_PROMPT(
    data.segments.map((s, i) => ({ id: String(i + 1), scriptText: s.text.trim() })),
    data.language || 'Portuguese'
  )

  const { text: raw } = await execute('generateText', { prompt })

  // Parse JSON from response
  let clean = raw.trim()
  const m = clean.match(/```json\s*(\[[\s\S]*?\])\s*```/) || clean.match(/(\[[\s\S]*?\])/)
  if (m) clean = m[1]

  const parsed = JSON.parse(clean.trim())
  const descriptions = Array.isArray(parsed) ? parsed : parsed.visualDescriptions
  if (!Array.isArray(descriptions)) throw new Error('Response not an array')

  const segments: Segment[] = data.segments.map((seg, i) => {
    const desc = descriptions[i]
    const imagePrompt = typeof desc?.imagePrompt === 'string' ? desc.imagePrompt : typeof desc === 'string' ? desc : null
    if (!imagePrompt) throw new Error(`Bad description at index ${i}`)
    return { ...seg, imagePrompt }
  })

  let entities: string[] | undefined
  if (data.consistency) {
    const set = new Set<string>()
    segments.forEach(s => s.imagePrompt?.match(/<<([^>]+)>>/g)?.forEach(m => set.add(m.replace(/<<|>>/g, ''))))
    if (set.size > 0) entities = Array.from(set)
  }

  return { segments, ...(entities ? { entities } : {}) }
}
```

---

## `src/lib/ai/processors/image-generator.ts`

```typescript
import { execute } from '@/lib/ai/providers'
import fs from 'fs/promises'
import path from 'path'

export interface GenerateImageRequest {
  imagePrompt: string
  referenceImage?: string
  referenceImages?: string[]
  imageConfig?: { aspect_ratio?: string; image_size?: string }
  systemPrompt?: string
}

async function resolveImage(url?: string): Promise<string | undefined> {
  if (!url?.startsWith('/projects/')) return url
  try {
    const buf = await fs.readFile(path.join(process.cwd(), 'public', url))
    const ext = path.extname(url).replace('.', '')
    return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${buf.toString('base64')}`
  } catch { return undefined }
}

export async function generateSingleImage(req: GenerateImageRequest): Promise<string> {
  const prompt = req.imagePrompt.replace(/Scene \d{1,3}:\s*/gi, '').trim()
  const finalPrompt = req.systemPrompt ? `${req.systemPrompt}\n${prompt}` : prompt

  let refs: string[] | undefined
  if (req.referenceImages?.length) {
    refs = (await Promise.all(req.referenceImages.map(resolveImage))).filter((u): u is string => !!u)
  } else if (req.referenceImage) {
    const r = await resolveImage(req.referenceImage)
    if (r) refs = [r]
  }

  const { imageUrl } = await execute('generateImage', { prompt: finalPrompt, config: req.imageConfig, referenceImages: refs })
  return imageUrl
}
```

---

## `src/lib/ai/processors/audio-generator.ts`

```typescript
import fs from 'fs'
import path from 'path'
import { execute } from '@/lib/ai/providers'
import { splitTextIntoBatches } from '../utils/text-splitter'

export interface AudioBatch {
  index: number; text: string
  status: 'pending' | 'generating' | 'completed' | 'error'
  url?: string; error?: string
}

function audioDir(projectId: string, projectName: string) {
  const slug = projectName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').substring(0, 10) || 'untitled'
  return `${slug}-${projectId.split('-')[0] || projectId.substring(0, 8)}`
}

async function generateAndSave(text: string, voice: string, projectId: string, projectName: string): Promise<string> {
  const { audioBuffer } = await execute('generateAudio', { text, voice })
  const dir = audioDir(projectId, projectName)
  const pubDir = path.join(process.cwd(), 'public', 'projects', dir, 'audios')
  if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true })
  const name = `audio_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp3`
  fs.writeFileSync(path.join(pubDir, name), Buffer.from(audioBuffer))
  return `/projects/${dir}/audios/${name}`
}

export async function generateAudio(opts: {
  text: string; voice?: string; systemPrompt?: string
  targetBatchIndices?: number[]; projectId: string; projectName: string
}): Promise<{ batches: AudioBatch[] }> {
  const { text, voice = 'nPczCjzI2devNBz1zQrb', systemPrompt, targetBatchIndices, projectId, projectName } = opts
  const segments = splitTextIntoBatches(text, 10000, systemPrompt)
  const batches: AudioBatch[] = segments.map((t, i) => ({ index: i, text: t, status: 'pending' as const }))

  const indices = targetBatchIndices?.filter(i => i >= 0 && i < segments.length) ?? segments.map((_, i) => i)

  for (let i = 0; i < indices.length; i += 4) {
    const chunk = indices.slice(i, i + 4)
    await Promise.all(chunk.map(async (idx, offset) => {
      await new Promise(r => setTimeout(r, offset * 800))
      batches[idx].status = 'generating'
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          batches[idx].url = await generateAndSave(segments[idx], voice, projectId, projectName)
          batches[idx].status = 'completed'
          return
        } catch (e: any) {
          if (attempt >= 1) { batches[idx].status = 'error'; batches[idx].error = e.message; return }
          await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt) + Math.random() * 1000))
        }
      }
    }))
  }

  return { batches }
}
```

---

## `src/lib/ai/processors/commentator.ts`

```typescript
import { execute } from '@/lib/ai/providers'
import { COMMENTATOR_PROMPT } from '@/lib/ai/prompts/prompts'
import { Segment } from '@/lib/flows/types'

export async function generateCommentsWithCommentator(data: { commentatorDescription: string; segments: string[] }) {
  if (!data.commentatorDescription || !data.segments?.length) throw new Error('Missing commentator data')

  const json = JSON.stringify(data.segments.map((text, i) => ({ id: i + 1, text: text.trim() })))
  const { text: raw } = await execute('generateText', { prompt: COMMENTATOR_PROMPT(data.commentatorDescription, json) })

  let clean = raw.trim()
  const m = clean.match(/```json\s*(\[[\s\S]*?\])\s*```/) || clean.match(/(\[[\s\S]*?\])/)
  if (m) clean = m[1]

  try {
    const parsed = JSON.parse(clean.trim())
    if (!Array.isArray(parsed)) throw new Error()
    const segments: Segment[] = parsed
      .map((item: any) => item?.type && item?.content
        ? { text: String(item.content), type: item.type === 'comment' ? 'comment' as const : 'scene_text' as const }
        : { text: String(item || ''), type: 'scene_text' as const })
      .filter((s: Segment) => s.text)
    if (segments.length) return { segments }
  } catch {}

  return { segments: data.segments.map(text => ({ text, type: 'scene_text' as const })) }
}
```

---

## `src/lib/flows/types.ts`

```typescript
export interface Segment {
  text: string
  type?: 'scene_text' | 'comment'
  entities?: string[]
  imagePrompt?: string
  imagePath?: string
}

export interface EntityAsset {
  name: string
  description?: string
  imageUrl?: string
  status: 'pending' | 'generating' | 'completed' | 'error'
}

export interface AudioBatch {
  index: number; text: string
  status: 'pending' | 'generating' | 'completed' | 'error'
  url?: string; error?: string
}

export interface TranscriptionResult {
  url: string
  status: 'completed' | 'error'
  transcriptionUrl?: string
  data?: { text: string; startMs: number; endMs: number }[] | { words: { text: string; startMs: number; endMs: number }[] }
  error?: string
}

export interface CaptionStyle {
  fontSize: number; fontFamily: string; fontWeight: number
  maxWordsPerLine: number; uppercase: boolean; highlightColor: string
}

export interface CommentatorConfig {
  id: string; name: string; personality: string
  appearance: { type: 'upload' | 'generated'; imageUrl?: string; imagePrompt?: string }
  voice?: string
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontSize: 60, fontFamily: "TikTok Sans, sans-serif", fontWeight: 800,
  maxWordsPerLine: 3, uppercase: true, highlightColor: "#FFE81F"
}
```

---

## `src/lib/flows/hooks.ts`

All hooks consolidated in one file:

```typescript
import { useState, useCallback } from "react"
import { AudioBatch, TranscriptionResult, CaptionStyle, Segment } from "./types"
import { RemotionVideoProps } from "@/lib/video/types"
import { alignVideoProps } from "@/lib/video/aligner"
import { cleanTitle } from "@/lib/utils"

// ── Audio ──────────────────────────────────────────────────

export function useAudio() {
  const [batches, setBatches] = useState<AudioBatch[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const generate = async (opts: { text: string; voice?: string; systemPrompt?: string; projectId: string; projectName: string; targetBatchIndices?: number[] }) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/generate/audio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      })
      if (!res.ok) throw new Error('Audio generation failed')
      const data = await res.json()
      if (data.batches) setBatches(data.batches)
      return data.batches as AudioBatch[]
    } finally { setIsLoading(false) }
  }

  const regenerateBatch = useCallback(async (index: number, opts: Parameters<typeof generate>[0]) => {
    setBatches(prev => {
      const exists = prev.find(b => b.index === index)
      return exists
        ? prev.map(b => b.index === index ? { ...b, status: 'generating' as const } : b)
        : [...prev, { index, text: '', status: 'generating' as const }]
    })
    try {
      const res = await fetch('/api/generate/audio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...opts, targetBatchIndices: [index] }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const updated = data.batches?.find((b: AudioBatch) => b.index === index)
      if (updated) setBatches(prev => prev.map(b => b.index === index ? updated : b))
    } catch {
      setBatches(prev => prev.map(b => b.index === index ? { ...b, status: 'error' as const } : b))
    }
  }, [])

  return { batches, setBatches, generate, regenerateBatch, isLoading }
}

// ── Transcription ──────────────────────────────────────────

export function useTranscription() {
  const [results, setResults] = useState<TranscriptionResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const transcribe = async (audioBatches: AudioBatch[], language: string) => {
    const urls = audioBatches.filter(b => b.status === 'completed' && b.url).map(b => b.url!)
    if (!urls.length) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/generate/transcription', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrls: urls, language: language === 'english' ? 'en' : 'pt' }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setResults(prev => {
        const map = new Map(prev.map(r => [r.url, r]))
        data.results.forEach((r: TranscriptionResult) => map.set(r.url, r))
        return Array.from(map.values())
      })
    } finally { setIsLoading(false) }
  }

  const retry = useCallback(async (url: string, language: string) => {
    setResults(prev => prev.filter(r => r.url !== url))
    setIsLoading(true)
    try {
      const res = await fetch('/api/generate/transcription', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrls: [url], language: language === 'english' ? 'en' : 'pt' }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.results?.[0]) setResults(prev => [...prev.filter(r => r.url !== url), data.results[0]])
    } catch {
      setResults(prev => [...prev, { url, status: 'error' as const, error: 'Retry failed' }])
    } finally { setIsLoading(false) }
  }, [])

  return { results, setResults, transcribe, retry, isLoading }
}

// ── Video ──────────────────────────────────────────────────

export function useVideo() {
  const [videoProps, setVideoProps] = useState<RemotionVideoProps | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [renderProgress, setRenderProgress] = useState<{ progress: number; stage: string; renderedFrames?: number; totalFrames?: number } | null>(null)

  const generate = async (
    segments: { id: string; text: string; imageUrl: string }[],
    audioBatches: AudioBatch[],
    transcriptionResults: TranscriptionResult[]
  ) => {
    const completed = audioBatches.filter(b => b.status === 'completed' && b.url)
    const urls = completed.map(b => b.url!)
    const tMap = new Map(transcriptionResults.filter(r => r.status === 'completed' && r.data).map(r => [r.url, r.data]))
    const validUrls = urls.filter(u => tMap.has(u))
    if (!validUrls.length) throw new Error('No valid transcriptions')

    setIsGenerating(true)
    try {
      const transcriptions = validUrls.map(u => {
        const raw = tMap.get(u)!
        const words = Array.isArray(raw) ? raw : (raw as any).words || []
        return { words: words.map((w: any) => ({ text: w.text, startMs: w.startMs, endMs: w.endMs })) }
      })

      const durations = await Promise.all(validUrls.map(url => new Promise<number>(resolve => {
        const t = setTimeout(() => resolve(0), 5000)
        const a = new Audio(url)
        a.onloadedmetadata = () => { clearTimeout(t); resolve(a.duration) }
        a.onerror = () => { clearTimeout(t); resolve(0) }
      })))

      const props = alignVideoProps(segments, transcriptions, validUrls, durations)
      if (props.durationInFrames <= 0) throw new Error('Zero duration')
      setVideoProps(props)
      return props
    } finally { setIsGenerating(false) }
  }

  const render = async (props: RemotionVideoProps, captionStyle: CaptionStyle, projectId?: string, projectName?: string) => {
    setIsRendering(true)
    setRenderProgress({ progress: 0, stage: 'bundling' })
    try {
      const res = await fetch('/api/render', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoProps: { ...props, captionStyle }, projectId, projectName }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Render failed')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))
          if (data.type === 'progress') setRenderProgress(data)
          else if (data.type === 'complete') {
            const link = document.createElement('a')
            link.href = data.videoUrl; link.download = `video-${Date.now()}.mp4`
            document.body.appendChild(link); link.click(); document.body.removeChild(link)
          } else if (data.type === 'error') throw new Error(data.error)
        }
      }
    } finally { setIsRendering(false); setRenderProgress(null) }
  }

  return { videoProps, setVideoProps, generate, render, isGenerating, isRendering, renderProgress }
}

// ── Project ────────────────────────────────────────────────

export function useProject() {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const load = async (id: string) => {
    const res = await fetch(`/api/projects/${id}`)
    if (!res.ok) throw new Error('Load failed')
    const data = await res.json()
    setProjectId(data.id)
    return data
  }

  const save = async (data: Record<string, any>) => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId, ...data }),
      })
      if (!res.ok) throw new Error('Save failed')
      const saved = await res.json()
      setProjectId(saved.id)
      return saved
    } finally { setIsSaving(false) }
  }

  return { projectId, setProjectId, load, save, isSaving }
}

// ── Download ───────────────────────────────────────────────

export function useDownload() {
  const [isDownloading, setIsDownloading] = useState(false)

  const downloadZip = async (payload: { segments: Segment[]; audioUrls: string[]; transcriptionResults: TranscriptionResult[]; filename?: string }) => {
    setIsDownloading(true)
    try {
      const res = await fetch('/api/generate/zip', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = payload.filename || `story-${Date.now()}.zip`
      document.body.appendChild(link); link.click(); document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } finally { setIsDownloading(false) }
  }

  return { downloadZip, isDownloading }
}
```

---

## `src/lib/ai/configs/voices.ts`

Unchanged — keep as-is.

---

## `src/app/page.tsx`

```typescript
"use client"

import { useState, useEffect } from "react"
import StoryFlow from "@/components/StoryFlow"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Trash2, BookOpen, MessageSquare } from "lucide-react"

interface Project { id: string; name: string; flowType: string; createdAt: string; updatedAt: string; commentator?: any }

export default function Home() {
  const [flow, setFlow] = useState<{ type: 'simple' | 'commentator'; projectId?: string } | null>(null)
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => { loadProjects() }, [])

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      if (res.ok) setProjects((await res.json()).sort((a: Project, b: Project) => +new Date(b.updatedAt) - +new Date(a.updatedAt)))
    } catch {}
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Delete this project?')) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    setProjects(p => p.filter(x => x.id !== id))
  }

  if (flow) {
    return <StoryFlow
      mode={flow.type}
      projectId={flow.projectId}
      onBack={() => { setFlow(null); loadProjects() }}
    />
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-4">Auto Story</h1>
        <p className="text-xl text-muted-foreground text-center mb-12">Create or continue a story</p>

        {projects.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">Saved Projects</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(p => (
                <Card key={p.id} className="cursor-pointer hover:scale-[1.02] hover:shadow-lg transition-all group"
                  onClick={() => setFlow({ type: (p.flowType || (p.commentator ? 'commentator' : 'simple')) as any, projectId: p.id })}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between">
                      <div className="flex items-center gap-2">
                        {p.flowType === 'with-commentator' ? <MessageSquare className="w-4 h-4 text-green-500" /> : <BookOpen className="w-4 h-4 text-blue-500" />}
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {p.flowType === 'with-commentator' ? 'Commentator' : 'Simple'}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-8 w-8" onClick={e => handleDelete(e, p.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    <CardTitle className="text-lg line-clamp-2">{p.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{new Date(p.updatedAt).toLocaleDateString()}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-2xl font-semibold mb-6">New Story</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <Card className="cursor-pointer hover:scale-105 hover:shadow-lg transition-all" onClick={() => setFlow({ type: 'simple' })}>
            <CardHeader>
              <div className="text-4xl mb-4">📖</div>
              <CardTitle className="text-2xl">Simple Story</CardTitle>
              <CardDescription>Text → images → audio → video</CardDescription>
            </CardHeader>
            <CardContent><Button className="w-full" size="lg">Start</Button></CardContent>
          </Card>
          <Card className="cursor-pointer hover:scale-105 hover:shadow-lg transition-all" onClick={() => setFlow({ type: 'commentator' })}>
            <CardHeader>
              <div className="text-4xl mb-4">🎙️</div>
              <CardTitle className="text-2xl">With Commentator</CardTitle>
              <CardDescription>Add a commentator character to your story</CardDescription>
            </CardHeader>
            <CardContent><Button className="w-full" size="lg">Start</Button></CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
```

---

## `src/components/StoryFlow.tsx`

This **single file** replaces FlowSelector, SimpleStoryFlow, WithCommentatorFlow, StoryFlowBase, all shared stages, StageControls, FlowStepper, ScrollToTop, and CommentatorConfig.

```typescript
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Save, Loader2, Play, ChevronRight, ChevronLeft, RefreshCw, Pencil, Check, X, Upload, Sparkles, Download } from "lucide-react"
import { toast } from "sonner"
import { Segment, EntityAsset, AudioBatch, TranscriptionResult, CaptionStyle, CommentatorConfig, DEFAULT_CAPTION_STYLE } from "@/lib/flows/types"
import { VOICES } from "@/lib/ai/configs/voices"
import { useAudio, useTranscription, useVideo, useProject, useDownload } from "@/lib/flows/hooks"
import { VideoPlayer } from "@/components/video/VideoPlayer"
import { splitTextIntoBatches } from "@/lib/ai/utils/text-splitter"
import { GENERATE_ENTITY_IMAGE_PROMPT, GENERATE_SEGMENT_IMAGE_PROMPT, COMMENTATOR_IMAGE_GENERATION_PROMPT } from "@/lib/ai/prompts/prompts"
import { cn } from "@/lib/utils"

type Stage = 'input' | 'commentator' | 'comments' | 'descriptions' | 'entities' | 'images' | 'audio' | 'transcription' | 'video'

function getStages(mode: 'simple' | 'commentator', consistency: boolean): Stage[] {
  const all: Stage[] = ['input', 'commentator', 'comments', 'descriptions', 'entities', 'images', 'audio', 'transcription', 'video']
  return all.filter(s => {
    if (s === 'commentator' || s === 'comments') return mode === 'commentator'
    if (s === 'entities') return consistency
    return true
  })
}

const STAGE_LABELS: Record<Stage, string> = {
  input: 'Input', commentator: 'Commentator', comments: 'Comments',
  descriptions: 'Descriptions', entities: 'Entities', images: 'Images',
  audio: 'Audio', transcription: 'Transcription', video: 'Video'
}

interface Props { mode: 'simple' | 'commentator'; projectId?: string; onBack: () => void }

export default function StoryFlow({ mode, projectId, onBack }: Props) {
  // ── Stage ──
  const [stage, setStage] = useState<Stage>('input')

  // ── Input state ──
  const [title, setTitle] = useState("")
  const [scriptText, setScriptText] = useState("")
  const [segmentSize, setSegmentSize] = useState([150])
  const [language, setLanguage] = useState("english")
  const [imagePromptStyle, setImagePromptStyle] = useState("")
  const [audioVoice, setAudioVoice] = useState("nPczCjzI2devNBz1zQrb")
  const [consistency, setConsistency] = useState(false)

  // ── Commentator ──
  const [commentator, setCommentator] = useState<CommentatorConfig | null>(null)
  const [commName, setCommName] = useState("")
  const [commPersonality, setCommPersonality] = useState("")
  const [commImagePrompt, setCommImagePrompt] = useState("")
  const [commImage, setCommImage] = useState<string | null>(null)
  const [audioSystemPrompt, setAudioSystemPrompt] = useState("")

  // ── Pipeline data ──
  const [segments, setSegments] = useState<Segment[]>([])
  const [entities, setEntities] = useState<EntityAsset[]>([])
  const [imageStatuses, setImageStatuses] = useState<Map<number, 'generating' | 'error'>>(new Map())
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE)

  // ── Loading ──
  const [loading, setLoading] = useState(false)

  // ── Hooks ──
  const audio = useAudio()
  const transcription = useTranscription()
  const video = useVideo()
  const project = useProject()
  const dl = useDownload()

  const stages = useMemo(() => getStages(mode, consistency), [mode, consistency])
  const stageIdx = stages.indexOf(stage)
  const hasPrompts = segments.some(s => s.imagePrompt)
  const hasImages = segments.some(s => s.imagePath)
  const hasComments = segments.some(s => s.type === 'comment')
  const hasAudio = audio.batches.some(b => b.status === 'completed' && b.url)

  const maxStep = useMemo(() => {
    if (video.videoProps) return stages.length - 1
    if (transcription.results.length > 0) return stages.indexOf('video')
    if (hasAudio) return stages.indexOf('transcription')
    if (hasImages || hasPrompts) return stages.indexOf('audio')
    if (consistency && entities.length > 0 && entities.every(e => e.status === 'completed')) return stages.indexOf('images')
    if (consistency && entities.length > 0) return stages.indexOf('entities')
    if (hasPrompts) return stages.indexOf(consistency ? 'entities' : 'images')
    if (hasComments && mode === 'commentator') return stages.indexOf('descriptions')
    if (commentator && mode === 'commentator') return stages.indexOf('comments')
    if (segments.length > 0) return stages.indexOf(mode === 'commentator' ? 'commentator' : 'descriptions')
    return 0
  }, [stages, video.videoProps, transcription.results, hasAudio, hasImages, hasPrompts, entities, hasComments, commentator, segments, consistency, mode])

  // ── Load project ──
  useEffect(() => {
    if (!projectId) return
    project.load(projectId).then(p => {
      if (p.name) setTitle(p.name)
      if (p.scriptText) setScriptText(p.scriptText)
      if (p.segmentSize) setSegmentSize([p.segmentSize])
      if (p.language) setLanguage(p.language)
      if (p.style) setImagePromptStyle(p.style)
      if (p.voice) setAudioVoice(p.voice)
      if (p.consistency) setConsistency(p.consistency)
      if (p.segments) setSegments(p.segments)
      if (p.entities) setEntities(p.entities)
      if (p.commentator) {
        setCommentator(p.commentator)
        setCommName(p.commentator.name)
        setCommPersonality(p.commentator.personality)
        if (p.commentator.appearance?.imageUrl) setCommImage(p.commentator.appearance.imageUrl)
      }
      if (p.audioBatches) audio.setBatches(p.audioBatches)
      if (p.audioSystemPrompt) setAudioSystemPrompt(p.audioSystemPrompt)
      if (p.transcriptionResults) transcription.setResults(p.transcriptionResults)
      // Determine stage from loaded data
      if (p.transcriptionResults?.length) setStage('transcription')
      else if (p.audioBatches?.some((b: any) => b.status === 'completed')) setStage('audio')
      else if (p.segments?.some((s: any) => s.imagePath)) setStage('images')
      else if (p.segments?.some((s: any) => s.imagePrompt)) setStage('descriptions')
      else if (p.segments?.length) setStage(mode === 'commentator' ? 'commentator' : 'descriptions')
    }).catch(() => toast.error("Failed to load project"))
  }, [projectId])

  // ── Save helper ──
  const save = async (extra?: any) => {
    const data = {
      name: title || scriptText.substring(0, 30),
      flowType: mode === 'commentator' ? 'with-commentator' : 'simple',
      scriptText, segmentSize: segmentSize[0], language,
      style: imagePromptStyle, voice: audioVoice, consistency,
      segments, entities,
      commentator: commentator || undefined,
      audioBatches: audio.batches,
      audioSystemPrompt,
      transcriptionResults: transcription.results,
      ...extra,
    }
    const saved = await project.save(data)
    toast.success("Saved!")
    return saved
  }

  const audioOpts = () => ({
    text: mode === 'commentator' ? segments.filter(s => s.type).map(s => `${s.type === 'comment' ? 'commentator' : 'narrator'}: ${s.text}`).join('\n') : scriptText,
    voice: audioVoice, systemPrompt: audioSystemPrompt,
    projectId: project.projectId || 'temp', projectName: title || 'untitled',
  })

  // ── Actions ──

  const splitScenes = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/generate/split", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: scriptText, segmentLength: segmentSize[0] }) })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const newSegs: Segment[] = data.segments.map((t: string) => ({ text: t }))
      setSegments(newSegs)
      setStage(mode === 'commentator' ? 'commentator' : 'descriptions')
      await save({ segments: newSegs })
    } catch { toast.error("Failed to split") }
    finally { setLoading(false) }
  }

  const saveCommentator = async () => {
    const config: CommentatorConfig = {
      id: commentator?.id || Date.now().toString(), name: commName, personality: commPersonality,
      appearance: { type: commImage?.startsWith('data:') ? 'upload' : 'generated', imageUrl: commImage || undefined, imagePrompt: commImagePrompt || undefined },
    }
    setCommentator(config)
    setStage('comments')
    await save({ commentator: config })
  }

  const generateComments = async () => {
    if (!commentator) return
    setLoading(true)
    try {
      const res = await fetch("/api/generate/commentator", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments: segments.map(s => s.text), commentatorDescription: `Name: ${commentator.name}. Personality: ${commentator.personality}` }) })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSegments(data.segments)
      setStage('comments')
      await save({ segments: data.segments })
    } catch { toast.error("Failed") }
    finally { setLoading(false) }
  }

  const generateDescriptions = async () => {
    setLoading(true)
    try {
      const segsForApi = mode === 'commentator'
        ? segments.map(s => s.type === 'comment' ? { ...s, text: `[Commentary by ${commentator?.name}]: ${s.text}` } : s)
        : segments
      const res = await fetch("/api/generate/descriptions", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments: segsForApi, language, style: imagePromptStyle, consistency, commentatorName: commentator?.name, commentatorPersonality: commentator?.personality }) })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSegments(data.segments || segments)
      if (consistency && data.entities?.length) {
        const ents: EntityAsset[] = data.entities.map((n: string) => ({ name: n, status: 'pending' as const }))
        setEntities(ents)
        setStage('entities')
        await save({ segments: data.segments, entities: ents })
      } else {
        setStage('descriptions')
        await save({ segments: data.segments })
      }
    } catch { toast.error("Failed") }
    finally { setLoading(false) }
  }

  const generateEntities = async () => {
    setLoading(true)
    try {
      let pid = project.projectId
      if (!pid) { const s = await save(); pid = s?.id }

      const descRes = await fetch("/api/generate/entities/descriptions", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entities: entities.map(e => e.name), segments: segments.map(s => s.text) }) })
      if (!descRes.ok) throw new Error()
      const descData = await descRes.json()

      const enhanced = entities.map(e => {
        const gen = descData.entities.find((g: any) => g.name === e.name)
        return { ...e, description: gen?.description, status: 'generating' as const }
      })
      setEntities(enhanced)

      const completed = await Promise.all(enhanced.map(async (e) => {
        if (!e.description) return e
        try {
          const r = await fetch("/api/generate/images", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imagePrompt: GENERATE_ENTITY_IMAGE_PROMPT(e.description, undefined, imagePromptStyle), imageConfig: { aspect_ratio: "1:1" }, projectId: pid, projectName: title }) })
          if (!r.ok) throw new Error()
          const d = await r.json()
          return { ...e, imageUrl: d.imageUrl, status: 'completed' as const }
        } catch { return { ...e, status: 'error' as const } }
      }))
      setEntities(completed)
      await save({ entities: completed })
    } catch { toast.error("Failed") }
    finally { setLoading(false) }
  }

  const generateImages = async () => {
    let pid = project.projectId
    if (!pid) { const s = await save(); pid = s?.id }

    const isRegen = segments.every(s => s.imagePath)
    const promises = segments.map(async (seg, i) => {
      if (!seg.imagePrompt || (!isRegen && seg.imagePath)) return
      setImageStatuses(p => new Map(p).set(i, 'generating'))
      try {
        const prompt = mode === 'commentator' && commentator?.appearance?.imageUrl
          ? COMMENTATOR_IMAGE_GENERATION_PROMPT(seg.imagePrompt)
          : GENERATE_SEGMENT_IMAGE_PROMPT(seg.imagePrompt, imagePromptStyle)

        const payload: any = { imagePrompt: prompt, imageConfig: { aspect_ratio: "16:9" }, systemPrompt: imagePromptStyle, projectId: pid, projectName: title }
        // Entity reference images
        const matches = prompt.match(/<<([^>]+)>>/g)
        if (matches && entities.length) {
          const refs = entities.filter(e => matches.some(m => m.includes(e.name)) && e.imageUrl).map(e => e.imageUrl!)
          if (refs.length) payload.referenceImages = refs
        } else if (mode === 'commentator' && commentator?.appearance?.imageUrl) {
          payload.referenceImage = commentator.appearance.imageUrl
        }

        const res = await fetch('/api/generate/images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setSegments(prev => prev.map((s, j) => j === i ? { ...s, imagePath: data.imageUrl } : s))
        setImageStatuses(p => { const n = new Map(p); n.delete(i); return n })
      } catch { setImageStatuses(p => new Map(p).set(i, 'error')) }
    })
    await Promise.all(promises)
    setTimeout(() => save(), 200)
  }

  const generateAudioAction = async () => {
    await audio.generate(audioOpts())
    setStage('audio')
    setTimeout(() => save(), 200)
  }

  const transcribeAction = async () => {
    await transcription.transcribe(audio.batches, language)
    setStage('transcription')
    setTimeout(() => save(), 200)
  }

  const generateVideoAction = async () => {
    const segs = segments.filter(s => s.imagePrompt).map((s, i) => ({ id: `seg-${i}`, text: s.text, imageUrl: s.imagePath || '' }))
    await video.generate(segs, audio.batches, transcription.results)
    setStage('video')
  }

  const renderVideo = async () => {
    if (!video.videoProps) return
    await video.render(video.videoProps, captionStyle, project.projectId || undefined, title)
  }

  const downloadZip = async () => {
    await dl.downloadZip({
      segments,
      audioUrls: audio.batches.filter(b => b.status === 'completed' && b.url).map(b => b.url!),
      transcriptionResults: transcription.results,
    })
  }

  // ── Execute button logic per stage ──
  const exec = (() => {
    switch (stage) {
      case 'input': return { fn: splitScenes, ok: !!scriptText.trim(), label: "Split Scenes", busy: loading }
      case 'commentator': return { fn: saveCommentator, ok: !!commName.trim() && !!commImage, label: "Save Commentator", busy: false }
      case 'comments': return { fn: generateComments, ok: !!commentator, label: hasComments ? "Regenerate Comments" : "Generate Comments", busy: loading }
      case 'descriptions': return { fn: generateDescriptions, ok: segments.length > 0, label: hasPrompts ? "Regenerate" : "Generate Descriptions", busy: loading }
      case 'entities': return { fn: generateEntities, ok: entities.length > 0, label: "Generate Entity Assets", busy: loading }
      case 'images': return { fn: generateImages, ok: hasPrompts, label: hasImages ? "Regenerate Images" : "Generate Images", busy: imageStatuses.size > 0 }
      case 'audio': return { fn: generateAudioAction, ok: segments.length > 0, label: hasAudio ? "Regenerate Audio" : "Generate Audio", busy: audio.isLoading }
      case 'transcription': return { fn: transcribeAction, ok: hasAudio, label: "Transcribe", busy: transcription.isLoading }
      case 'video': return { fn: generateVideoAction, ok: transcription.results.length > 0, label: "Generate Preview", busy: video.isGenerating }
    }
  })()!

  const canNext = stageIdx < maxStep

  // ── Render ──
  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <header className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
            <h1 className="text-2xl font-bold">{mode === 'commentator' ? 'Story with Commentator' : 'Simple Story'}</h1>
          </div>
          <Button onClick={() => save()} disabled={!scriptText.trim() || project.isSaving} variant="outline">
            {project.isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Save
          </Button>
        </header>

        {/* Tabs */}
        <Tabs value={stage} onValueChange={v => { if (stages.indexOf(v as Stage) <= maxStep) setStage(v as Stage) }}>
          <TabsList className="w-full flex-wrap justify-start p-1">
            {stages.map((s, i) => (
              <TabsTrigger key={s} value={s} disabled={i > maxStep}
                className="flex-1 py-2 text-xs sm:text-sm truncate data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                {i + 1}. {STAGE_LABELS[s]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* ───────── STAGES ───────── */}

        {stage === 'input' && (
          <Card>
            <CardHeader><CardTitle>Project Settings</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title (optional)</label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Story title..." />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Language</label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="portuguese">Portuguese</SelectItem>
                      <SelectItem value="spanish">Spanish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Script</label>
                <Textarea value={scriptText} onChange={e => setScriptText(e.target.value)} placeholder="Your story..." className="min-h-[200px]" />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium">Segment size: {segmentSize[0]} chars</label>
                  <Slider value={segmentSize} onValueChange={setSegmentSize} max={500} min={100} step={10} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Voice</label>
                  <select className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm" value={audioVoice} onChange={e => setAudioVoice(e.target.value)}>
                    {VOICES.map(v => <option key={v.id} value={v.id}>{v.name} ({v.description})</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Image Style (System Prompt)</label>
                <Textarea value={imagePromptStyle} onChange={e => setImagePromptStyle(e.target.value)} placeholder="Visual style..." className="min-h-[80px]" />
              </div>
              {mode === 'simple' && (
                <div className="flex items-center space-x-2 pt-2 border-t">
                  <Switch checked={consistency} onCheckedChange={setConsistency} />
                  <div>
                    <label className="text-base font-medium">Character Consistency</label>
                    <p className="text-sm text-muted-foreground">Extract entities and generate reference images for consistent characters.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {stage === 'commentator' && (
          <Card>
            <CardHeader><CardTitle>Configure Commentator</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Commentator name" value={commName} onChange={e => setCommName(e.target.value)} />
              <Textarea placeholder="Personality description..." value={commPersonality} onChange={e => setCommPersonality(e.target.value)} rows={3} />
              <div className="space-y-2">
                <label className="text-sm font-medium">Commentator Image</label>
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <Textarea placeholder="Describe appearance for AI generation..." value={commImagePrompt} onChange={e => setCommImagePrompt(e.target.value)} rows={2} />
                    <Button onClick={async () => {
                      if (!commImagePrompt.trim()) return; setLoading(true)
                      try {
                        const r = await fetch('/api/generate/images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imagePrompt: commImagePrompt }) })
                        if (r.ok) { const d = await r.json(); if (d.imageUrl) setCommImage(d.imageUrl) }
                      } finally { setLoading(false) }
                    }} disabled={loading || !commImagePrompt.trim()} className="w-full">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />} Generate Image
                    </Button>
                  </div>
                  <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center overflow-hidden border">
                    {commImage ? <img src={commImage} alt="" className="w-full h-full object-cover" /> :
                      <div className="text-center p-2">
                        <input type="file" accept="image/*" className="hidden" id="comm-upload"
                          onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onloadend = () => setCommImage(r.result as string); r.readAsDataURL(f) } }} />
                        <label htmlFor="comm-upload" className="cursor-pointer text-xs text-muted-foreground"><Upload className="w-6 h-6 mx-auto mb-1" />Upload</label>
                      </div>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {stage === 'comments' && (
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Commentator Segments</CardTitle></CardHeader>
              <CardContent>
                {!hasComments ? <p className="text-muted-foreground text-center py-4">Click "Generate Comments" below.</p> :
                  <div className="space-y-3">
                    {segments.filter(s => s.type).map((seg, i) => (
                      <div key={i} className={cn("p-3 rounded-lg text-sm", seg.type === 'comment' ? "bg-blue-50 border border-blue-100 italic" : "bg-muted/50")}>
                        {seg.type === 'comment' && commentator?.appearance?.imageUrl && <img src={commentator.appearance.imageUrl} className="w-6 h-6 rounded-full inline mr-2" alt="" />}
                        {seg.text}
                      </div>
                    ))}
                  </div>}
              </CardContent>
            </Card>
          </div>
        )}

        {stage === 'descriptions' && (
          <div className="space-y-4">
            {segments.map((seg, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <div className="font-semibold text-xs text-muted-foreground uppercase">Scene {i + 1} {seg.type === 'comment' && '(Comment)'}</div>
                  <p className="text-sm">{seg.text}</p>
                  {seg.imagePrompt && <div className="bg-muted p-2 rounded text-sm italic text-muted-foreground border-l-2">{seg.imagePrompt}</div>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {stage === 'entities' && (
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Characters & Entities</CardTitle>
                <CardDescription>Recurring entities extracted from scene prompts. Generate reference images for visual consistency.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {entities.map((e, i) => <span key={i} className="bg-muted px-3 py-1.5 rounded-full text-sm font-semibold border">{e.name}</span>)}
                </div>
              </CardContent>
            </Card>
            {entities.some(e => e.description || e.imageUrl) && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {entities.map((e, i) => (
                  <Card key={i} className="overflow-hidden p-0">
                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                      {e.imageUrl ? <img src={e.imageUrl} alt={e.name} className="object-cover w-full h-full" /> :
                        <div className="text-muted-foreground text-sm">{e.status === 'generating' || loading ? <Loader2 className="h-8 w-8 animate-spin" /> : 'Pending'}</div>}
                    </div>
                    <CardContent><h3 className="font-bold">{e.name}</h3>{e.description && <p className="text-sm text-muted-foreground">{e.description}</p>}</CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {stage === 'images' && (
          <div className="grid grid-cols-2 gap-4">
            {segments.filter(s => s.imagePrompt).map((seg, i) => {
              const st = imageStatuses.get(i)
              return (
                <Card key={i}>
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs text-muted-foreground italic">{seg.imagePrompt}</p>
                    {seg.imagePath && st !== 'generating' ? (
                      <div className="relative group">
                        <img src={seg.imagePath} alt={`Scene ${i + 1}`} className="w-full rounded" />
                        <Button size="icon" variant="secondary" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"
                          onClick={() => {
                            const idx = segments.indexOf(seg)
                            setImageStatuses(p => new Map(p).set(idx, 'generating'))
                            const prompt = GENERATE_SEGMENT_IMAGE_PROMPT(seg.imagePrompt!, imagePromptStyle)
                            fetch('/api/generate/images', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ imagePrompt: prompt, imageConfig: { aspect_ratio: "16:9" }, projectId: project.projectId, projectName: title }) })
                              .then(r => r.json()).then(d => {
                                setSegments(prev => prev.map((s, j) => j === segments.indexOf(seg) ? { ...s, imagePath: d.imageUrl } : s))
                                setImageStatuses(p => { const n = new Map(p); n.delete(segments.indexOf(seg)); return n })
                              }).catch(() => setImageStatuses(p => new Map(p).set(segments.indexOf(seg), 'error')))
                          }}>
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : st === 'generating' ? <Skeleton className="w-full h-48" /> :
                      st === 'error' ? <div className="h-48 bg-muted rounded flex items-center justify-center text-sm text-muted-foreground">Error</div> :
                        <div className="h-48 bg-muted/40 rounded flex items-center justify-center border border-dashed text-muted-foreground/50 text-sm">Waiting...</div>}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {stage === 'audio' && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Audio Generation</CardTitle>
                {audio.batches.length > 0 && <span className="text-xs text-muted-foreground">{audio.batches.filter(b => b.status === 'completed').length}/{audio.batches.length} done</span>}
              </div>
            </CardHeader>
            <CardContent>
              {!audio.batches.length && !audio.isLoading ? <p className="text-center py-8 text-muted-foreground">Click "Generate Audio" below.</p> :
                audio.isLoading && !audio.batches.length ? <div className="flex justify-center py-8 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Generating...</div> :
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {audio.batches.map(b => (
                      <div key={b.index} className={cn("p-3 rounded border text-sm", b.status === 'error' ? "bg-red-50/50 border-red-200" : b.status === 'completed' ? "bg-green-50/30 border-green-200/50" : "bg-muted/50")}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-mono text-xs">#{b.index + 1} — {b.status}</span>
                          <div className="flex gap-1">
                            {b.status === 'completed' && b.url && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => new Audio(b.url!).play()}><Play className="w-3 h-3" /></Button>}
                            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => audio.regenerateBatch(b.index, audioOpts())} disabled={b.status === 'generating'}>
                              {b.status === 'error' ? 'Retry' : 'Redo'}
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 border-l-2 pl-1">{b.text}</p>
                        {b.status === 'completed' && b.url && <audio controls src={b.url} className="w-full h-8 mt-1" />}
                      </div>
                    ))}
                  </div>}
              {mode === 'commentator' && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  <label className="text-sm font-medium">Audio System Prompt</label>
                  <Textarea value={audioSystemPrompt} onChange={e => setAudioSystemPrompt(e.target.value)} placeholder="Instructions for audio tone..." className="min-h-[60px]" />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {stage === 'transcription' && (
          <Card>
            <CardHeader><CardTitle>Transcription</CardTitle></CardHeader>
            <CardContent>
              {!transcription.results.length && !transcription.isLoading ? <p className="text-center py-8 text-muted-foreground">Click "Transcribe" below.</p> :
                transcription.isLoading && !transcription.results.length ? <div className="flex justify-center py-8 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Transcribing via proxy...</div> :
                  <div className="space-y-3">
                    {audio.batches.filter(b => b.status === 'completed' && b.url).map((b, i) => {
                      const r = transcription.results.find(r => r.url === b.url)
                      return (
                        <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded border">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">{i + 1}</div>
                            <span className="text-sm truncate max-w-[300px]">{b.text.substring(0, 50)}...</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {r?.status === 'completed' ? <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Done</span> :
                              r?.status === 'error' ? <>
                                <span className="text-xs text-red-600"><X className="w-3 h-3 inline" /> Error</span>
                                <Button size="sm" variant="ghost" className="h-6" onClick={() => transcription.retry(b.url!, language)}><RefreshCw className="w-3 h-3" /></Button>
                              </> :
                                <span className="text-xs text-muted-foreground">{transcription.isLoading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Pending'}</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>}
            </CardContent>
          </Card>
        )}

        {stage === 'video' && (
          <Card>
            <CardHeader><CardTitle>Video Preview</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Font Size ({captionStyle.fontSize}px)</label>
                  <Slider min={40} max={150} step={5} value={[captionStyle.fontSize]} onValueChange={v => setCaptionStyle(p => ({ ...p, fontSize: v[0] }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Highlight Color</label>
                  <div className="flex gap-2">
                    {["#FFE81F", "#FFFFFF", "#00FF00", "#FF00FF", "#00FFFF"].map(c => (
                      <button key={c} className={cn("w-6 h-6 rounded-full border", captionStyle.highlightColor === c && "ring-2 ring-primary ring-offset-2")}
                        style={{ backgroundColor: c }} onClick={() => setCaptionStyle(p => ({ ...p, highlightColor: c }))} />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Words/Line</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Button key={n} variant={captionStyle.maxWordsPerLine === n ? "default" : "outline"} size="sm" className="h-8 w-8 p-0"
                        onClick={() => setCaptionStyle(p => ({ ...p, maxWordsPerLine: n }))}>{n}</Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={renderVideo} disabled={video.isRendering}>
                  {video.isRendering ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Rendering...</> : <><Download className="w-4 h-4 mr-2" /> Render MP4</>}
                </Button>
                <Button variant="outline" onClick={downloadZip} disabled={dl.isDownloading}>
                  {dl.isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} ZIP
                </Button>
              </div>

              {video.renderProgress && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{video.renderProgress.stage} {video.renderProgress.renderedFrames ?? ''}/{video.renderProgress.totalFrames ?? ''}</span>
                    <span>{video.renderProgress.progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${video.renderProgress.progress}%` }} />
                  </div>
                </div>
              )}

              {video.videoProps && <VideoPlayer props={{ ...video.videoProps, captionStyle }} />}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/80 backdrop-blur-md z-40 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <Button variant="outline" onClick={() => { if (stageIdx > 0) setStage(stages[stageIdx - 1]) }} disabled={stageIdx === 0} className="w-28">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button size="lg" onClick={exec.fn} disabled={!exec.ok || exec.busy} className="flex-1 max-w-sm rounded-full shadow-lg font-semibold">
            {exec.busy ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Play className="w-5 h-5 mr-2" />} {exec.label}
          </Button>
          <Button onClick={() => { if (canNext) setStage(stages[stageIdx + 1]) }} disabled={!canNext}
            className={cn("w-28 transition-all", canNext ? "shadow-md ring-2 ring-primary/20" : "opacity-40")}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}
```

---

## API Routes (updated imports)

### `src/app/api/generate/audio/route.ts`
```typescript
import { NextRequest, NextResponse } from "next/server"
import { generateAudio } from "@/lib/ai/processors/audio-generator"

export async function POST(request: NextRequest) {
  try {
    const { text, voice, systemPrompt, targetBatchIndices, projectId, projectName } = await request.json()
    if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 })
    const result = await generateAudio({ text, voice, systemPrompt, targetBatchIndices, projectId: projectId || 'temp', projectName: projectName || 'untitled' })
    return NextResponse.json(result)
  } catch (e: any) {
    console.error("Audio API Error:", e)
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 })
  }
}
```

### `src/app/api/generate/commentator/route.ts`
```typescript
import { NextRequest, NextResponse } from "next/server"
import { generateCommentsWithCommentator } from "@/lib/ai/processors/commentator"

export async function POST(request: NextRequest) {
  try {
    const { commentatorDescription, segments } = await request.json()
    if (!commentatorDescription || !segments?.length) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    return NextResponse.json(await generateCommentsWithCommentator({ commentatorDescription, segments }))
  } catch (e: any) {
    console.error("Commentator API Error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
```

### `src/app/api/generate/descriptions/route.ts`
```typescript
import { NextRequest, NextResponse } from "next/server"
import { generateSceneDescriptions } from "@/lib/ai/processors/scene-visualizer"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.segments?.length) return NextResponse.json({ error: "Missing segments" }, { status: 400 })
    return NextResponse.json(await generateSceneDescriptions(body))
  } catch (e: any) {
    console.error("Descriptions API Error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
```

### `src/app/api/generate/entities/descriptions/route.ts`
```typescript
import { NextRequest, NextResponse } from "next/server"
import { execute } from "@/lib/ai/providers"
import { ENHANCE_ENTITIES_PROMPT } from "@/lib/ai/prompts/prompts"

export async function POST(request: NextRequest) {
  try {
    const { entities, segments } = await request.json()
    if (!entities?.length || !segments?.length) return NextResponse.json({ error: "Missing data" }, { status: 400 })

    const { text: raw } = await execute('generateText', { prompt: ENHANCE_ENTITIES_PROMPT(segments, "English", entities) })

    let clean = raw.trim()
    const m = clean.match(/```json\s*((?:\{[\s\S]*?\}|\[[\s\S]*?\]))\s*```/) || clean.match(/((?:\{[\s\S]*?\}|\[[\s\S]*?\]))/)
    if (m) clean = m[1]

    let parsed = JSON.parse(clean)
    if (!Array.isArray(parsed) && typeof parsed === 'object') {
      parsed = Object.entries(parsed).map(([name, description]) => ({ name, description }))
    }

    return NextResponse.json({ entities: parsed })
  } catch (e: any) {
    console.error("Enhance entities error:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
```

### `src/app/api/generate/images/route.ts`
```typescript
import { NextRequest, NextResponse } from "next/server"
import { generateSingleImage } from "@/lib/ai/processors/image-generator"
import { StorageService } from "@/lib/storage"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.imagePrompt) return NextResponse.json({ error: "Missing imagePrompt" }, { status: 400 })

    let imageUrl = await generateSingleImage(body)

    if (body.projectId && body.projectName && imageUrl.startsWith('data:image/')) {
      const m = imageUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/)
      if (m) {
        const local = await StorageService.saveBase64Image(body.projectId, `gen-${Date.now()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`, m[2], body.projectName)
        if (local) imageUrl = local
      }
    }

    return NextResponse.json({ imageUrl })
  } catch (e: any) {
    console.error("Images API Error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
```

### `src/app/api/generate/split/route.ts`
```typescript
import { NextRequest, NextResponse } from "next/server"
import { splitText } from "@/lib/text-segmentation"

export async function POST(request: NextRequest) {
  try {
    const { text, segmentLength } = await request.json()
    if (!text || !segmentLength) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    return NextResponse.json({ segments: splitText(text, segmentLength) })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
```

### `src/app/api/generate/transcription/route.ts`

**Unchanged** — keeps the proxy-based free ElevenLabs STT.

### `src/app/api/generate/zip/route.ts`

**Unchanged** — works fine as-is.

### `src/app/api/projects/route.ts`

**Unchanged**.

### `src/app/api/projects/[id]/route.ts`

**Unchanged**.

### `src/app/api/render/route.ts`

**Unchanged**.

---

## Summary: what changed

| Area | Before | After |
|---|---|---|
| **Provider layer** | 1 hardcoded file (`custom-client.ts`, 150 lines) | `config.ts` + `registry.ts` + 3 providers (~200 lines total), auto-fallback |
| **Processors** | 4 files using `pipe()` abstraction + custom-client | 4 files, plain async, use registry |
| **UI components** | 12+ files across `flows/`, `shared/`, `StageControls`, etc (~2000 lines) | 1 file: `StoryFlow.tsx` (~350 lines) |
| **Hooks** | 5 separate files | 1 file: `hooks.ts` (~180 lines) |
| **Home page** | FlowSelector component + separate page | Inline in `page.tsx` |
| **Proxy/transcription** | ✅ kept | ✅ kept |
| **Deleted** | — | `pipeline.ts`, `custom-client.ts`, `createForm.tsx`, entire `flows/` + `shared/` dirs, 5 hook files |
| **Total flow UI** | ~2000 lines across 12+ files | ~530 lines across 2 files |

The provider system now works like your original spec:

```
generateImage called → tries void/gemini-3-pro → fails (429) 
                     → tries air/nano-banana-2 → fails (timeout)
                     → tries air/seedream-4.5 → success ✅
```

Adding a new provider: create one file in `providers/`, import it in `index.ts`, add entries to `config.ts`. Three steps, zero changes to processors or UI.