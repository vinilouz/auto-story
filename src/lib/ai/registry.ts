import { ActionType, ACTIONS } from './config'
import { acquireSlot } from './rate-limiter'
import { createLogger } from '@/lib/logger'

const log = createLogger('AI')

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

export interface VideoRequest {
  prompt: string
  referenceImage?: string
  duration?: number
}
export interface VideoResponse { videoUrl: string }

export interface ActionMap {
  generateText: { req: TextRequest; res: TextResponse }
  generateImage: { req: ImageRequest; res: ImageResponse }
  generateAudio: { req: AudioRequest; res: AudioResponse }
  generateVideo: { req: VideoRequest; res: VideoResponse }
}

// ── Provider interface ────────────────────────────────────

export type Handler<Req, Res> = (
  model: string,
  req: Req,
  creds: { baseUrl: string; apiKey: string },
) => Promise<Res>

export interface Provider {
  name: string
  generateText?: Handler<TextRequest, TextResponse>
  generateImage?: Handler<ImageRequest, ImageResponse>
  generateAudio?: Handler<AudioRequest, AudioResponse>
  generateVideo?: Handler<VideoRequest, VideoResponse>
}

// ── Provider registry ─────────────────────────────────────

const providers = new Map<string, Provider>()

export function registerProvider(p: Provider): void {
  providers.set(p.name, p)
}

export function getProvider(name: string): Provider | undefined {
  return providers.get(name)
}

// ── Credentials ───────────────────────────────────────────

export function getCredentials(provider: string): { baseUrl: string; apiKey: string } | null {
  const key = provider.toUpperCase()
  const baseUrl = process.env[`${key}_BASE_URL`]
  const apiKey = process.env[`${key}_API_KEY`]
  if (!baseUrl || !apiKey) return null
  return { baseUrl, apiKey }
}

// ── Execute single (sequential fallback) ──────────────────

export async function execute<A extends ActionType>(
  action: A,
  request: ActionMap[A]['req'],
): Promise<ActionMap[A]['res']> {
  const chain = ACTIONS[action]
  if (!chain?.length) throw new Error(`No models configured for: ${action}`)

  const errors: string[] = []

  for (const { provider: name, model } of chain) {
    const provider = getProvider(name)
    const handler = provider?.[action] as Handler<any, any> | undefined
    const creds = getCredentials(name)

    if (!provider) { errors.push(`${name}: not registered`); continue }
    if (!handler) { errors.push(`${name}: does not support ${action}`); continue }
    if (!creds) { errors.push(`${name}/${model}: missing env ${name.toUpperCase()}_BASE_URL / ${name.toUpperCase()}_API_KEY`); continue }

    try {
      log.info(`${action} → ${name}/${model}`)
      await acquireSlot(name)
      const start = Date.now()
      const result = await handler(model, request, creds)
      log.success(`${action} ← ${name}/${model} (${Date.now() - start}ms)`)
      return result
    } catch (e: any) {
      const msg = e?.message || String(e)
      log.warn(`${action} ✗ ${name}/${model}: ${msg}`)
      errors.push(`${name}/${model}: ${msg}`)
    }
  }

  const fullError = `All providers failed for ${action}:\n  ${errors.join('\n  ')}`
  log.error(fullError)
  throw new Error(fullError)
}