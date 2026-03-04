import { SCENE_VISUAL_PROMPT } from "@/lib/ai/prompts/prompts";
import { execute } from "@/lib/ai/providers";
import type { Segment } from "@/lib/flows/types";

export interface SceneVisualizationRequest {
  segments: Segment[];
  language?: string;
  style?: string;
  consistency?: boolean;
  context?: "story" | "commentator";
  commentatorName?: string;
  commentatorPersonality?: string;
  commentatorImage?: string;
}

export async function generateSceneDescriptions(
  data: SceneVisualizationRequest,
) {
  if (!data.segments?.length) throw new Error("No segments");

  const prompt = SCENE_VISUAL_PROMPT(
    data.segments.map((s, i) => ({
      id: String(i + 1),
      scriptText: s.text.trim(),
    })),
    data.language || "Portuguese",
  );

  const { text: raw } = await execute("generateText", { prompt });

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

  const segments: Segment[] = data.segments.map((seg, i) => {
    const desc = descriptions[i];
    const imagePrompt =
      typeof desc?.imagePrompt === "string"
        ? desc.imagePrompt
        : typeof desc === "string"
          ? desc
          : null;
    if (!imagePrompt) throw new Error(`Bad description at index ${i}`);
    return { ...seg, imagePrompt };
  });

  let entities: string[] | undefined;
  if (data.consistency) {
    const set = new Set<string>();
    for (const s of segments) {
      const matches = s.imagePrompt?.match(/<<([^>]+)>>/g);
      if (matches) {
        for (const m of matches) {
          set.add(m.replace(/<<|>>/g, ""));
        }
      }
    }
    if (set.size > 0) entities = Array.from(set);
  }

  return { segments, ...(entities ? { entities } : {}) };
}
