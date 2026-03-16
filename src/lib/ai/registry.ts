import fs from "fs";
import path from "path";
import { createLogger } from "@/lib/logger";
import { ACTIONS, type ActionType } from "./config";
import { acquireSlot, nextSlotMs, tryAcquireSlot } from "./rate-limiter";

const log = createLogger("AI");

// ── Debug file logging ────────────────────────────────────

/** Set false to disable all file logging */
const DEBUG_LOGS_ENABLED = true;
/** 'all' = every call, 'error' = only failures */
/** 'all' = every call, 'error' = only failures */
const DEBUG_LOGS_LEVEL: "all" | "error" = "all";

const LOGS_DIR = path.join(process.cwd(), "logs");

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export function saveDebug(
  action: string,
  provider: string,
  model: string,
  request: any,
  response: any,
  durationMs: number,
  error?: string,
) {
  if (!DEBUG_LOGS_ENABLED) return;
  if (DEBUG_LOGS_LEVEL === "error" && !error) return;

  ensureLogsDir();

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const status = error ? "error" : "ok";
  const filename = `${action}-${provider}-${status}-${ts}.json`;

  const data: any = {
    timestamp: new Date().toISOString(),
    action,
    provider: `${provider}/${model}`,
    durationMs,
    status,
  };

  if (action === "generateText") {
    data.request = {
      prompt: request.prompt,
      promptLength: request.prompt?.length,
    };
    if (response?.text)
      data.response = { text: response.text, textLength: response.text.length };
  } else {
    data.request = {
      ...request,
      referenceImages: request.referenceImages?.map(
        (r: string) => r.substring(0, 50) + "...",
      ),
    };
    if (response)
      data.response = {
        hasImageUrl: !!response.imageUrl,
        hasVideoUrl: !!response.videoUrl,
        hasAudioBuffer: !!response.audioBuffer,
      };
  }

  if (error) data.error = error;

  try {
    fs.writeFileSync(
      path.join(LOGS_DIR, filename),
      JSON.stringify(data, null, 2),
    );
  } catch {}
}

// ── Request/Response types ────────────────────────────────

export interface TextRequest {
  prompt: string;
}
export interface TextResponse {
  text: string;
}

export interface ImageRequest {
  prompt: string;
  referenceImages?: string[];
  config?: { aspect_ratio?: string; image_size?: string };
}
export interface ImageResponse {
  imageUrl: string;
}

export interface AudioRequest {
  text: string;
  voice: string;
}
export interface AudioResponse {
  audioBuffer: ArrayBuffer;
}

export interface VideoRequest {
  prompt: string;
  referenceImage?: string;
  duration?: number;
}
export interface VideoResponse {
  videoUrl: string;
}

export interface ActionMap {
  generateText: { req: TextRequest; res: TextResponse };
  generateImage: { req: ImageRequest; res: ImageResponse };
  generateAudio: { req: AudioRequest; res: AudioResponse };
  generateVideo: { req: VideoRequest; res: VideoResponse };
}

// ── Provider interface ────────────────────────────────────

export type Handler<Req, Res> = (
  model: string,
  req: Req,
  creds: { baseUrl: string; apiKey: string },
) => Promise<Res>;

export interface Provider {
  name: string;
  generateText?: Handler<TextRequest, TextResponse>;
  generateImage?: Handler<ImageRequest, ImageResponse>;
  generateAudio?: Handler<AudioRequest, AudioResponse>;
  generateVideo?: Handler<VideoRequest, VideoResponse>;
}

// ── Provider registry ─────────────────────────────────────

const providers = new Map<string, Provider>();

export function registerProvider(p: Provider): void {
  providers.set(p.name, p);
}

export function getProvider(name: string): Provider | undefined {
  return providers.get(name);
}

// ── Credentials ───────────────────────────────────────────

export function getCredentials(
  provider: string,
): { baseUrl: string; apiKey: string } | null {
  const key = provider.toUpperCase();
  const baseUrl = process.env[`${key}_BASE_URL`];
  const apiKey = process.env[`${key}_API_KEY`];
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

// ── Resolve available providers for an action ─────────────

interface ResolvedProvider {
  name: string;
  model: string;
  handler: Handler<any, any>;
  creds: { baseUrl: string; apiKey: string };
}

function resolveProviders(action: ActionType): ResolvedProvider[] {
  const resolved: ResolvedProvider[] = [];
  for (const { provider: name, model } of ACTIONS[action] || []) {
    const provider = getProvider(name);
    const handler = provider?.[action] as Handler<any, any> | undefined;
    const creds = getCredentials(name);
    if (provider && handler && creds)
      resolved.push({ name, model, handler, creds });
  }
  return resolved;
}

// ── Execute single ────────────────────────────────────────
// Two-pass: first try any provider with a free slot RIGHT NOW,
// then fall back to waiting for the preferred provider.
// This prevents 20 requests blocking on air(5rpm) when void(20rpm) is idle.

export async function execute<A extends ActionType>(
  action: A,
  request: ActionMap[A]["req"],
): Promise<ActionMap[A]["res"]> {
  const chain = resolveProviders(action);
  if (!chain.length) throw new Error(`No available providers for: ${action}`);

  const errors: string[] = [];

  // Pass 1: try any provider that has a slot available RIGHT NOW (non-blocking)
  for (const p of chain) {
    if (!tryAcquireSlot(p.name)) continue;

    const start = Date.now();
    try {
      log.info(`${action} → ${p.name}/${p.model}`);
      const result = await p.handler(p.model, request, p.creds);
      const ms = Date.now() - start;
      log.success(`${action} ← ${p.name}/${p.model} (${ms}ms)`);
      saveDebug(action, p.name, p.model, request, result, ms);
      return result;
    } catch (e: any) {
      const ms = Date.now() - start;
      const msg = e?.message || String(e);
      log.warn(`${action} ✗ ${p.name}/${p.model}: ${msg}`);
      errors.push(`${p.name}/${p.model}: ${msg}`);
      saveDebug(action, p.name, p.model, request, null, ms, msg);
    }
  }

  // Pass 2: all slots full or all failed — pick the provider with the shortest wait
  const remaining = chain.filter(
    (p) => !errors.some((e) => e.startsWith(`${p.name}/${p.model}:`)),
  );
  const candidates = remaining.length > 0 ? remaining : chain;

  // Sort by next available slot time
  const sorted = candidates
    .map((p) => ({ ...p, waitMs: nextSlotMs(p.name) }))
    .sort((a, b) => a.waitMs - b.waitMs);

  for (const p of sorted) {
    const start = Date.now();
    try {
      await acquireSlot(p.name);
      log.info(`${action} → ${p.name}/${p.model}`);
      const result = await p.handler(p.model, request, p.creds);
      const ms = Date.now() - start;
      log.success(`${action} ← ${p.name}/${p.model} (${ms}ms)`);
      saveDebug(action, p.name, p.model, request, result, ms);
      return result;
    } catch (e: any) {
      const ms = Date.now() - start;
      const msg = e?.message || String(e);
      log.warn(`${action} ✗ ${p.name}/${p.model}: ${msg}`);
      errors.push(`${p.name}/${p.model}: ${msg}`);
      saveDebug(action, p.name, p.model, request, null, ms, msg);
    }
  }

  const fullError = `All providers failed for ${action}:\n  ${errors.join("\n  ")}`;
  log.error(fullError);
  throw new Error(fullError);
}
