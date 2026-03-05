const WINDOW_MS = 60_000
const RETRY_AFTER_MS = 60_000

const PROVIDER_LIMITS: Record<string, number> = {
  void: 20,
  air: 9,
  naga: 9,
}

const windows = new Map<string, number[]>()

function getWindow(provider: string): number[] {
  let w = windows.get(provider)
  if (!w) { w = []; windows.set(provider, w) }
  return w
}

function nextSlotMs(provider: string): number {
  const limit = PROVIDER_LIMITS[provider]
  if (!limit) return 0

  const now = Date.now()
  const w = getWindow(provider)

  while (w.length && w[0] <= now - WINDOW_MS) w.shift()

  if (w.length < limit) {
    w.push(now)
    return 0
  }

  return w[0] + WINDOW_MS - now
}

export async function acquireSlot(provider: string): Promise<void> {
  while (true) {
    const waitMs = nextSlotMs(provider)
    if (waitMs <= 0) return
    console.log(`[rate-limit] ${provider} — window full, waiting ${Math.ceil(waitMs / 1000)}s`)
    await new Promise<void>(resolve => setTimeout(resolve, waitMs + 50))
  }
}

export async function waitAfter429(provider: string): Promise<void> {
  console.log(`[rate-limit] ${provider} — 429 received, cooling down ${RETRY_AFTER_MS / 1000}s`)
  await new Promise<void>(resolve => setTimeout(resolve, RETRY_AFTER_MS))
}
