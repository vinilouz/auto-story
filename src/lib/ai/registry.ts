import { ActionType, ACTIONS, getCredentials } from './config'
import { acquireSlot, waitAfter429 } from './rate-limiter'

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
  /** Duration hint in seconds */
  duration?: number
}
export interface VideoResponse {
  /** URL or base64 data URL of the generated video clip */
  videoUrl: string
}

interface ActionMap {
  generateText: { req: TextRequest; res: TextResponse }
  generateImage: { req: ImageRequest; res: ImageResponse }
  generateAudio: { req: AudioRequest; res: AudioResponse }
  generateVideo: { req: VideoRequest; res: VideoResponse }
}

// ── Provider interface ────────────────────────────────────

type Handler<Req, Res> = (model: string, req: Req, creds: { baseUrl: string; apiKey: string }) => Promise<Res>

export interface Provider {
  name: string
  generateText?: Handler<TextRequest, TextResponse>
  generateImage?: Handler<ImageRequest, ImageResponse>
  generateAudio?: Handler<AudioRequest, AudioResponse>
  generateVideo?: Handler<VideoRequest, VideoResponse>
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
      await acquireSlot(name)
      return await handler(model, request, creds)
    } catch (e: any) {
      const msg = e?.message || String(e)
      if (msg.includes('429')) {
        await waitAfter429(name)
        try {
          await acquireSlot(name)
          return await handler(model, request, creds)
        } catch (retryErr: any) {
          errors.push(`${name}/${model}: ${retryErr?.message || retryErr}`)
          continue
        }
      }
      console.warn(`[AI] ${name}/${model} failed: ${msg}`)
      errors.push(`${name}/${model}: ${msg}`)
    }
  }

  throw new Error(`All providers failed for ${action}:\n${errors.join('\n')}`)
}