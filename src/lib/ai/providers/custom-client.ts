import fs from 'fs';
import path from 'path';

const endpoint = process.env.VOID_BASE_URL
const apiKey = process.env.VOID_API_KEY

if (!apiKey) {
  throw new Error('VOID_API_KEY environment variable is required')
}

function truncateBase64(obj: any): any {
  if (typeof obj === 'string') {
    if (obj.startsWith('data:image/') && obj.length > 100) {
      return obj.substring(0, obj.indexOf('base64,') + 7) + '... [Base64]';
    }
    if (obj.length > 500 && !obj.includes(' ')) {
      return '[Base64]';
    }
  }
  if (Array.isArray(obj)) {
    return obj.map(truncateBase64);
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = truncateBase64(obj[key]);
    }
    return newObj;
  }
  return obj;
}

export async function generateText(prompt: string, model: string = 'gpt-5.2'): Promise<string> {
  const payload = {
    model,
    messages: [{ role: 'user', content: prompt }],
  };

  const reqId = Date.now().toString();

  if (process.env.DEBUG_LOG === 'true') {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(path.join(logDir, `text_payload_${reqId}.json`), JSON.stringify(truncateBase64(payload), null, 2));
  }

  console.log(`[generateText] BASE_URL: ${endpoint}/v1`);
  console.log(`[generateText] API Payload:`, JSON.stringify(truncateBase64(payload), null, 2));

  const response = await fetch(`${endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[generateText] API Error Response:`, errorText);

    if (process.env.DEBUG_LOG === 'true') {
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      fs.writeFileSync(path.join(logDir, `text_error_${reqId}.log`), errorText);
    }

    throw new Error(`Text API Error: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (process.env.DEBUG_LOG === 'true') {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(path.join(logDir, `text_response_${reqId}.json`), JSON.stringify(truncateBase64(data), null, 2));
  }

  if (!content) {
    throw new Error('Invalid response from text generation service');
  }

  console.log(`[generateText] API Response: Content length ${content.length}`);
  return content;
}

interface ImageConfig {
  aspect_ratio?: string
  image_size?: string
}

const PROVIDER_RPM = {
  VOID: 30,
  AIR: 3
};

const providerRequests: Record<string, number[]> = {
  VOID: [],
  AIR: []
};

function checkRPM(provider: 'VOID' | 'AIR'): boolean {
  const now = Date.now();
  const minuteAgo = now - 60000;
  providerRequests[provider] = providerRequests[provider].filter(t => t > minuteAgo);
  return providerRequests[provider].length < PROVIDER_RPM[provider];
}

function recordRequest(provider: 'VOID' | 'AIR') {
  providerRequests[provider].push(Date.now());
}

async function fetchVoidImage(payload: any): Promise<string> {
  const response = await fetch(`${process.env.VOID_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VOID_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Void API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const img = data.choices?.[0]?.message?.images?.[0];
  const url = img?.image_url?.url || img?.url || '';

  if (!url) throw new Error('No image URL in Void response');
  return url;
}

async function fetchAirImage(prompt: string, referenceImages?: string | string[]): Promise<string> {
  const images = Array.isArray(referenceImages) ? referenceImages : (referenceImages ? [referenceImages] : []);

  const payload: any = {
    model: "nano-banana-2",
    prompt: prompt,
    n: 1,
    size: "1024x1024",
    response_format: "url",
    sse: true,
    aspectRatio: "16:9",
    resolution: "4K"
  };

  if (images.length > 0) {
    payload.image_urls = images;
  }

  const reqId = Date.now().toString()

  console.log(`[fetchAirImage] BASE_URL: ${process.env.AIR_BASE_URL}/v1`)
  console.log(`[fetchAirImage] API Payload:`, JSON.stringify(truncateBase64(payload), null, 2))

  if (process.env.DEBUG_LOG === 'true') {
    const logDir = path.join(process.cwd(), 'logs')
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
    fs.writeFileSync(path.join(logDir, `air_payload_${reqId}.json`), JSON.stringify(truncateBase64(payload), null, 2))
  }

  const response = await fetch(`${process.env.AIR_BASE_URL}/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.AIR_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Air API Error: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body from Air');

  const decoder = new TextDecoder();
  let accumulatedData = '';
  let imageUrl = '';
  let debugStreamData = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    if (process.env.DEBUG_LOG === 'true') {
      debugStreamData += chunk;
    }
    accumulatedData += chunk;
    const lines = accumulatedData.split('\n\n');
    accumulatedData = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6);
        if (dataStr === '[DONE]' || dataStr === ': keepalive') continue;
        try {
          const data = JSON.parse(dataStr);
          const url = data.data?.[0]?.url || data.url;
          if (url) imageUrl = url;
        } catch (e) {
          console.warn(`[fetchAirImage] Failed to parse SSE data:`, dataStr.substring(0, 200));
        }
      }
    }
  }

  if (process.env.DEBUG_LOG === 'true') {
    const logDir = path.join(process.cwd(), 'logs')
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
    fs.writeFileSync(path.join(logDir, `air_stream_${reqId}.log`), debugStreamData)
  }

  console.log(`[fetchAirImage] Result: ${imageUrl ? imageUrl.substring(0, 80) + '...' : 'NO URL FOUND'}`)

  if (!imageUrl) throw new Error('No image URL in Air SSE stream');
  return imageUrl;
}

export async function generateImage(
  prompt: string,
  imageConfig?: ImageConfig,
  referenceImages?: string | string[]
): Promise<string> {
  const startTime = Date.now();
  const TIMEOUT_MS = 130000;
  const excludedProviders = new Set<'VOID' | 'AIR'>();

  while (Date.now() - startTime < TIMEOUT_MS) {
    let selectedProvider: 'VOID' | 'AIR' | null = null;

    if (!excludedProviders.has('VOID') && checkRPM('VOID')) {
      selectedProvider = 'VOID';
    } else if (!excludedProviders.has('AIR') && checkRPM('AIR')) {
      selectedProvider = 'AIR';
    }

    if (selectedProvider) {
      recordRequest(selectedProvider);
      let attempt = 1;
      const MAX_RETRIES = 3;

      while (attempt <= MAX_RETRIES) {
        try {
          console.log(`[generateImage] Using provider: ${selectedProvider} (Attempt ${attempt})`);
          if (selectedProvider === 'VOID') {
            const images = Array.isArray(referenceImages) ? referenceImages : (referenceImages ? [referenceImages] : []);
            const content: any[] = [{ type: 'text', text: prompt }];
            images.forEach(url => content.push({ type: 'image_url', image_url: { url } }));

            const payload = {
              model: 'gemini-3.1-flash-image-preview',
              messages: [{ role: 'user', content }],
              responseModalities: ['IMAGE'],
              image_config: {
                aspect_ratio: imageConfig?.aspect_ratio || '16:9',
                image_size: imageConfig?.image_size || '4K'
              }
            };
            return await fetchVoidImage(payload);
          } else {
            return await fetchAirImage(prompt, referenceImages);
          }
        } catch (error) {
          console.error(`[generateImage] ${selectedProvider} attempt ${attempt} failed:`, error);
          if (attempt === MAX_RETRIES) {
            excludedProviders.add(selectedProvider);
            break;
          }
          attempt++;
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      continue;
    }

    if (excludedProviders.has('VOID') && excludedProviders.has('AIR')) {
      throw new Error('Image generation failed: All providers exhausted');
    }

    console.log('[generateImage] No provider available (RPM limit), waiting 2s...');
    await new Promise(r => setTimeout(r, 2000));
  }

  throw new Error('Image generation failed: Timeout reaching 130s');
}

export async function audioRequest(
  model: string,
  prompt: string,
  voice: string,
  saveToFile = true
) {
  const BASE_URL = process.env.NAGA_BASE_URL;
  const API_KEY = process.env.NAGA_API_KEY;

  const payload = {
    model,
    input: prompt,
    voice,
  };

  const reqId = Date.now().toString();

  if (process.env.DEBUG_LOG === 'true') {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(path.join(logDir, `audio_payload_${reqId}.json`), JSON.stringify(truncateBase64(payload), null, 2));
  }

  console.log(`[audioRequest] BASE_URL: ${BASE_URL}/v1`);
  console.log(`[audioRequest] API Payload:`, JSON.stringify(truncateBase64(payload), null, 2));

  try {
    const response = await fetch(
      `${BASE_URL}/v1/audio/speech`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`[audioRequest] API Error Response: ${response.status}: ${text}`);
      if (process.env.DEBUG_LOG === 'true') {
        const logDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        fs.writeFileSync(path.join(logDir, `audio_error_${reqId}.log`), text);
      }
      return;
    }
    const audioBuffer = await response.arrayBuffer();

    if (saveToFile) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `audio_${timestamp}.mp3`;
      const filepath = path.join(process.cwd(), 'audio', filename);

      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filepath, Buffer.from(audioBuffer));

      console.log(`[audioRequest] API Response: Saved to ${filepath}`);

      return filepath;
    }

    console.log(`[audioRequest] API Response: AudioBuffer of size ${audioBuffer.byteLength}`);

    return audioBuffer;
  } catch (error) {
    console.error("Error:", error);
  }
}

import { VideoModelConfig } from "@/config/video-models"

const VIDEO_LIMITS: Record<string, number> = {
  "grok-imagine-video": 10,
  "veo-3.1-fast": 2,
  "default": 10,
}

const videoQueues: Record<string, { count: number; pending: ((value: void | PromiseLike<void>) => void)[] }> = {}

function getVideoQueue(modelId: string) {
  if (!videoQueues[modelId]) videoQueues[modelId] = { count: 0, pending: [] }
  return videoQueues[modelId]
}

export async function generateVideoClip(
  prompt: string,
  referenceImageUrl: string,
  model: VideoModelConfig
): Promise<string> {
  const BASE_URL = process.env.AIR_BASE_URL
  const API_KEY = process.env.AIR_API_KEY

  if (!BASE_URL || !API_KEY) {
    throw new Error('AIR_BASE_URL and AIR_API_KEY environment variables are required')
  }

  const q = getVideoQueue(model.id)
  const limit = VIDEO_LIMITS[model.id] ?? VIDEO_LIMITS.default

  if (q.count >= limit) {
    await new Promise<void>((resolve) => q.pending.push(resolve))
  }
  q.count++

  try {
    const payload: Record<string, unknown> = {
      model: model.id,
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
      sse: true,
      ...model.extraParams
    }

    if (model.referenceImageField === 'image_urls') {
      payload.image_urls = [referenceImageUrl]
    } else {
      payload[model.referenceImageField] = referenceImageUrl
    }

    const reqId = Date.now().toString()

    if (process.env.DEBUG_LOG === 'true') {
      const logDir = path.join(process.cwd(), 'logs')
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
      fs.writeFileSync(path.join(logDir, `video_payload_${reqId}.json`), JSON.stringify(truncateBase64(payload), null, 2))
    }

    console.log(`[generateVideoClip] BASE_URL: ${BASE_URL}/v1`)
    console.log(`[generateVideoClip] Model: ${model.id}`)
    console.log(`[generateVideoClip] API Payload:`, JSON.stringify(truncateBase64(payload), null, 2))

    const response = await fetch(`${BASE_URL}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[generateVideoClip] API Error Response:`, errorText)
      if (process.env.DEBUG_LOG === 'true') {
        const logDir = path.join(process.cwd(), 'logs')
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
        fs.writeFileSync(path.join(logDir, `video_error_${reqId}.log`), errorText)
      }
      throw new Error(`Video API Error: ${response.statusText} - ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body for video generation')

    const decoder = new TextDecoder()
    let buffer = ''
    let videoUrl = ''
    let debugStreamData = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunkText = decoder.decode(value)
      if (process.env.DEBUG_LOG === 'true') {
        debugStreamData += chunkText
      }
      buffer += chunkText
      const chunks = buffer.split('\n\n')
      buffer = chunks.pop() || ''
      for (const chunk of chunks) {
        if (!chunk.startsWith('data: ')) continue
        const dataStr = chunk.slice(6)
        if (dataStr === '[DONE]' || dataStr === ': keepalive') continue
        try {
          const data = JSON.parse(dataStr)
          const url = data.data?.[0]?.url || data.url
          if (url) videoUrl = url
        } catch { }
      }
    }

    if (process.env.DEBUG_LOG === 'true') {
      const logDir = path.join(process.cwd(), 'logs')
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
      fs.writeFileSync(path.join(logDir, `video_stream_${reqId}.log`), debugStreamData)
    }

    if (!videoUrl) throw new Error('No video URL in response')

    console.log(`[generateVideoClip] API Response: ${videoUrl.substring(0, 80)}...`)
    return videoUrl
  } finally {
    q.count--
    const next = q.pending.shift()
    if (next) next()
  }
}