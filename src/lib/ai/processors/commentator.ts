import { COMMENTATOR_PROMPT } from "@/lib/ai/prompts/prompts";
import { execute } from "@/lib/ai/providers";
import type { Segment } from "@/lib/flows/types";

export async function generateCommentsWithCommentator(data: {
  commentatorDescription: string;
  segments: string[];
}) {
  if (!data.commentatorDescription || !data.segments?.length)
    throw new Error("Missing commentator data");

  const json = JSON.stringify(
    data.segments.map((text, i) => ({ id: i + 1, text: text.trim() })),
  );
  const { text: raw } = await execute("generateText", {
    prompt: COMMENTATOR_PROMPT(data.commentatorDescription, json),
  });

  let clean = raw.trim();
  const m =
    clean.match(/```json\s*(\[[\s\S]*?\])\s*```/) ||
    clean.match(/(\[[\s\S]*?\])/);
  if (m) clean = m[1];

  try {
    const parsed = JSON.parse(clean.trim());
    if (!Array.isArray(parsed)) throw new Error();
    const segments: Segment[] = parsed
      .map((item: any) =>
        item?.type && item?.content
          ? {
              text: String(item.content),
              type:
                item.type === "comment"
                  ? ("comment" as const)
                  : ("scene_text" as const),
            }
          : { text: String(item || ""), type: "scene_text" as const },
      )
      .filter((s: Segment) => s.text);
    if (segments.length) return { segments };
  } catch {}

  return {
    segments: data.segments.map((text) => ({
      text,
      type: "scene_text" as const,
    })),
  };
}
