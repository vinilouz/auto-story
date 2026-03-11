import { type NextRequest, NextResponse } from "next/server";
import { generateAndSaveVideoClip } from "@/lib/ai/processors/video-clip-generator";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/video-clips");

export async function POST(request: NextRequest) {
  try {
    const { prompt, referenceImage, duration, projectId, projectName } =
      await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    log.info(
      `Video clip request: ${duration || "?"}s, prompt: ${prompt.substring(0, 80)}...`,
    );

    const videoUrl = await generateAndSaveVideoClip(
      { prompt, referenceImage, duration },
      projectId,
      projectName,
    );

    log.success(`Video clip saved: ${videoUrl}`);
    return NextResponse.json({ videoUrl });
  } catch (e: any) {
    log.error("Video clip generation failed", e);
    return NextResponse.json(
      { error: e.message || "Internal error" },
      { status: 500 },
    );
  }
}
