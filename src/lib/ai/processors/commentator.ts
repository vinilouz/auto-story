import { COMMENTATOR_PROMPT } from "@/lib/ai/prompts/prompts";
import { execute } from "@/lib/ai/providers";
import type { Segment } from "@/lib/flows/types";
import { createLogger } from "@/lib/logger";
import { parseJsonArray } from "@/lib/ai/parsers/json-parser";

const log = createLogger("commentator");

export async function generateCommentsWithCommentator(data: {
  commentatorDescription: string;
  segments: string[];
}) {
  if (!data.commentatorDescription || !data.segments?.length)
    throw new Error("Missing commentator data");

  const json = JSON.stringify(
    data.segments.map((text, i) => ({ id: i + 1, text: text.trim() })),
  );

  log.info(`Generating comments for ${data.segments.length} segments`);
  const { text: raw } = await execute("generateText", {
    prompt: COMMENTATOR_PROMPT(data.commentatorDescription, json),
  });

  try {
    const parsed = parseJsonArray<any>(raw);

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

    if (segments.length) {
      log.success(
        `Generated ${segments.filter((s) => s.type === "comment").length} comments`,
      );
      return { segments };
    }
  } catch (e) {
    log.error("Failed to parse commentator response", raw.substring(0, 500));
  }

  // Fallback: return original segments unchanged
  log.warn("Using fallback — original segments without comments");
  return {
    segments: data.segments.map((text) => ({
      text,
      type: "scene_text" as const,
    })),
  };
}
