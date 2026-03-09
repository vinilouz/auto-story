export type ActionType = 'generateText' | 'generateImage' | 'generateAudio' | 'generateVideo'

export interface ModelConfig {
  provider: string
  model: string
  /** Clip duration in seconds for video models */
  clipDuration?: number
}

export const ACTIONS: Record<ActionType, ModelConfig[]> = {
  generateText: [
    { provider: 'void', model: 'gpt-5.3-chat-latest' },
  ],
  generateImage: [
    // { provider: 'air', model: 'nano-banana-pro' },
    { provider: 'void', model: 'gemini-3-pro-image-preview' },
    // { provider: 'void', model: 'gemini-3.1-flash-image-preview' },
  ],
  generateAudio: [
    { provider: 'naga', model: 'eleven-multilingual-v2:free' },
  ],
  generateVideo: [
    { provider: 'air', model: 'grok-imagine-video', clipDuration: 6 },
    { provider: 'air', model: 'veo-3.1-fast', clipDuration: 8 },
  ],
}

export function getCredentials(provider: string) {
  const key = provider.toUpperCase()
  const baseUrl = process.env[`${key}_BASE_URL`] || ''
  const apiKey = process.env[`${key}_API_KEY`] || ''
  if (!baseUrl || !apiKey) return null
  return { baseUrl, apiKey }
}

export function getVideoClipDuration(): number {
  const first = ACTIONS.generateVideo[0]
  return first?.clipDuration ?? 6
}