export type ActionType = 'generateText' | 'generateImage' | 'generateAudio' | 'generateVideo'

export interface ModelConfig {
  provider: string
  model: string
  clipDuration?: number
}

/**
 * Provider chain por action. Ordem = preferência.
 */
export const ACTIONS: Record<ActionType, ModelConfig[]> = {
  generateText: [
    { provider: 'void', model: 'gpt-5.4' },
  ],
  generateImage: [
    { provider: 'void', model: 'gemini-3-pro-image-preview' },
    // { provider: 'air', model: 'nano-banana-2' },
  ],
  generateAudio: [
    { provider: 'naga', model: 'eleven-multilingual-v2:free' },
  ],
  generateVideo: [
    { provider: 'air', model: 'grok-imagine-video', clipDuration: 6 },
    // { provider: 'air', model: 'veo-3.1-fast', clipDuration: 8 },
  ],
}

/**
 * RPM = quantos requests podem *começar* por minuto (janela deslizante 60s).
 * Usado pelo rate-limiter — controla o ritmo de disparo.
 */
export const PROVIDER_RPM: Record<string, number> = {
  void: 30,
  air: 20,
  naga: 10,
}

/**
 * CONCURRENCY = quantos requests ficam *em-flight simultaneamente*.
 *
 * ⚠️  RPM ≠ CONCURRENCY — são conceitos diferentes!
 *
 * RPM=20 significa "pode disparar 20 por minuto".
 * CONCURRENCY=3 significa "no máximo 3 ao mesmo tempo".
 *
 * Para vídeo (30–120s por request): concurrency baixo é essencial.
 * Se mandar 20 simultâneos, o provider rejeita a maioria por sobrecarga.
 *
 * Raciocínio para air/vídeo:
 *   - Provider diz: "não passe do RPM e está tudo bem"
 *   - Mas na prática, 20 requests longos simultâneos → timeout/rejeição
 *   - Com concurrency=3: 3 em-flight, rate-limiter garante ≤20/min
 *   - Os logs vão mostrar se aparecem 429 (rate-limit) ou 5xx (sobrecarga)
 *   - Se só aparecer 💥 server error → aumentar concurrency
 *   - Se aparecer ⏱ rate-limit     → diminuir RPM ou concurrency
 *   - Se zero erros               → aumentar concurrency gradualmente
 */
export const PROVIDER_CONCURRENCY: Record<string, number> = {
  void: 30,
  air: 20,
  naga: 10,
}

export function getVideoClipDuration(): number {
  return ACTIONS.generateVideo[0]?.clipDuration ?? 6
}