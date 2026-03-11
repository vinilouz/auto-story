import { createLogger } from "@/lib/logger";
import { PROVIDER_RPM } from "./config";

const log = createLogger("rate-limit");
const WINDOW_MS = 60_000;
const windows = new Map<string, number[]>();

function getWindow(provider: string): number[] {
  let w = windows.get(provider);
  if (!w) {
    w = [];
    windows.set(provider, w);
  }
  return w;
}

function purge(w: number[], now: number): void {
  while (w.length && w[0] <= now - WINDOW_MS) w.shift();
}

/** Non-blocking: returns true if a slot was acquired, false if window is full. */
export function tryAcquireSlot(provider: string): boolean {
  const limit = PROVIDER_RPM[provider];
  if (!limit) return true;

  const now = Date.now();
  const w = getWindow(provider);
  purge(w, now);

  if (w.length < limit) {
    w.push(now);
    return true;
  }
  return false;
}

export function releaseSlot(provider: string): void {
  const w = windows.get(provider);
  if (w?.length) w.pop();
}

/** Returns ms until next slot becomes available. 0 = available now. */
export function nextSlotMs(provider: string): number {
  const limit = PROVIDER_RPM[provider];
  if (!limit) return 0;

  const now = Date.now();
  const w = getWindow(provider);
  purge(w, now);

  if (w.length < limit) return 0;
  return w[0] + WINDOW_MS - now;
}

/** Blocking: waits until a slot is available, then acquires it. */
export async function acquireSlot(provider: string): Promise<void> {
  while (true) {
    if (tryAcquireSlot(provider)) return;
    const waitMs = nextSlotMs(provider);
    log.warn(
      `${provider} — window full (${PROVIDER_RPM[provider]}rpm), waiting ${Math.ceil(waitMs / 1000)}s`,
    );
    await new Promise<void>((r) => setTimeout(r, waitMs + 50));
  }
}
