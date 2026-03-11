import { BATCH_DESCRIPTIONS_PROMPT } from "@/lib/ai/prompts/prompts";
import { execute } from "@/lib/ai/providers";
import type { Segment } from "@/lib/flows/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("visualizer");

const MAX_SEGMENTS_PER_BATCH = 50;

export interface SceneVisualizationRequest {
  segments: Segment[];
  entities?: Array<{ type: string; description: string; segment?: number[] }>;
  language?: string;
  style?: string;
  commentatorName?: string;
  commentatorPersonality?: string;
}

function parseDescriptions(
  raw: string,
  expectedCount: number,
): Array<{ id: string; imagePrompt: string }> {
  let clean = raw.trim();
  const m =
    clean.match(/```json\s*(\[[\s\S]*?\])\s*```/) ||
    clean.match(/(\[[\s\S]*?\])/);
  if (m) clean = m[1];

  if (!clean.endsWith("]")) {
    const lastBrace = clean.lastIndexOf("}");
    if (lastBrace > 0) {
      clean = clean.substring(0, lastBrace + 1) + "]";
      log.warn(
        `Truncated response — recovered (raw length: ${raw.length} chars)`,
      );
    }
  }

  let parsed: any;
  try {
    parsed = JSON.parse(clean.trim());
  } catch (e) {
    log.error(
      `JSON parse failed (raw: ${raw.length} chars, cleaned: ${clean.length} chars)`,
    );
    throw new Error(`Invalid JSON from AI: ${(e as Error).message}`);
  }

  const arr = Array.isArray(parsed) ? parsed : parsed.visualDescriptions;
  if (!Array.isArray(arr)) throw new Error("AI response is not an array");
  if (arr.length !== expectedCount) {
    log.warn(
      `AI returned ${arr.length}/${expectedCount} descriptions (raw: ${raw.length} chars)`,
    );
  }
  return arr;
}

export async function generateSceneDescriptions(
  data: SceneVisualizationRequest,
) {
  if (!data.segments?.length) throw new Error("No segments");

  const entities = data.entities || [];
  const language = data.language || "English";
  const total = data.segments.length;
  const batchCount = Math.ceil(total / MAX_SEGMENTS_PER_BATCH);

  log.info(
    `${total} segments → ${batchCount} batch(es), ${entities.length} entities`,
  );

  const prompts = new Map<number, string>();

  for (let b = 0; b < batchCount; b++) {
    const start = b * MAX_SEGMENTS_PER_BATCH;
    const end = Math.min(start + MAX_SEGMENTS_PER_BATCH, total);
    const batchSegs = data.segments.slice(start, end);
    const batchInput = batchSegs.map((s, i) => ({
      id: String(start + i + 1),
      scriptText: s.text.trim(),
    }));

    log.info(`Batch ${b + 1}/${batchCount}: segments ${start + 1}–${end}`);

    const prompt = BATCH_DESCRIPTIONS_PROMPT(batchInput, entities, language);

    let descriptions: Array<{ id: string; imagePrompt: string }>;
    let retries = 0;

    while (true) {
      try {
        const { text: raw } = await execute("generateText", { prompt });
        descriptions = parseDescriptions(raw, batchSegs.length);

        if (descriptions.length < batchSegs.length && retries < 2) {
          retries++;
          log.warn(
            `Batch ${b + 1}: got ${descriptions.length}/${batchSegs.length} — retry ${retries}/2`,
          );
          continue;
        }

        break;
      } catch (e: any) {
        if (retries < 2) {
          retries++;
          log.warn(`Batch ${b + 1} failed — retry ${retries}/2`);
          continue;
        }
        throw e;
      }
    }

    // Map results — handle partial responses gracefully
    for (let i = 0; i < batchSegs.length; i++) {
      const desc = i < descriptions.length ? descriptions[i] : undefined;
      const imagePrompt =
        typeof desc?.imagePrompt === "string"
          ? desc.imagePrompt
          : typeof desc === "string"
            ? desc
            : null;

      if (!imagePrompt) {
        log.error(
          `Missing description for segment ${start + i + 1} in batch ${b + 1} ` +
            `(got ${descriptions.length}/${batchSegs.length})`,
          desc ?? "undefined",
        );
        throw new Error(
          `Missing description for segment ${start + i + 1}. ` +
            `AI returned ${descriptions.length}/${batchSegs.length} items.`,
        );
      }

      prompts.set(start + i, imagePrompt);
    }

    log.success(
      `Batch ${b + 1}/${batchCount}: ${descriptions.length}/${batchSegs.length} ok`,
    );
  }

  const segments: Segment[] = data.segments.map((seg, i) => ({
    ...seg,
    imagePrompt: prompts.get(i)!,
  }));

  log.success(`${segments.length} descriptions total`);
  return { segments };
}
