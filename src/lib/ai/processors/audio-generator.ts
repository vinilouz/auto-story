import { execute } from "@/lib/ai/providers";
import { saveAudio } from "@/lib/services/media-saver";
import { createLogger } from "@/lib/logger";
import { splitIntoBatches } from "@/lib/utils/text";
import type { AudioBatch } from "@/lib/flows/types";

const log = createLogger("audio");

export async function generateAudio(opts: {
  text: string;
  voice?: string;
  systemPrompt?: string;
  targetBatchIndices?: number[];
  projectId?: string;
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

  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    batches[idx].status = "generating";
    try {
      const { audioBuffer } = await execute("generateAudio", {
        text: segments[idx],
        voice,
      });

      if (projectId) {
        batches[idx].url = await saveAudio(audioBuffer, projectId, idx);
      } else {
        (batches[idx] as AudioBatch & { audioBase64?: string }).audioBase64 =
          Buffer.from(audioBuffer).toString("base64");
      }

      batches[idx].status = "completed";
      log.success(`Batch #${idx + 1} completed`);
    } catch (e: any) {
      batches[idx].status = "error";
      batches[idx].error = e.message;
      log.error(`Batch #${idx + 1} failed`, e.message);
    }

    if (i < indices.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return { batches };
}
