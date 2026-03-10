import { ActionType, ACTIONS, PROVIDER_RPM } from './config'
import { getProvider, getCredentials, ActionMap, Handler } from './registry'
import { acquireSlot } from './rate-limiter'
import { createLogger } from '@/lib/logger'

const log = createLogger('queue')

// ── Types ─────────────────────────────────────────────────

interface ProviderSlot {
  providerName: string
  model: string
  handler: Handler<any, any>
  creds: { baseUrl: string; apiKey: string }
}

interface QueueJob<Req> {
  id: number
  request: Req
  attempts: number
  failedOn: Set<string>
  lastError?: string
}

export interface BatchResult<Res> {
  id: number
  status: 'success' | 'error'
  data?: Res
  error?: string
  provider?: string
  durationMs?: number
}

// ── Batch executor ────────────────────────────────────────

export async function executeBatch<A extends ActionType>(
  action: A,
  requests: ActionMap[A]['req'][],
  opts: {
    maxRetries?: number
    onProgress?: (completed: number, total: number) => void
  } = {},
): Promise<BatchResult<ActionMap[A]['res']>[]> {
  const maxRetries = opts.maxRetries ?? 3
  const total = requests.length

  // 1. Resolve all providers that can handle this action
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
  const rpmInfo = providerNames.map(n => `${n}:${PROVIDER_RPM[n] ?? '∞'}rpm`).join(', ')
  log.info(`Batch start: ${total} ${action} jobs → ${slots.length} model(s) across ${providerNames.length} provider(s) (${rpmInfo})`)

  // 2. Create shared state
  const results: BatchResult<ActionMap[A]['res']>[] = new Array(total)
  const mainQueue: QueueJob<ActionMap[A]['req']>[] = requests.map((req, i) => ({
    id: i, request: req, attempts: 0, failedOn: new Set(),
  }))
  const retryQueue: QueueJob<ActionMap[A]['req']>[] = []
  let mainIdx = 0
  let completed = 0
  let pending = total

  // 3. Job picker — prefers retry jobs that haven't failed on this provider
  function takeJob(forProvider: string): QueueJob<ActionMap[A]['req']> | null {
    // First: retry jobs not yet tried on this provider
    for (let i = 0; i < retryQueue.length; i++) {
      if (!retryQueue[i].failedOn.has(forProvider)) {
        return retryQueue.splice(i, 1)[0]
      }
    }
    // Second: fresh jobs from main queue
    if (mainIdx < mainQueue.length) return mainQueue[mainIdx++]
    // Third: retry jobs even if already failed on this provider (last resort)
    if (retryQueue.length > 0) return retryQueue.shift()!
    return null
  }

  // 4. Worker — one per RPM-slot per provider
  async function worker(slot: ProviderSlot, workerId: string): Promise<void> {
    while (pending > 0) {
      const job = takeJob(slot.providerName)
      if (!job) {
        // No jobs available — other workers may be in-flight producing retries
        if (pending > 0) {
          await new Promise(r => setTimeout(r, 200))
          continue
        }
        break
      }

      await acquireSlot(slot.providerName)
      const start = Date.now()
      job.attempts++

      try {
        const data = await slot.handler(slot.model, job.request, slot.creds)
        const ms = Date.now() - start
        results[job.id] = { id: job.id, status: 'success', data, provider: `${slot.providerName}/${slot.model}`, durationMs: ms }
        completed++
        pending--
        log.success(`#${job.id + 1} ← ${slot.providerName}/${slot.model} (${ms}ms) [${completed}/${total}]`)
        opts.onProgress?.(completed, total)
      } catch (e: any) {
        const ms = Date.now() - start
        const msg = e?.message || String(e)
        job.failedOn.add(slot.providerName)
        job.lastError = msg

        if (job.attempts >= maxRetries) {
          results[job.id] = { id: job.id, status: 'error', error: msg, provider: `${slot.providerName}/${slot.model}`, durationMs: ms }
          completed++
          pending--
          log.error(`#${job.id + 1} ✗ ${slot.providerName}/${slot.model} — exhausted ${maxRetries} attempts [${completed}/${total}]`, msg)
          opts.onProgress?.(completed, total)
        } else {
          log.warn(`#${job.id + 1} ✗ ${slot.providerName}/${slot.model} (${ms}ms) — requeued (attempt ${job.attempts}/${maxRetries})`)
          retryQueue.push(job)
        }
      }
    }
  }

  // 5. Spawn workers: RPM-count workers per provider
  const workerPromises: Promise<void>[] = []
  for (const slot of slots) {
    const concurrency = Math.min(PROVIDER_RPM[slot.providerName] ?? 5, total)
    for (let w = 0; w < concurrency; w++) {
      const id = `${slot.providerName}/${slot.model}#${w}`
      workerPromises.push(worker(slot, id))
    }
  }

  await Promise.all(workerPromises)

  // 6. Final stats
  const successes = results.filter(r => r?.status === 'success').length
  const failures = results.filter(r => r?.status === 'error').length
  log.info(`Batch complete: ${successes}/${total} success, ${failures}/${total} failed`)

  // Fill any gaps (shouldn't happen, but safety)
  for (let i = 0; i < total; i++) {
    if (!results[i]) {
      results[i] = { id: i, status: 'error', error: 'Job was never processed' }
    }
  }

  return results
}