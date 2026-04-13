import fs from "fs";
import path from "path";
import { createLogger } from "@/lib/logger";
import { ACTIONS, type ActionType } from "./config";

const log = createLogger("AI");

// Debug logs are now handled by http-client.ts

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

export interface MusicRequest {
  prompt?: string;
  style?: string;
  instrumental: boolean;
}
export interface MusicResponse {
  musicUrl: string;
}

export interface TranscriptionRequest {
  file: string;
}
export interface TranscriptionResponse {
  words: { text: string; startMs: number; endMs: number }[];
}

export interface ActionMap {
  generateText: { req: TextRequest; res: TextResponse };
  generateImage: { req: ImageRequest; res: ImageResponse };
  generateAudio: { req: AudioRequest; res: AudioResponse };
  generateVideo: { req: VideoRequest; res: VideoResponse };
  generateMusic: { req: MusicRequest; res: MusicResponse };
  generateTranscription: {
    req: TranscriptionRequest;
    res: TranscriptionResponse;
  };
}

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
  generateMusic?: Handler<MusicRequest, MusicResponse>;
  generateTranscription?: Handler<TranscriptionRequest, TranscriptionResponse>;
}

const providers = new Map<string, Provider>();

export function registerProvider(p: Provider): void {
  providers.set(p.name, p);
}

export function getProvider(name: string): Provider | undefined {
  return providers.get(name);
}

export function getCredentials(
  provider: string,
): { baseUrl: string; apiKey: string } | null {
  const key = provider.toUpperCase();
  const baseUrl = process.env[`${key}_BASE_URL`];
  const apiKey = process.env[`${key}_API_KEY`];
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

export async function execute<A extends ActionType>(
  action: A,
  request: ActionMap[A]["req"],
): Promise<ActionMap[A]["res"]> {
  const config = ACTIONS[action]?.[0];
  if (!config) throw new Error(`No config for action: ${action}`);

  const provider = getProvider(config.provider);
  const handler = provider?.[action] as Handler<unknown, unknown> | undefined;
  const creds = getCredentials(config.provider);

  if (!provider || !handler || !creds) {
    throw new Error(`No available provider for: ${action}`);
  }

  const start = Date.now();
  try {
    log.info(`${action} → ${config.provider}/${config.model || "default"}`);
    const result = await handler(config.model || "default", request, creds);
    const ms = Date.now() - start;
    log.success(
      `${action} ← ${config.provider}/${config.model || "default"} (${ms}ms)`,
    );
    return result as ActionMap[A]["res"];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    log.warn(
      `${action} ✗ ${config.provider}/${config.model || "default"}: ${msg}`,
    );
    throw e;
  }
}
