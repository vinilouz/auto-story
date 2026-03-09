import { BATCH_DESCRIPTIONS_PROMPT } from "@/lib/ai/prompts/prompts";
import { execute } from "@/lib/ai/providers";
import type { Segment } from "@/lib/flows/types";
import type { ExtractedEntity } from "@/lib/ai/processors/entity-extractor";

const BATCH_SIZE = 10;

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

  let descriptions: any[] = [];
  try {
    const parsed = JSON.parse(clean.trim());
    descriptions = Array.isArray(parsed)
      ? parsed
      : parsed.visualDescriptions;
    if (!Array.isArray(descriptions)) throw new Error("Parsed result is not an array");
  } catch (error) {
    console.warn("Failed to parse descriptions JSON directly. Attempting regex fallback extraction...");
    console.warn("Raw LLM Response snippet:", clean.substring(0, 200) + "...");

    descriptions = [];
    const tempBlocks = clean.replace(/^\[?\s*\{?/, '').replace(/\}?\s*\]?$/, '').split(/\}\s*,\s*\{/);

    for (let i = 0; i < tempBlocks.length; i++) {
      const block = tempBlocks[i];
      const idMatch = block.match(/"id"\s*[:=]\s*"(\d+)"/i) || block.match(/(\d+)/);
      const id = idMatch ? idMatch[1] : String(i + 1);

      let prompt = "";
      const promptMatch = block.match(/(?:imagePrompt|image|description)"?\s*[:=,]\s*"([^"]+)"/i);

      if (promptMatch) {
        prompt = promptMatch[1];
      } else {
        const quotes = block.match(/"([^"]+)"/g);
        if (quotes && quotes.length > 0) {
          prompt = quotes.sort((a, b) => b.length - a.length)[0].replace(/^"|"$/g, '');
        }
      }

      if (prompt) {
        descriptions.push({ id, imagePrompt: prompt });
      }
    }

    if (descriptions.length === 0) {
      console.error("Critical: Regex fallback failed to extract any descriptions.");
    } else {
      console.info(`Successfully extracted ${descriptions.length} items via regex fallback.`);
    }
  }

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
    const segmentId = String(i + 1);
    const desc = allDescriptions.find(d => d.id === segmentId);
    const imagePrompt =
      typeof desc?.imagePrompt === "string"
        ? desc.imagePrompt
        : typeof desc === "string"
          ? desc
          : null;
    if (!imagePrompt) {
      console.warn(`Missing description for segment ${segmentId}. Using fallback prompt.`);
      return { ...seg, imagePrompt: `Cinematic shot, ${seg.text.substring(0, 100)}...` };
    }
    return { ...seg, imagePrompt };
  });

  return { segments };
}
