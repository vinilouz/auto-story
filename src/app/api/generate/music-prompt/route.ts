import { type NextRequest, NextResponse } from "next/server";
import { generateMusicPrompt } from "@/lib/ai/processors/music-prompt-generator";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/music-prompt");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.segments?.length) {
      return NextResponse.json(
        { error: "Missing segments" },
        { status: 400 },
      );
    }

    log.info(`Music prompt request: ${body.segments.length} segments`);
    const result = await generateMusicPrompt(body);
    log.success("Music prompt generated");

    return NextResponse.json(result);
  } catch (e: any) {
    log.error("Music prompt generation failed", e);
    return NextResponse.json(
      { error: e.message || "Internal error" },
      { status: 500 },
    );
  }
}
