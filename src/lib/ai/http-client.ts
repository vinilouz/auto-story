import fs from "node:fs";
import path from "node:path";
import { createLogger } from "@/lib/logger";

const log = createLogger("http-client");

const DEBUG_LOGS_ENABLED = process.env.DEBUG_LOG === "true" || true;
const DEBUG_LOGS_LEVEL: "all" | "error" = "all";
const LOGS_DIR = path.join(process.cwd(), "logs");

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export function saveDebugLog(
  action: string,
  providerAndModel: string,
  durationMs: number,
  request: unknown,
  response: unknown,
  error?: string,
) {
  if (!DEBUG_LOGS_ENABLED) return;
  if (DEBUG_LOGS_LEVEL === "error" && !error) return;

  ensureLogsDir();

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const status = error ? "error" : "ok";
  const filename = `${action}-${providerAndModel.replace("/", "-")}-${status}-${ts}.json`;

  const data: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    action,
    provider: providerAndModel,
    durationMs,
    status,
  };

  if (request) data.request = request;
  if (response) data.response = response;
  if (error) data.error = error;

  try {
    fs.writeFileSync(
      path.join(LOGS_DIR, filename),
      JSON.stringify(data, null, 2),
    );
  } catch {}
}

export interface RequestOptions {
  timeoutMs?: number;
  actionName?: string;
  providerAndModel?: string;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs?: number,
) {
  if (!timeoutMs) return fetch(url, init);

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function handleResponse(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.substring(0, 300)}`);
  }
}

export async function apiRequest<T>(
  url: string,
  apiKey: string,
  body: unknown,
  opts?: RequestOptions,
): Promise<T> {
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      },
      opts?.timeoutMs,
    );

    await handleResponse(res);
    const data = await res.json();
    const duration = Date.now() - start;

    if (opts?.actionName && opts?.providerAndModel) {
      // Create a simplified response log to avoid storing giant base64 strings
      let logRes: unknown = data;
      if (data && typeof data === "object") {
        if ("b64_json" in data) logRes = { has_b64: true, url: data.url };
        else if ("words" in data)
          logRes = {
            words_count: Array.isArray(data.words) ? data.words.length : 0,
          };
      }
      saveDebugLog(
        opts.actionName,
        opts.providerAndModel,
        duration,
        body,
        logRes,
      );
    }

    return data as T;
  } catch (err: any) {
    const duration = Date.now() - start;
    if (opts?.actionName && opts?.providerAndModel) {
      saveDebugLog(
        opts.actionName,
        opts.providerAndModel,
        duration,
        body,
        null,
        err.message,
      );
    }
    throw err;
  }
}

export async function apiRequestRaw(
  url: string,
  apiKey: string,
  body: unknown,
  opts?: RequestOptions,
): Promise<ArrayBuffer> {
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      },
      opts?.timeoutMs,
    );

    await handleResponse(res);
    const buffer = await res.arrayBuffer();
    const duration = Date.now() - start;

    if (opts?.actionName && opts?.providerAndModel) {
      saveDebugLog(opts.actionName, opts.providerAndModel, duration, body, {
        byteLength: buffer.byteLength,
      });
    }

    return buffer;
  } catch (err: any) {
    const duration = Date.now() - start;
    if (opts?.actionName && opts?.providerAndModel) {
      saveDebugLog(
        opts.actionName,
        opts.providerAndModel,
        duration,
        body,
        null,
        err.message,
      );
    }
    throw err;
  }
}

export async function apiRequestSSE(
  url: string,
  apiKey: string,
  body: unknown,
  opts?: RequestOptions,
): Promise<Response> {
  // We log the initiation, not the SSE chunks, since SSE is read asynchronously downstream
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
      },
      opts?.timeoutMs,
    );

    await handleResponse(res);

    if (opts?.actionName && opts?.providerAndModel) {
      saveDebugLog(
        opts.actionName,
        opts.providerAndModel,
        Date.now() - start,
        body,
        { stream: true },
      );
    }

    return res;
  } catch (err: unknown) {
    const duration = Date.now() - start;
    if (opts?.actionName && opts?.providerAndModel) {
      saveDebugLog(
        opts.actionName,
        opts.providerAndModel,
        duration,
        body,
        null,
        err instanceof Error ? err.message : "Unknown error",
      );
    }
    throw err;
  }
}

export async function apiRequestMultipart<T>(
  url: string,
  apiKey: string,
  filePath: string,
  opts?: RequestOptions,
): Promise<T> {
  const start = Date.now();
  const formData = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const mimeType = fileName.endsWith(".mp3") ? "audio/mpeg" : "audio/wav";

  formData.append("file", new Blob([fileBuffer], { type: mimeType }), fileName);

  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      },
      opts?.timeoutMs,
    );

    await handleResponse(res);
    const data = await res.json();
    const duration = Date.now() - start;

    if (opts?.actionName && opts?.providerAndModel) {
      saveDebugLog(
        opts.actionName,
        opts.providerAndModel,
        duration,
        { file: fileName },
        data,
      );
    }

    return data as T;
  } catch (err: unknown) {
    const duration = Date.now() - start;
    if (opts?.actionName && opts?.providerAndModel) {
      saveDebugLog(
        opts.actionName,
        opts.providerAndModel,
        duration,
        { file: fileName },
        null,
        err instanceof Error ? err.message : "Unknown error",
      );
    }
    throw err;
  }
}
