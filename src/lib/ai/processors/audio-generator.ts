// src/lib/ai/processors/audio-generator.ts
import fs from 'fs';
import path from 'path';

// --- Types ---
export interface AudioGenerationRequest {
  text: string;
  voice?: string;
  model?: string;
  systemPrompt?: string;
  targetBatchIndices?: number[];
}

export interface AudioBatch {
  index: number;
  text: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  url?: string;
  error?: string;
}

export interface AudioGenerationResponse {
  batches: AudioBatch[];
}


// --- Audio Request ---
async function audioRequest(
  model: string,
  prompt: string,
  voice: string
): Promise<string> {
  const BASE_URL = process.env.NAGA_BASE_URL;
  const API_KEY = process.env.NAGA_API_KEY;

  if (!BASE_URL || !API_KEY) {
    throw new Error("Missing NAGA_BASE_URL or NAGA_API_KEY");
  }



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
    const errorText = await response.text();
    console.error(`[Audio] Error ${response.status}: ${errorText}`);
    throw new Error(`Audio failed: ${response.status} - ${errorText}`);
  }

  const audioBuffer = await response.arrayBuffer();


  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `audio_${timestamp}_${Math.random().toString(36).substring(7)}.mp3`;
  const publicDir = path.join(process.cwd(), 'public', 'audio');

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const filepath = path.join(publicDir, filename);
  fs.writeFileSync(filepath, Buffer.from(audioBuffer));


  return `/audio/${filename}`;
}

import { splitTextIntoBatches } from '../utils/text-splitter';

export const generateAudio = async (request: AudioGenerationRequest): Promise<AudioGenerationResponse> => {
  const { text, voice = "nPczCjzI2devNBz1zQrb", model = "eleven-multilingual-v2:free", systemPrompt, targetBatchIndices } = request;

  const segments = splitTextIntoBatches(text, 10000, systemPrompt);

  // Initialize batches with basic info
  const batches: AudioBatch[] = segments.map((seg, i) => ({
    index: i,
    text: seg,
    status: 'pending'
  }));

  const CONCURRENCY = 4;
  const MAX_RETRIES = 2;

  // Filter indices to process
  const indicesToProcess = targetBatchIndices
    ? targetBatchIndices.filter(i => i >= 0 && i < segments.length)
    : segments.map((_, i) => i);



  for (let i = 0; i < indicesToProcess.length; i += CONCURRENCY) {
    const chunkIndices = indicesToProcess.slice(i, i + CONCURRENCY);

    await Promise.all(chunkIndices.map(async (index, batchIdx) => {
      // Stagger start
      await new Promise(r => setTimeout(r, batchIdx * 800));

      batches[index].status = 'generating';

      let attempt = 0;
      while (attempt < MAX_RETRIES) {
        try {

          const url = await audioRequest(model, segments[index], voice);
          batches[index].status = 'completed';
          batches[index].url = url;
          return;
        } catch (error: any) {
          attempt++;
          const isRateLimit = error.message?.includes('429');
          const delay = isRateLimit
            ? 2000 * Math.pow(2, attempt) + Math.random() * 1000
            : 1000 * Math.pow(2, attempt) + Math.random() * 1000;

          console.error(`[Audio] Batch ${index + 1} failed (Attempt ${attempt}/${MAX_RETRIES}). Error: ${error.message}.`);

          if (attempt >= MAX_RETRIES) {
            batches[index].status = 'error';
            batches[index].error = error.message;
            // Do not throw, essentially swallowing the error for this batch but recording it
            return;
          }
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }));
  }

  return { batches };
};
