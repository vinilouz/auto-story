export type ActionType = 'generateText' | 'generateImage' | 'generateAudio' | 'generateVideo'

export interface ModelConfig {
  provider: string
  model: string
  clipDuration?: number
}

/**
 * Provider chain per action. Order = preference.
 * Queue distributes across ALL, not sequential fallback.
 */
export const ACTIONS: Record<ActionType, ModelConfig[]> = {
  generateText: [
    { provider: 'void', model: 'gemini-3.1-flash-lite-preview' },
  ],
  generateImage: [
    { provider: 'air', model: 'nano-banana-pro' },
    { provider: 'void', model: 'gemini-3-pro-image-preview' },
  ],
  generateAudio: [
    { provider: 'naga', model: 'eleven-multilingual-v2:free' },
  ],
  generateVideo: [
    { provider: 'air', model: 'grok-imagine-video', clipDuration: 6 },
    { provider: 'air', model: 'veo-3.1-fast', clipDuration: 8 },
  ],
}

/** RPM (requests per minute) per provider. Used by rate-limiter and queue. */
export const PROVIDER_RPM: Record<string, number> = {
  void: 20,
  air: 5,
  naga: 10,
}

export function getVideoClipDuration(): number {
  return ACTIONS.generateVideo[0]?.clipDuration ?? 6
}