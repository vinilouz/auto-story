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
  lastProvider?: string   // para log de crossover
  notBefore?: number      // backoff: não processar antes deste timestamp
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

/**
 * Backoff exponencial com jitter.
 *   attempt=1 → ~500ms   (dá tempo para void pegar o job)
 *   attempt=2 → ~1000ms
 *   attempt=3 → ~2000ms
 *   rate-limit → base maior (5s) para deixar o provider respirar
 */
function calcBackoff(attempt: number, kind: BatchResult<any>['errorKind']): number {
  const base = kind === 'rate-limit' ? 5_000 : 500
  const exp = Math.min(base * Math.pow(2, attempt - 1), 30_000)
  const jitter = Math.random() * 0.3 * exp
  return Math.round(exp + jitter)
}

// ── Batch executor ────────────────────────────────────────
//
//  Melhorias vs versão anterior:
//
//  1. BACKOFF EXPONENCIAL — retries não são imediatos.
//     Antes: retry air em 219ms → provedor rejeita de novo em <250ms.
//     Agora: retry air aguarda ≥500ms → worker void tem tempo de pegar o job.
//
//  2. CROSSOVER AUTOMÁTICO — fila é SHARED entre todos os providers.
//     Quando air falha e coloca job no backlog com delay=500ms, e um worker
//     void está disponível antes disso, void pega o job (crossover logado).
//
//  3. WORKERS LAZY NO BACKLOG — workers não ficam em spin-loop.
//     Quando todos os jobs disponíveis foram distribuídos mas há backlog futuro,
//     o worker dorme até o próximo job ficar pronto (max 500ms por ciclo).
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

  // 2. Fila principal + backlog (jobs aguardando backoff)
  const results: BatchResult<ActionMap[A]['res']>[] = new Array(total)
  const mainQueue: Job<ActionMap[A]['req']>[] = requests.map((req, i) => ({
    id: i, request: req, attempts: 0,
  }))
  let mainIdx = 0
  let completed = 0
  const backlog: Job<ActionMap[A]['req']>[] = []

  function takeJob(): Job<ActionMap[A]['req']> | null {
    const now = Date.now()
    // Backlog primeiro: jobs que já cumpriram o backoff
    const bi = backlog.findIndex(j => !j.notBefore || j.notBefore <= now)
    if (bi !== -1) return backlog.splice(bi, 1)[0]
    // Fila principal
    if (mainIdx < mainQueue.length) return mainQueue[mainIdx++]
    return null
  }

  function hasWork(): boolean {
    return mainIdx < mainQueue.length || backlog.length > 0
  }

  function requeue(job: Job<ActionMap[A]['req']>, kind: BatchResult<any>['errorKind']): void {
    const delay = calcBackoff(job.attempts, kind)
    job.notBefore = Date.now() + delay
    backlog.push(job)
    log.warn(`  ↳ #${job.id + 1} backoff ${delay}ms — outro provider pode pegar antes`)
  }

  // 3. Worker — usa o slot do seu provider mas compete pela fila global
  async function worker(slot: ProviderSlot): Promise<void> {
    while (true) {
      const job = takeJob()

      if (!job) {
        if (!hasWork()) break  // sem mais trabalho para ninguém → encerra

        // Tem backlog mas ainda não disponível → aguarda até o próximo ficar pronto
        if (backlog.length > 0) {
          const nearest = Math.min(...backlog.map(j => j.notBefore ?? 0))
          const sleepMs = Math.max(50, Math.min(nearest - Date.now(), 500))
          await new Promise(r => setTimeout(r, sleepMs))
          continue
        }

        // Fila principal vazia e sem backlog → encerra
        break
      }

      // Aguarda slot de rate-limit (async — não bloqueia outros workers)
      await acquireSlot(slot.providerName)

      const start = Date.now()
      job.attempts++

      if (job.lastProvider && job.lastProvider !== `${slot.providerName}/${slot.model}`) {
        log.info(`#${job.id + 1} ↪ crossover ${job.lastProvider} → ${slot.providerName}/${slot.model}`)
      }

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
        job.lastProvider = `${slot.providerName}/${slot.model}`

        // Payload errado → retry não adianta
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
          requeue(job, kind)
        }
      }
    }
  }

  // 4. Spawna workers (cap em total para não criar workers completamente ociosos)
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

  // 6. Resumo final
  const ok = results.filter(r => r?.status === 'success').length
  const byKind = results.filter(r => r?.status === 'error').reduce((acc, r) => {
    const k = r.errorKind ?? 'unknown'; acc[k] = (acc[k] ?? 0) + 1; return acc
  }, {} as Record<string, number>)

  const failSummary = Object.entries(byKind).map(([k, n]) => `${n}×${k}`).join(', ')
  log.info(`Batch concluído: ${ok}/${total} ok${failSummary ? ` | falhas: ${failSummary}` : ''}`)

  return results
}