import fs from "node:fs";
import path from "node:path";
import { execute } from "@/lib/ai/providers";
import { splitTextIntoBatches } from "../utils/text-splitter";

export interface AudioBatch {
  index: number;
  text: string;
  status: "pending" | "generating" | "completed" | "error";
  url?: string;
  error?: string;
}

function audioDir(projectId: string, projectName: string) {
  const slug =
    projectName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9 -]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 10) || "untitled";
  return `${slug}-${projectId.split("-")[0] || projectId.substring(0, 8)}`;
}

async function generateAndSave(
  text: string,
  voice: string,
  projectId: string,
  projectName: string,
): Promise<string> {
  const { audioBuffer } = await execute("generateAudio", { text, voice });
  const dir = audioDir(projectId, projectName);
  const pubDir = path.join(process.cwd(), "public", "projects", dir, "audios");
  if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });
  const name = `audio_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp3`;
  fs.writeFileSync(path.join(pubDir, name), Buffer.from(audioBuffer));
  return `/projects/${dir}/audios/${name}`;
}

export async function generateAudio(opts: {
  text: string;
  voice?: string;
  systemPrompt?: string;
  targetBatchIndices?: number[];
  projectId: string;
  projectName: string;
}): Promise<{ batches: AudioBatch[] }> {
  const {
    text,
    voice = "nPczCjzI2devNBz1zQrb",
    systemPrompt,
    targetBatchIndices,
    projectId,
    projectName,
  } = opts;
  const segments = splitTextIntoBatches(text, 10000, systemPrompt);
  const batches: AudioBatch[] = segments.map((t, i) => ({
    index: i,
    text: t,
    status: "pending" as const,
  }));

  batches.forEach((b) => (b.status = "pending"));
  const indices =
    targetBatchIndices?.filter((i) => i >= 0 && i < segments.length) ??
    segments.map((_, i) => i);

  await Promise.all(
    indices.map(async (idx) => {
      batches[idx].status = "generating";
      try {
        batches[idx].url = await generateAndSave(
          segments[idx],
          voice,
          projectId,
          projectName,
        );
        batches[idx].status = "completed";
      } catch (e: any) {
        batches[idx].status = "error";
        batches[idx].error = e.message;
      }
    }),
  );

  return { batches };
}
