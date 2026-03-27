import {
  apiRequest,
  apiRequestMultipart,
  apiRequestRaw,
  apiRequestSSE,
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

const TIMEOUT_VIDEO = 120_000;
const TIMEOUT_MUSIC = 240_000;

async function parseMusicSSE(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  const timer = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Music timeout after ${TIMEOUT_MUSIC / 1000}s`)),
      TIMEOUT_MUSIC,
    ),
  );

  const read = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]" || raw.startsWith(": ") || !raw) continue;
          try {
            const data = JSON.parse(raw);
            if (data.url) return data.url;
          } catch {}
        }
      }
    }
    throw new Error("Music stream ended without URL");
  };

  try {
    return await Promise.race([read(), timer]);
  } finally {
    reader.cancel().catch(() => {});
  }
}

registerProvider({
  name: "louzlabs",

  async generateText(model, req: TextRequest, creds): Promise<TextResponse> {
    const data = await apiRequest<{ text: string }>(
      `${creds.baseUrl}/v1/chat/completions`,
      creds.apiKey,
      { prompt: req.prompt, model },
      { actionName: "generateText", providerAndModel: `louzlabs/${model}` },
    );
    if (!data.text) throw new Error("Empty text response");
    return { text: data.text };
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

    const data = await apiRequest<{ b64_json?: string; url?: string }>(
      `${creds.baseUrl}/v1/images/generations`,
      creds.apiKey,
      payload,
      { actionName: "generateImage", providerAndModel: `louzlabs/${model}` },
    );

    const imageUrl = data.b64_json
      ? `data:image/png;base64,${data.b64_json}`
      : data.url;

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
      prompt: req.prompt,
    };

    if (req.referenceImage) {
      payload.images = [req.referenceImage];
    }

    const data = await apiRequest<{ url: string }>(
      `${creds.baseUrl}/v1/video/generations`,
      creds.apiKey,
      payload,
      {
        timeoutMs: TIMEOUT_VIDEO,
        actionName: "generateVideo",
        providerAndModel: `louzlabs/${model}`,
      },
    );

    if (!data.url) throw new Error("No video URL in response");
    return { videoUrl: data.url };
  },

  async generateMusic(model, req: MusicRequest, creds): Promise<MusicResponse> {
    const res = await apiRequestSSE(
      `${creds.baseUrl}/v1/music/generations`,
      creds.apiKey,
      {
        prompt:
          req.prompt ||
          "Soft spiritual instrumental, gentle piano, warm strings",
        instrumental: req.instrumental,
      },
      {
        timeoutMs: TIMEOUT_MUSIC,
        actionName: "generateMusic",
        providerAndModel: `louzlabs/${model}`,
      },
    );

    const musicUrl = await parseMusicSSE(res);
    return { musicUrl };
  },

  async generateTranscription(
    model,
    req: TranscriptionRequest,
    creds,
  ): Promise<TranscriptionResponse> {
    const data = await apiRequestMultipart<TranscriptionResponse>(
      `${creds.baseUrl}/v1/audio/transcriptions`,
      creds.apiKey,
      req.file,
      {
        actionName: "generateTranscription",
        providerAndModel: `louzlabs/${model}`,
      },
    );

    if (!data || !Array.isArray(data.words)) {
      throw new Error("Invalid transcription response format");
    }
    return data;
  },
});
