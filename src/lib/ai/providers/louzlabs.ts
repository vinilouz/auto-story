import {
  apiRequestMultipart,
  apiRequestRaw,
  apiRequestSSE,
  parseSSEData,
} from "@/lib/ai/http-client";
import {
  type AudioRequest,
  type AudioResponse,
  type ImageRequest,
  type ImageResponse,
  type MusicRequest,
  type MusicResponse,
  registerProvider,
  type TextRequest,
  type TextResponse,
  type TranscriptionRequest,
  type TranscriptionResponse,
  type VideoRequest,
  type VideoResponse,
} from "@/lib/ai/registry";

const TIMEOUT_MUSIC = 240_000;
const TIMEOUT_VIDEO = 300_000;

function iteratorFromReader(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder();
  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          const { done, value } = await reader.read();
          if (done) return { done: true, value: undefined };
          return {
            done: false,
            value: decoder.decode(value, { stream: true }),
          };
        },
      };
    },
  };
}

async function parseSSEUrl(
  response: Response,
  timeoutMs: number,
): Promise<string> {
  const data = await parseSSEData<{
    data: Array<{ url?: string | null }>;
  }>(response, timeoutMs);
  const vid = data.data?.[0];
  if (!vid?.url) throw new Error("Stream ended without URL");
  return vid.url;
}

registerProvider({
  name: "louzlabs",

  async generateText(model, req: TextRequest, creds): Promise<TextResponse> {
    const res = await apiRequestSSE(
      `${creds.baseUrl}/v1/chat/completions`,
      creds.apiKey,
      { model, stream: true, messages: [{ role: "user", content: req.prompt }] },
      { actionName: "generateText", providerAndModel: `louzlabs/${model}` },
    );

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    let buffer = "";
    let text = "";

    for await (const chunk of iteratorFromReader(reader)) {
      buffer += chunk;
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        for (const line of part.split("\n")) {
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
          const delta =
            parsed.choices?.[0]?.delta?.content ??
            parsed.choices?.[0]?.message?.content;
          if (delta) text += delta;
        }
      }
    }

    reader.cancel().catch(() => {});
    if (!text) throw new Error("Empty text response");
    return { text };
  },

  async generateImage(model, req: ImageRequest, creds): Promise<ImageResponse> {
    const payload: Record<string, unknown> = {
      prompt: req.prompt,
      aspect_ratio: req.config?.aspect_ratio || "16:9",
      size: req.config?.image_size || "2K",
    };

    if (req.referenceImages?.length) {
      payload.images = req.referenceImages;
    }

    const res = await apiRequestSSE(
      `${creds.baseUrl}/v1/images/generations`,
      creds.apiKey,
      payload,
      { actionName: "generateImage", providerAndModel: `louzlabs/${model}` },
    );

    const data = await parseSSEData<{
      data: Array<{ url?: string | null; b64_json?: string | null }>;
    }>(res);
    const img = data.data?.[0];
    if (!img) throw new Error("No image in response");
    const imageUrl = img.b64_json
      ? `data:image/png;base64,${img.b64_json}`
      : img.url;
    if (!imageUrl) throw new Error("No image URL in response");
    return { imageUrl };
  },

  async generateAudio(model, req: AudioRequest, creds): Promise<AudioResponse> {
    const audioBuffer = await apiRequestRaw(
      `${creds.baseUrl}/v1/audio/speech`,
      creds.apiKey,
      { prompt: req.text, voice: req.voice },
      { actionName: "generateAudio", providerAndModel: `louzlabs/${model}` },
    );

    if (!audioBuffer.byteLength) throw new Error("Empty audio response");
    return { audioBuffer };
  },

  async generateVideo(model, req: VideoRequest, creds): Promise<VideoResponse> {
    const payload: Record<string, unknown> = {
      model,
      prompt: req.prompt,
      aspect_ratio: "16:9",
    };

    if (req.referenceImage) {
      payload.images = [req.referenceImage];
    }

    const res = await apiRequestSSE(
      `${creds.baseUrl}/v1/video/generations`,
      creds.apiKey,
      payload,
      {
        timeoutMs: TIMEOUT_VIDEO,
        actionName: "generateVideo",
        providerAndModel: `louzlabs/${model}`,
      },
    );

    const videoUrl = await parseSSEUrl(res, TIMEOUT_VIDEO);
    return { videoUrl };
  },

  async generateMusic(model, req: MusicRequest, creds): Promise<MusicResponse> {
    const res = await apiRequestSSE(
      `${creds.baseUrl}/v1/music/generations`,
      creds.apiKey,
      {
        prompt:
          req.prompt ||
          "Soft spiritual instrumental, gentle piano, warm strings",
        style: req.style,
        instrumental: req.instrumental,
      },
      {
        timeoutMs: TIMEOUT_MUSIC,
        actionName: "generateMusic",
        providerAndModel: `louzlabs/${model}`,
      },
    );

    const musicUrl = await parseSSEUrl(res, TIMEOUT_MUSIC);
    return { musicUrl };
  },

  async generateTranscription(
    model,
    req: TranscriptionRequest,
    creds,
  ): Promise<TranscriptionResponse> {
    const res = await apiRequestMultipart(
      `${creds.baseUrl}/v1/audio/transcriptions`,
      creds.apiKey,
      req.file,
      {
        actionName: "generateTranscription",
        providerAndModel: `louzlabs/${model}`,
      },
    );

    const data = await parseSSEData<TranscriptionResponse>(res);
    if (!data.words) {
      throw new Error("Invalid transcription response format");
    }
    return data;
  },
});
