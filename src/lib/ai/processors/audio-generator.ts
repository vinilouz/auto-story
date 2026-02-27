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
  projectId: string;
  projectName: string;
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

import { splitTextIntoBatches } from '../utils/text-splitter';

async function audioRequest(
  model: string,
  prompt: string,
  voice: string,
  projectId: string,
  projectName: string
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

  const cleanTitle = (text: string) => text.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').substring(0, 40);
  const slug = cleanTitle(projectName) || 'untitled';
  const shortId = projectId.split('-')[0] || projectId.substring(0, 8);
  const dirName = `${slug}-${shortId}`;

  const publicDir = path.join(process.cwd(), 'public', 'projects', dirName, 'audios');

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const filepath = path.join(publicDir, filename);
  fs.writeFileSync(filepath, Buffer.from(audioBuffer));

  return `/projects/${dirName}/audios/${filename}`;
}

export const generateAudio = async (request: AudioGenerationRequest): Promise<AudioGenerationResponse> => {
  const { text, voice = "nPczCjzI2devNBz1zQrb", model = "eleven-multilingual-v2:free", systemPrompt, targetBatchIndices, projectId, projectName } = request;

  const segments = splitTextIntoBatches(text, 10000, systemPrompt);

  const batches: AudioBatch[] = segments.map((seg, i) => ({
    index: i,
    text: seg,
    status: 'pending'
  }));

  const CONCURRENCY = 4;
  const MAX_RETRIES = 2;

  const indicesToProcess = targetBatchIndices
    ? targetBatchIndices.filter(i => i >= 0 && i < segments.length)
    : segments.map((_, i) => i);

  for (let i = 0; i < indicesToProcess.length; i += CONCURRENCY) {
    const chunkIndices = indicesToProcess.slice(i, i + CONCURRENCY);

    await Promise.all(chunkIndices.map(async (index, batchIdx) => {
      await new Promise(r => setTimeout(r, batchIdx * 800));

      batches[index].status = 'generating';

      let attempt = 0;
      while (attempt < MAX_RETRIES) {
        try {
          const url = await audioRequest(model, segments[index], voice, projectId, projectName);
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
            return;
          }
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }));
  }

  return { batches };
};
