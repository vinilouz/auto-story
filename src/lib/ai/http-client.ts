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
        if ("b64_json" in data)
          logRes = {
            b64_json: `[${(data as any).b64_json?.length ?? 0} chars]`,
            url: data.url,
          };
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

export async function parseSSEData<T>(
  response: Response,
  timeoutMs?: number,
): Promise<T> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let lastData: T | null = null;

  function processLines(text: string): void {
    for (const line of text.split("\n")) {
      try {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]" || raw.startsWith(": ") || !raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed.error)
          throw new Error(
            typeof parsed.error === "string"
              ? parsed.error
              : JSON.stringify(parsed.error),
          );
        lastData = parsed as T;
      } catch (err: any) {
        if (err.message && !err.message.includes("JSON")) throw err;
      }
    }
  }

  const read = async (): Promise<T> => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) processLines(chunk);
    }

    if (buffer.trim()) processLines(buffer);
    if (!lastData) throw new Error("Stream ended without data");
    return lastData;
  };

  try {
    if (timeoutMs) {
      const timer = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`SSE timeout after ${timeoutMs / 1000}s`)),
          timeoutMs,
        ),
      );
      return await Promise.race([read(), timer]);
    }
    return await read();
  } finally {
    reader.cancel().catch(() => {});
  }
}

export async function apiRequestMultipart(
  url: string,
  apiKey: string,
  filePath: string,
  opts?: RequestOptions,
): Promise<Response> {
  const start = Date.now();
  const formData = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const mimeType = fileName.endsWith(".mp3") ? "audio/mpeg" : "audio/wav";

  formData.append("file", new File([fileBuffer], fileName, { type: mimeType }));

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

    if (opts?.actionName && opts?.providerAndModel) {
      saveDebugLog(
        opts.actionName,
        opts.providerAndModel,
        Date.now() - start,
        { file: fileName },
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
        { file: fileName },
        null,
        err instanceof Error ? err.message : "Unknown error",
      );
    }
    throw err;
  }
}
