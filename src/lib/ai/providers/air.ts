import {
  type ImageRequest,
  type ImageResponse,
  registerProvider,
  type VideoRequest,
  type VideoResponse,
} from "@/lib/ai/registry";
import { ensureHostedUrl } from "@/lib/ai/utils/anondrop";
import { createLogger } from "@/lib/logger";

const log = createLogger("air");

// ── SSE parser ─────────────────────────────────────────────
// Problema anterior: quando o provider retorna JSON plano (ex: erro 200 com body JSON)
// ou resposta vazia, events ficava [] e o erro era opaco ("Last events: []").
// Agora: loga o raw buffer para diagnóstico + tenta JSON fallback.

async function parseSSE(
  response: Response,
  timeoutMs = 120_000,
): Promise<any[]> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  const events: any[] = [];

  const timer = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`SSE timeout after ${timeoutMs / 1000}s`)),
      timeoutMs,
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
          if (raw === "[DONE]" || raw === ": keepalive" || !raw) continue;
          try {
            events.push(JSON.parse(raw));
          } catch { }
        }
      }
    }

    // Process any remaining buffer after stream ends
    if (buffer.trim()) {
      for (const line of buffer.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw && raw !== "[DONE]") {
          try {
            events.push(JSON.parse(raw));
          } catch { }
        }
      }
    }
  };

  try {
    await Promise.race([read(), timer]);
  } finally {
    reader.cancel().catch(() => { });
  }

  // Se nenhum evento SSE foi parseado, tenta interpretar o buffer como JSON puro
  // (alguns providers retornam JSON quando a geração falha, mesmo com sse:true)
  if (events.length === 0) {
    const rawTrim = buffer.trim();
    if (rawTrim) {
      log.warn(
        `SSE vazio, tentando JSON fallback. Raw: ${rawTrim.substring(0, 200)}`,
      );
      try {
        const parsed = JSON.parse(rawTrim);
        // Se tem campo de erro explícito, joga como erro para classificação correta
        if (parsed?.error) {
          throw new Error(
            `Provider error: ${JSON.stringify(parsed.error).substring(0, 200)}`,
          );
        }
        events.push(parsed);
      } catch (e: any) {
        // Se não é JSON nem SSE, joga o raw como contexto do erro
        if (!e.message.startsWith("Provider error:")) {
          throw new Error(
            `SSE vazio e resposta não-JSON. Raw: ${rawTrim.substring(0, 300)}`,
          );
        }
        throw e;
      }
    }
  }

  return events;
}

function extractUrl(events: any[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e?.data?.[0]?.url) return e.data[0].url;
    if (e?.url) return e.url;
    if (e?.output?.url) return e.output.url;
    if (e?.video?.url) return e.video.url;
    if (e?.image?.url) return e.image.url;
    if (e?.choices?.[0]?.message?.content) {
      const c = e.choices[0].message.content;
      if (typeof c === "string" && c.startsWith("http")) return c;
    }
    // Formato alternativo: array de choices com image
    if (Array.isArray(e?.choices)) {
      for (const ch of e.choices) {
        const img = ch?.message?.images?.[0];
        if (img?.image_url?.url) return img.image_url.url;
        if (img?.url) return img.url;
      }
    }
  }
  return null;
}

async function resolveReferenceImages(images?: string[]): Promise<string[]> {
  if (!images?.length) return [];
  const results: string[] = [];
  for (const img of images) {
    results.push(await ensureHostedUrl(img));
  }
  return results;
}

async function downloadAsBase64(
  url: string,
  fallbackMime: string,
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type") || fallbackMime;
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// ── Provider ───────────────────────────────────────────────

registerProvider({
  name: "air",

  async generateImage(model, req: ImageRequest, creds): Promise<ImageResponse> {
    const refs = await resolveReferenceImages(req.referenceImages);

    const payload: any = {
      model,
      prompt: req.prompt,
      n: 1,
      size: req.config?.aspect_ratio || "1024x1024",
      response_format: "url",
      sse: true,
    };
    if (refs.length) payload.image_urls = refs;

    const res = await fetch(`${creds.baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.apiKey}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${body.substring(0, 300)}`);
    }

    const events = await parseSSE(res);

    if (events.length === 0) {
      throw new Error(
        `No SSE events received from air/${model} (empty response after stream)`,
      );
    }

    const rawUrl = extractUrl(events);
    if (!rawUrl) {
      const sample = JSON.stringify(events.slice(-3)).substring(0, 400);
      throw new Error(`No image URL in SSE response. Last events: ${sample}`);
    }

    const imageUrl = rawUrl.startsWith("http")
      ? await downloadAsBase64(rawUrl, "image/png")
      : rawUrl;

    return { imageUrl };
  },

  async generateVideo(model, req: VideoRequest, creds): Promise<VideoResponse> {
    const referenceUrl = req.referenceImage
      ? await ensureHostedUrl(req.referenceImage)
      : undefined;

    const payload: any = {
      model,
      prompt: req.prompt,
      n: 1,
      size: "1024x1024",
      response_format: "url",
      sse: true,
    };

    if (model === "grok-imagine-video") {
      payload.mode = "normal";
      payload.resolution = "720p";
      if (referenceUrl) payload.image_urls = [referenceUrl];
    } else if (model === "veo-3.1-fast") {
      if (referenceUrl) payload.reference_image_url = referenceUrl;
    } else {
      if (referenceUrl) {
        payload.reference_image_url = referenceUrl;
        payload.image_urls = [referenceUrl];
      }
    }

    const res = await fetch(`${creds.baseUrl}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.apiKey}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${body.substring(0, 300)}`);
    }

    const events = await parseSSE(res, 180_000); // vídeos podem demorar mais

    if (events.length === 0) {
      throw new Error(
        `No SSE events received from air/${model} (empty response after stream)`,
      );
    }

    const rawUrl = extractUrl(events);
    if (!rawUrl) {
      const sample = JSON.stringify(events.slice(-3)).substring(0, 400);
      throw new Error(`No video URL in SSE response. Last events: ${sample}`);
    }

    const videoUrl = rawUrl.startsWith("http")
      ? await downloadAsBase64(rawUrl, "video/mp4")
      : rawUrl;

    return { videoUrl };
  },
});
