import { createLogger } from "@/lib/logger";
import { ACTIONS, type ActionType } from "./config";
import { type ActionMap, getCredentials, getProvider, type Handler } from "./registry";

const log = createLogger("queue");

interface Job<Req> {
  id: number;
  request: Req;
  attempts: number;
}

export interface BatchResult<Res> {
  id: number;
  status: "success" | "error";
  data?: Res;
  error?: string;
  errorKind?: "rate-limit" | "server" | "payload" | "unknown";
  provider?: string;
  durationMs?: number;
}

function classifyError(msg: string): BatchResult<unknown>["errorKind"] {
  const m = msg.toLowerCase();
  if (m.includes("429") || m.includes("rate limit") || m.includes("too many requests")) return "rate-limit";
  if (m.includes("500") || m.includes("502") || m.includes("503") || m.includes("504") || m.includes("server error")) return "server";
  if (m.includes("400") || m.includes("401") || m.includes("403") || m.includes("413") || m.includes("422") || m.includes("bad request") || m.includes("invalid") || m.includes("payload too large")) return "payload";
  return "unknown";
}

function errorLabel(kind: BatchResult<unknown>["errorKind"]): string {
  switch (kind) {
    case "rate-limit": return "⏱ rate-limit (429)";
    case "server": return "💥 server error (5xx)";
    case "payload": return "📋 payload error (4xx)";
    default: return "❓ unknown";
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

export async function executeBatch<A extends ActionType>(
  action: A,
  requests: ActionMap[A]["req"][],
  opts: {
    maxRetries?: number;
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
    onResult?: (result: BatchResult<ActionMap[A]["res"]>) => void;
  } = {},
): Promise<BatchResult<ActionMap[A]["res"]>[]> {
  const maxRetries = opts.maxRetries ?? 3;
  const concurrency = opts.concurrency ?? 5;
  const total = requests.length;

  const cfg = ACTIONS[action]?.[0];
  if (!cfg) throw new Error(`No config for action: ${action}`);

  const provider = getProvider(cfg.provider);
  const handler = provider?.[action];
  const creds = getCredentials(cfg.provider);

  if (!provider || !handler || !creds) {
    throw new Error(`No available provider for ${action}`);
  }

  const runHandler = handler as Handler<unknown, unknown>;
  const validCreds = creds;

  log.info(`Batch: ${total} × ${action} via ${cfg.provider}/${cfg.model} (concurrency: ${concurrency})`);

  const results: BatchResult<ActionMap[A]["res"]>[] = new Array(total);
  let completed = 0;

  async function processJob(job: Job<ActionMap[A]["req"]>): Promise<void> {
    const start = Date.now();

    try {
      const data = await withBackoff(async () => {
        return runHandler(cfg.model || "default", job.request, validCreds);
      }, maxRetries);

      const ms = Date.now() - start;

      const result: BatchResult<ActionMap[A]["res"]> = {
        id: job.id,
        status: "success",
        data: data as ActionMap[A]["res"],
        provider: `${cfg.provider}/${cfg.model || "default"}`,
        durationMs: ms,
      };
      results[job.id] = result;
      completed++;
      log.success(`#${job.id + 1} ✓ ${cfg.provider}/${cfg.model || "default"} (${ms}ms) [${completed}/${total}]`);
      opts.onProgress?.(completed, total);
      opts.onResult?.(result);
    } catch (e) {
      const ms = Date.now() - start;
      const msg = e instanceof Error ? e.message : String(e);
      const kind = classifyError(msg);

      const result: BatchResult<ActionMap[A]["res"]> = {
        id: job.id,
        status: "error",
        error: msg,
        errorKind: kind,
        provider: `${cfg.provider}/${cfg.model || "default"}`,
        durationMs: ms,
      };
      results[job.id] = result;
      completed++;
      log.error(`#${job.id + 1} ✗ ${cfg.provider}/${cfg.model} ${errorLabel(kind)} [${completed}/${total}]\n  → ${msg.substring(0, 300)}`);
      opts.onProgress?.(completed, total);
      opts.onResult?.(result);
    }
  }

  const jobs = requests.map((req, i) => ({ id: i, request: req, attempts: 0 }));

  for (let i = 0; i < jobs.length; i += concurrency) {
    const batch = jobs.slice(i, i + concurrency);
    await Promise.all(batch.map(processJob));
  }

  const ok = results.filter((r) => r?.status === "success").length;
  log.info(`Batch concluído: ${ok}/${total} ok`);

  return results;
}
