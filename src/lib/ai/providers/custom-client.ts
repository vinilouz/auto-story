import fs from 'fs';
import path from 'path';

const endpoint = process.env.VOID_BASE_URL
const apiKey = process.env.VOID_API_KEY

if (!apiKey) {
  throw new Error('VOID_API_KEY environment variable is required')
}

function debugLog(data: any) {
  if (process.env.debug_log !== 'true' && process.env.DEBUG_LOG !== 'true') return;
  const id = data.id;
  if (!id) return;

  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  const logFile = path.join(logDir, `request_${id}.log`);
  const content = data.choices?.[0]?.delta?.content;
  if (content) fs.appendFileSync(logFile, content);

  if (data.usage) {
    fs.appendFileSync(logFile, `\n\n[USAGE]\n${JSON.stringify(data.usage, null, 2)}\n`);
  }
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

export async function generateText(prompt: string): Promise<string> {
  const payload = {
    model: 'gemini-3-flash-preview',
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  };

  console.log(`[generateText] BASE_URL: ${endpoint}/v1`);
  console.log(`[generateText] API Payload:`, JSON.stringify(payload, null, 2));

  const response = await fetch(`${endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Text API Error: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6);
        if (dataStr === '[DONE]') continue;

        try {
          const data = JSON.parse(dataStr);
          debugLog(data);
          const content = data.choices?.[0]?.delta?.content;
          if (content) fullContent += content;
        } catch { }
      }
    }
  }

  if (!fullContent) throw new Error('Invalid response from text generation service');
  console.log(`[generateText] API Response: Stream completed, length: ${fullContent.length}`);
  return fullContent;
}
interface ImageConfig {
  aspect_ratio?: string
  image_size?: string
}

export async function generateImage(
  prompt: string,
  imageConfig?: ImageConfig,
  referenceImages?: string | string[]
): Promise<string> {
  const images = Array.isArray(referenceImages) ? referenceImages : (referenceImages ? [referenceImages] : [])
  const content: any[] = [{ type: 'text', text: prompt }]
  images.forEach(url => content.push({ type: 'image_url', image_url: { url } }))

  const payload: any = {
    model: 'gemini-3-pro-image-preview',
    messages: [{ role: 'user', content }],
    responseModalities: ['IMAGE']
  }

  if (imageConfig) {
    payload.image_config = {
      aspect_ratio: imageConfig.aspect_ratio || '16:9',
      image_size: imageConfig.image_size || '2K'
    }
  }

  console.log(`[generateImage] BASE_URL: ${endpoint}/v1`);
  console.log(`[generateImage] API Payload:`, JSON.stringify(truncateBase64(payload), null, 2));

  const response = await fetch(`${endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[generateImage] API Error Response:`, errorText);
    throw new Error(`Image API Error: ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()

  console.log(`[generateImage] API Response:`, JSON.stringify(truncateBase64(data), null, 2));

  const img = data.choices?.[0]?.message?.images?.[0];
  return img?.image_url?.url || img?.url || "";
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

  console.log(`[audioRequest] BASE_URL: ${BASE_URL}/v1`);
  console.log(`[audioRequest] API Payload:`, JSON.stringify(payload, null, 2));

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