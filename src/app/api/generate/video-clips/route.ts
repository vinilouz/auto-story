import { type NextRequest, NextResponse } from "next/server";
import { generateVideoClip } from "@/lib/ai/processors/video-clip-generator";
import { saveVideoClip } from "@/lib/services/media-saver";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/video-clips");

export async function POST(request: NextRequest) {
  try {
    const { prompt, referenceImage, duration, projectId, index = 0 } =
      await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    log.info(
      `Video clip request: ${duration || "?"}s, prompt: ${prompt.substring(0, 80)}...`,
    );

    const { videoUrl } = await generateVideoClip({
      prompt,
      referenceImage,
      duration,
    });

    const finalUrl = projectId
      ? await saveVideoClip(videoUrl, projectId, index)
      : videoUrl;

    log.success(`Video clip: ${finalUrl}`);
    return NextResponse.json({ videoUrl: finalUrl });
  } catch (e: any) {
    log.error("Video clip generation failed", e);
    return NextResponse.json(
      { error: e.message || "Internal error" },
      { status: 500 },
    );
  }
}
