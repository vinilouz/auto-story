import { ActionType, ACTIONS, PROVIDER_RPM, PROVIDER_CONCURRENCY } from './config'
import { getProvider, getCredentials, ActionMap, Handler } from './registry'
import { acquireSlot } from './rate-limiter'
import { saveDebug } from './registry'
import { createLogger } from '@/lib/logger'

const log = createLogger('queue')

// ── Types ─────────────────────────────────────────────────

interface ProviderSlot {
  providerName: string
  model: string
  handler: Handler<any, any>
  creds: { baseUrl: string; apiKey: string }
}

interface Job<Req> {
  id: number
  request: Req
  attempts: number
}

export interface BatchResult<Res> {
  id: number
  status: 'success' | 'error'
  data?: Res
  error?: string
  errorKind?: 'rate-limit' | 'server' | 'payload' | 'unknown'
  provider?: string
  durationMs?: number
}

// ── Error classifier ───────────────────────────────────────
//
// Distingue a origem do erro para diagnóstico e decisão de retry:
//   rate-limit → 429 — estamos enviando rápido demais
//   server     → 5xx — provider com problema (retry faz sentido)
//   payload    → 4xx (não 429) — nosso payload está errado (retry NÃO ajuda)
//   unknown    → erro de rede, timeout, parse — investigar
//
function classifyError(msg: string): BatchResult<any>['errorKind'] {
  const m = msg.toLowerCase()
  if (m.includes('429') || m.includes('rate limit') || m.includes('too many requests')) return 'rate-limit'
  if (m.includes('500') || m.includes('502') || m.includes('503') || m.includes('504') || m.includes('server error')) return 'server'
  if (m.includes('400') || m.includes('401') || m.includes('403') || m.includes('422') || m.includes('bad request') || m.includes('invalid')) return 'payload'
  return 'unknown'
}

function errorLabel(kind: BatchResult<any>['errorKind']): string {
  switch (kind) {
    case 'rate-limit': return '⏱ rate-limit (429)'
    case 'server': return '💥 server error (5xx)'
    case 'payload': return '📋 payload error (4xx)'
    default: return '❓ unknown'
  }
}

// ── Batch executor ────────────────────────────────────────
//
// Modelo mental:
//   - CONCURRENCY workers por provider (não RPM — são conceitos diferentes!)
//   - Cada worker: aguarda slot de rate-limit → executa → sucesso/retry
//   - rate-limit (429): acquireSlot já desacelera automaticamente
//   - payload (4xx):    falha imediata, retry não vai resolver
//   - server/unknown:   retry até maxRetries
//
export async function executeBatch<A extends ActionType>(
  action: A,
  requests: ActionMap[A]['req'][],
  opts: {
    maxRetries?: number
    onProgress?: (completed: number, total: number) => void
    onResult?: (result: BatchResult<ActionMap[A]['res']>) => void
  } = {},
): Promise<BatchResult<ActionMap[A]['res']>[]> {
  const maxRetries = opts.maxRetries ?? 3
  const total = requests.length

  // 1. Resolver providers disponíveis
  const slots: ProviderSlot[] = []
  for (const cfg of ACTIONS[action]) {
    const provider = getProvider(cfg.provider)
    const handler = provider?.[action] as Handler<any, any> | undefined
    const creds = getCredentials(cfg.provider)

    if (!provider || !handler || !creds) {
      log.warn(`Skipping ${cfg.provider}/${cfg.model}: ${!provider ? 'not registered' : !handler ? 'no handler' : 'no credentials'}`)
      continue
    }
    slots.push({ providerName: cfg.provider, model: cfg.model, handler, creds })
  }

  if (slots.length === 0) throw new Error(`No available providers for ${action}`)

  const providerNames = [...new Set(slots.map(s => s.providerName))]
  const info = providerNames
    .map(n => `${n}: ${PROVIDER_RPM[n] ?? '∞'}rpm / ${PROVIDER_CONCURRENCY[n] ?? 3} concurrent`)
    .join(', ')
  log.info(`Batch: ${total} × ${action} | ${info}`)

  // 2. Fila compartilhada
  const results: BatchResult<ActionMap[A]['res']>[] = new Array(total)
  const queue: Job<ActionMap[A]['req']>[] = requests.map((req, i) => ({
    id: i, request: req, attempts: 0,
  }))
  let queueIdx = 0
  let completed = 0

  function takeJob(): Job<ActionMap[A]['req']> | null {
    if (queueIdx < queue.length) return queue[queueIdx++]
    return null
  }

  function requeueJob(job: Job<ActionMap[A]['req']>): void {
    queue.push(job)
  }

  // 3. Worker
  async function worker(slot: ProviderSlot): Promise<void> {
    while (true) {
      const job = takeJob()
      if (!job) break

      await acquireSlot(slot.providerName)
      const start = Date.now()
      job.attempts++

      try {
        const data = await slot.handler(slot.model, job.request, slot.creds)
        const ms = Date.now() - start
        saveDebug(action, slot.providerName, slot.model, job.request, data, ms)

        const result: BatchResult<ActionMap[A]['res']> = {
          id: job.id, status: 'success', data,
          provider: `${slot.providerName}/${slot.model}`, durationMs: ms,
        }
        results[job.id] = result
        completed++
        log.success(`#${job.id + 1} ✓ ${slot.providerName}/${slot.model} (${ms}ms) [${completed}/${total}]`)
        opts.onProgress?.(completed, total)
        opts.onResult?.(result)

      } catch (e: any) {
        const ms = Date.now() - start
        const msg = e?.message || String(e)
        const kind = classifyError(msg)
        saveDebug(action, slot.providerName, slot.model, job.request, null, ms, msg)

        // Payload errado → retry nunca vai funcionar
        if (kind === 'payload') {
          const result: BatchResult<ActionMap[A]['res']> = {
            id: job.id, status: 'error', error: msg, errorKind: kind,
            provider: `${slot.providerName}/${slot.model}`, durationMs: ms,
          }
          results[job.id] = result
          completed++
          log.error(`#${job.id + 1} ✗ ${slot.providerName}/${slot.model} ${errorLabel(kind)} — sem retry [${completed}/${total}]\n  → ${msg.substring(0, 300)}`)
          opts.onProgress?.(completed, total)
          opts.onResult?.(result)
          continue
        }

        if (job.attempts >= maxRetries) {
          const result: BatchResult<ActionMap[A]['res']> = {
            id: job.id, status: 'error', error: msg, errorKind: kind,
            provider: `${slot.providerName}/${slot.model}`, durationMs: ms,
          }
          results[job.id] = result
          completed++
          log.error(`#${job.id + 1} ✗ ${slot.providerName}/${slot.model} ${errorLabel(kind)} — esgotou ${maxRetries} tentativas [${completed}/${total}]\n  → ${msg.substring(0, 300)}`)
          opts.onProgress?.(completed, total)
          opts.onResult?.(result)
        } else {
          log.warn(`#${job.id + 1} ✗ ${slot.providerName}/${slot.model} ${errorLabel(kind)} (${ms}ms) — retry ${job.attempts}/${maxRetries}\n  → ${msg.substring(0, 300)}`)
          requeueJob(job)
        }
      }
    }
  }

  // 4. Spawna workers com CONCURRENCY (não RPM!)
  const workerPromises: Promise<void>[] = []
  for (const slot of slots) {
    const concurrency = Math.min(PROVIDER_CONCURRENCY[slot.providerName] ?? 3, total)
    log.info(`${slot.providerName}/${slot.model}: ${concurrency} workers (rate-limit: ${PROVIDER_RPM[slot.providerName] ?? '∞'}rpm)`)
    for (let w = 0; w < concurrency; w++) {
      workerPromises.push(worker(slot))
    }
  }

  await Promise.all(workerPromises)

  // 5. Preencher gaps (segurança)
  for (let i = 0; i < total; i++) {
    if (!results[i]) {
      results[i] = { id: i, status: 'error', error: 'Job não processado', errorKind: 'unknown' }
    }
  }

  // 6. Resumo final com breakdown por tipo de erro
  const ok = results.filter(r => r?.status === 'success').length
  const byKind = results.filter(r => r?.status === 'error').reduce((acc, r) => {
    const k = r.errorKind ?? 'unknown'
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const failSummary = Object.entries(byKind).map(([k, n]) => `${n}×${k}`).join(', ')
  log.info(`Batch concluído: ${ok}/${total} ok${failSummary ? ` | falhas: ${failSummary}` : ''}`)

  return results
}