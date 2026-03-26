import { createLogger } from "@/lib/logger";

const log = createLogger("json-parser");

export function extractJsonArray(raw: string): string {
  let clean = raw.trim();

  // Try code block first
  const codeBlockMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    clean = codeBlockMatch[1].trim();
  }

  // Find matching brackets for array
  if (clean.includes("[")) {
    const startIdx = clean.indexOf("[");
    let depth = 0;
    let endIdx = -1;

    for (let i = startIdx; i < clean.length; i++) {
      if (clean[i] === "[") depth++;
      else if (clean[i] === "]") depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }

    if (endIdx > startIdx) {
      clean = clean.substring(startIdx, endIdx + 1);
    }
  }

  // Auto-recover truncated JSON arrays
  if (!clean.endsWith("]")) {
    const lastBrace = clean.lastIndexOf("}");
    if (lastBrace > 0) {
      clean = clean.substring(0, lastBrace + 1) + "]";
      log.warn(
        `Truncated response — recovered (raw length: ${raw.length} chars)`,
      );
    }
  }

  // Handle single object response when array was expected
  if (!clean.startsWith("[") && clean.startsWith("{")) {
    clean = `[${clean}]`;
  }

  if (!clean.startsWith("[")) {
    throw new Error("No JSON array found in AI response");
  }

  return clean;
}

export function parseJsonArray<T>(raw: string, expectedCount?: number): T[] {
  const clean = extractJsonArray(raw);

  let parsed: any;
  try {
    parsed = JSON.parse(clean.trim());
  } catch (e) {
    log.error(
      `JSON parse failed (raw: ${raw.length} chars, cleaned: ${clean.length} chars)`,
    );
    throw new Error(`Invalid JSON from AI: ${(e as Error).message}`);
  }

  // Some models nest the array under a property like `visualDescriptions` (from scene-visualizer)
  const arr = Array.isArray(parsed)
    ? parsed
    : parsed.visualDescriptions ||
      parsed.entities ||
      parsed.comments ||
      parsed.segments;

  if (!Array.isArray(arr)) {
    throw new Error("AI response is not an array");
  }

  if (expectedCount !== undefined && arr.length !== expectedCount) {
    log.warn(
      `AI returned ${arr.length}/${expectedCount} items (raw: ${raw.length} chars)`,
    );
  }

  return arr as T[];
}
