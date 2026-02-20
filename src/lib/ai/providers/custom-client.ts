import OpenAI from 'openai'
import fs from 'fs';
import path from 'path';

const endpoint = process.env.AI_ENDPOINT
const apiKey = process.env.AI_API_KEY

if (!apiKey) {
  throw new Error('AI_API_KEY environment variable is required')
}

const openai = new OpenAI({
  baseURL: endpoint,
  apiKey: apiKey
})

export async function generateText(prompt: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'claude-opus-4-6',
      messages: [{ role: 'user', content: prompt }]
    })



    const content = completion.choices[0]?.message?.content
    if (!content) {
      console.error('No content in response')
      throw new Error('Invalid response from text generation service')
    }

    const result = typeof content === 'string' ? content : JSON.stringify(content)


    return result
  } catch (error) {
    console.error('Text generation error:', error)
    throw error
  }
}
interface ImageConfig {
  aspect_ratio?: string
  image_size?: string
}

export async function generateImage(
  prompt: string,
  imageConfig?: ImageConfig,
  referenceImage?: string
): Promise<string> {
  const userContent: any = referenceImage
    ? [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: referenceImage } }
    ]
    : prompt

  const payload: any = {
    model: 'gemini-3-pro-image-preview',
    messages: [{ role: 'user', content: userContent }],
    responseModalities: ['IMAGE']
  }

  if (imageConfig) {
    payload.image_config = {
      aspect_ratio: imageConfig.aspect_ratio || '16:9',
      image_size: imageConfig.image_size || '2K'
    }
  }

  console.log('[generateImage] API Payload:', JSON.stringify(payload, null, 2))

  const completion = await openai.chat.completions.create(payload)

  const logReplacer = (key: string, value: any) => {
    if (typeof value === 'string' && value.length > 500) {
      if (value.startsWith('data:image/') || value.length > 2000) {
        return `${value.substring(0, 40)}... [TRUNCATED_BASE64, len=${value.length}]`;
      }
    }
    return value;
  };

  console.log('[generateImage] API Response:', JSON.stringify(completion, logReplacer, 2))

  const message = completion.choices[0]?.message as any
  if (!message) {
    throw new Error('Invalid response from image generation service')
  }

  // Handle images array as per user requirements
  if (message.images && Array.isArray(message.images)) {
    const imageContent = message.images.find((item: any) => item.type === 'image_url')
    if (imageContent?.image_url?.url) {
      return imageContent.image_url.url
    }
  }

  // Fallback for content array if images property is missing but content has it
  if (Array.isArray(message.content)) {
    const imageContent = message.content.find((item: any) => item.type === 'image_url')
    if (imageContent?.image_url?.url) {
      return imageContent.image_url.url
    }
  }

  throw new Error(`No image URL found in response. Finish reason: ${completion.choices[0]?.finish_reason}. Message: ${JSON.stringify(message, logReplacer)}`)
}

export async function audioRequest(
  model: string,
  prompt: string,
  voice: string,
  saveToFile = true
) {
  const BASE_URL = process.env.NAGA_BASE_URL;
  const API_KEY = process.env.NAGA_API_KEY;

  try {
    const response = await fetch(
      `${BASE_URL}/v1/audio/speech`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model,
          input: prompt,
          voice,
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`Error ${response.status}: ${text}`);
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

      return filepath;
    }

    return audioBuffer;
  } catch (error) {
    console.error("Error:", error);
  }
}