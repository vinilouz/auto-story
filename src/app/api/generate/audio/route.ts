import { type NextRequest, NextResponse } from "next/server";
import { generateAudio } from "@/lib/ai/processors/audio-generator";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/audio");

export async function POST(request: NextRequest) {
  try {
    const {
      text,
      voice,
      systemPrompt,
      targetBatchIndices,
      projectId,
    } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    log.info(
      `Audio request: ${text.length} chars, voice=${voice || "default"}, batches=${targetBatchIndices || "all"}`,
    );

    const result = await generateAudio({
      text,
      voice,
      systemPrompt,
      targetBatchIndices,
      projectId,
    });

    const completed = result.batches.filter(
      (b) => b.status === "completed",
    ).length;
    const failed = result.batches.filter((b) => b.status === "error").length;
    log.success(
      `Audio done: ${completed}/${result.batches.length} ok, ${failed} failed`,
    );

    return NextResponse.json(result);
  } catch (e: any) {
    log.error("Audio generation failed", e);
    return NextResponse.json(
      { error: e.message || "Internal error" },
      { status: 500 },
    );
  }
}
