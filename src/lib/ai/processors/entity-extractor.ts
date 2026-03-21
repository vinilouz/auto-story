import { EXTRACT_ENTITIES_PROMPT } from "@/lib/ai/prompts/prompts";
import { execute } from "@/lib/ai/providers";
import type { Segment } from "@/lib/flows/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("entity-extractor");

export interface ExtractedEntity {
  type: string;
  segment: number[];
  description: string;
}

import { parseJsonArray } from "@/lib/ai/parsers/json-parser";

export async function extractEntities(
  segments: Segment[],
): Promise<ExtractedEntity[]> {
  if (!segments?.length) throw new Error("No segments");

  log.info(`Extracting entities from ${segments.length} segments`);

  const { text: raw } = await execute("generateText", {
    prompt: EXTRACT_ENTITIES_PROMPT(
      segments.map((s, i) => ({ id: i + 1, text: s.text })),
    ),
  });

  const parsed = parseJsonArray<any>(raw);

  log.success(
    `Extracted ${parsed.length} entities: ${parsed.map((e: any) => e.type).join(", ")}`,
  );
  return parsed;
}
