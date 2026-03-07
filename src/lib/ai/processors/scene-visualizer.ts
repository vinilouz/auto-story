import { BATCH_DESCRIPTIONS_PROMPT } from "@/lib/ai/prompts/prompts";
import { execute } from "@/lib/ai/providers";
import type { Segment } from "@/lib/flows/types";
import type { ExtractedEntity } from "@/lib/ai/processors/entity-extractor";

const BATCH_SIZE = 40;

export interface SceneVisualizationRequest {
  segments: Segment[];
  entities?: ExtractedEntity[];
  language?: string;
  style?: string;
  context?: "story" | "commentator";
  commentatorName?: string;
  commentatorPersonality?: string;
  commentatorImage?: string;
}

async function generateBatchDescriptions(
  segments: Array<{ id: string; scriptText: string }>,
  entities: ExtractedEntity[],
  language: string,
): Promise<Array<{ id: string; imagePrompt: string }>> {
  const { text: raw } = await execute("generateText", {
    prompt: BATCH_DESCRIPTIONS_PROMPT(segments, entities, language),
  });

  let clean = raw.trim();
  const m =
    clean.match(/```json\s*(\[[\s\S]*?\])\s*```/) ||
    clean.match(/(\[[\s\S]*?\])/);
  if (m) clean = m[1];

  const parsed = JSON.parse(clean.trim());
  const descriptions = Array.isArray(parsed)
    ? parsed
    : parsed.visualDescriptions;
  if (!Array.isArray(descriptions)) throw new Error("Response not an array");

  return descriptions;
}

export async function generateSceneDescriptions(
  data: SceneVisualizationRequest,
) {
  if (!data.segments?.length) throw new Error("No segments");

  const entities = data.entities || [];
  const language = data.language || "Portuguese";

  const formattedSegments = data.segments.map((s, i) => ({
    id: String(i + 1),
    scriptText: s.text.trim(),
  }));

  const batches: Array<{ id: string; scriptText: string }[]> = [];
  for (let i = 0; i < formattedSegments.length; i += BATCH_SIZE) {
    batches.push(formattedSegments.slice(i, i + BATCH_SIZE));
  }

  const allDescriptions: Array<{ id: string; imagePrompt: string }> = [];
  for (const batch of batches) {
    const batchResult = await generateBatchDescriptions(batch, entities, language);
    allDescriptions.push(...batchResult);
  }

  const segments: Segment[] = data.segments.map((seg, i) => {
    const desc = allDescriptions.find(d => d.id === String(i + 1));
    const imagePrompt =
      typeof desc?.imagePrompt === "string"
        ? desc.imagePrompt
        : typeof desc === "string"
          ? desc
          : null;
    if (!imagePrompt) {
      throw new Error(
        `Bad description at index ${i}.\nReceived: ${JSON.stringify(desc)}.\nFull AI response: ${JSON.stringify(allDescriptions)}`,
      );
    }
    return { ...seg, imagePrompt };
  });

  return { segments };
}
