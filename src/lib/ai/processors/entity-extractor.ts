import { EXTRACT_ENTITIES_PROMPT } from "@/lib/ai/prompts/prompts";
import { execute } from "@/lib/ai/providers";
import type { Segment } from "@/lib/flows/types";

export interface ExtractedEntity {
  type: string;
  segment: number[];
  description: string;
}

export async function extractEntities(segments: Segment[]): Promise<ExtractedEntity[]> {
  const { text: raw } = await execute("generateText", {
    prompt: EXTRACT_ENTITIES_PROMPT(
      segments.map((s, i) => ({ id: i + 1, text: s.text }))
    ),
  });

  let clean = raw.trim();
  const m =
    clean.match(/```json\s*(\[[\s\S]*?\])\s*```/) ||
    clean.match(/(\[[\s\S]*?\])/);
  if (m) clean = m[1];

  const parsed = JSON.parse(clean.trim());
  if (!Array.isArray(parsed)) throw new Error("Response not an array");
  return parsed;
}
