import fs from "node:fs";
import path from "node:path";
import { execute } from "@/lib/ai/providers";
import { createLogger } from "@/lib/logger";
import { splitIntoBatches } from "@/lib/utils/text";
import type { AudioBatch } from "@/lib/flows/types";
const log = createLogger("audio");

async function generateAndSave(
  text: string,
  voice: string,
  projectId: string,
): Promise<string> {
  const { audioBuffer } = await execute("generateAudio", { text, voice });
  const pubDir = path.join(process.cwd(), "public", "projects", projectId, "audios");
  if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });

  const name = `audio_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp3`;
  fs.writeFileSync(path.join(pubDir, name), Buffer.from(audioBuffer));
  return `/projects/${projectId}/audios/${name}`;
}

export async function generateAudio(opts: {
  text: string;
  voice?: string;
  systemPrompt?: string;
  targetBatchIndices?: number[];
  projectId: string;
}): Promise<{ batches: AudioBatch[] }> {
  const {
    text,
    voice = "nPczCjzI2devNBz1zQrb",
    systemPrompt,
    targetBatchIndices,
    projectId,
  } = opts;

  const segments = splitIntoBatches(text, 10000, systemPrompt);
  const batches: AudioBatch[] = segments.map((t, i) => ({
    index: i,
    text: t,
    status: "pending" as const,
  }));

  const indices =
    targetBatchIndices?.filter((i) => i >= 0 && i < segments.length) ??
    segments.map((_, i) => i);

  log.info(`Generating ${indices.length}/${segments.length} audio batches`);

  await Promise.all(
    indices.map(async (idx) => {
      batches[idx].status = "generating";
      try {
        batches[idx].url = await generateAndSave(
          segments[idx],
          voice,
          projectId,
        );
        batches[idx].status = "completed";
        log.success(`Batch #${idx + 1} completed`);
      } catch (e: any) {
        batches[idx].status = "error";
        batches[idx].error = e.message;
        log.error(`Batch #${idx + 1} failed`, e.message);
      }
    }),
  );

  return { batches };
}
