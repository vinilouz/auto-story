import JSZip from "jszip";
import { type NextRequest, NextResponse } from "next/server";
import type { Segment } from "@/lib/flows/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/zip");

interface ZipRequest {
  segments: Segment[];
  audioUrls?: string[];
  transcriptionResults?: Array<{
    url: string;
    status: "completed" | "error";
    transcriptionUrl?: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body: ZipRequest = await request.json();

    if (!body.segments || !Array.isArray(body.segments)) {
      return NextResponse.json(
        { error: "Missing segments array" },
        { status: 400 },
      );
    }

    log.info(
      `ZIP request: ${body.segments.length} segments, ${body.audioUrls?.length || 0} audios`,
    );

    const zip = new JSZip();
    const errors: string[] = [];

    // Images
    for (let i = 0; i < body.segments.length; i++) {
      const seg = body.segments[i];
      if (!seg.imagePath) continue;
      try {
        let fetchUrl = seg.imagePath;
        if (seg.imagePath.startsWith("/"))
          fetchUrl = `${request.nextUrl.origin}${seg.imagePath}`;
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        zip.file(
          `scene-${String(i + 1).padStart(3, "0")}.jpg`,
          Buffer.from(await res.arrayBuffer()),
        );
      } catch (e: any) {
        errors.push(`image ${i + 1}: ${e.message}`);
      }
    }

    // Audio
    if (body.audioUrls) {
      for (let i = 0; i < body.audioUrls.length; i++) {
        try {
          let fetchUrl = body.audioUrls[i];
          if (fetchUrl.startsWith("/"))
            fetchUrl = `${request.nextUrl.origin}${fetchUrl}`;
          const res = await fetch(fetchUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          zip.file(
            `part-${String(i + 1).padStart(3, "0")}.mp3`,
            Buffer.from(await res.arrayBuffer()),
          );
        } catch (e: any) {
          errors.push(`audio ${i + 1}: ${e.message}`);
        }
      }
    }

    // Transcriptions
    if (body.transcriptionResults) {
      for (let i = 0; i < body.transcriptionResults.length; i++) {
        const r = body.transcriptionResults[i];
        if (r.status !== "completed" || !r.transcriptionUrl) continue;
        try {
          let fetchUrl = r.transcriptionUrl;
          if (fetchUrl.startsWith("/"))
            fetchUrl = `${request.nextUrl.origin}${fetchUrl}`;
          const res = await fetch(fetchUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          zip.file(
            `part-${String(i + 1).padStart(3, "0")}.json`,
            await res.text(),
          );
        } catch (e: any) {
          errors.push(`transcription ${i + 1}: ${e.message}`);
        }
      }
    }

    // Metadata
    zip.file(
      "metadata.json",
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          totalScenes: body.segments.length,
          audioFiles:
            body.audioUrls?.map((_, i) => ({
              filename: `part-${String(i + 1).padStart(3, "0")}.mp3`,
              transcriptionFile:
                body.transcriptionResults?.[i]?.status === "completed"
                  ? `part-${String(i + 1).padStart(3, "0")}.json`
                  : null,
            })) || [],
          scenes: body.segments.map((seg, i) => ({
            sceneNumber: i + 1,
            text: seg.text,
            type: seg.type || "scene_text",
            imagePrompt: seg.imagePrompt,
          })),
        },
        null,
        2,
      ),
    );

    // Script
    const scriptContent = body.segments
      .filter((s) => !s.type || s.type === "scene_text")
      .map((seg, i) => `=== CENA ${i + 1} ===\n\n${seg.text}`)
      .join("\n\n");
    if (scriptContent) zip.file("script.txt", scriptContent);

    // Prompts
    const prompts = body.segments
      .filter((s) => s.imagePrompt)
      .map((seg, i) => ({ sceneNumber: i + 1, prompt: seg.imagePrompt }));
    zip.file("prompts.json", JSON.stringify(prompts, null, 2));

    const zipBuffer = await zip.generateAsync({ type: "uint8array" });

    if (errors.length)
      log.warn(`ZIP generated with ${errors.length} errors`, errors);
    else log.success("ZIP generated successfully");

    return new NextResponse(zipBuffer as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="story-${Date.now()}.zip"`,
      },
    });
  } catch (e: any) {
    log.error("ZIP generation failed", e);
    return NextResponse.json(
      { error: "Failed to generate ZIP" },
      { status: 500 },
    );
  }
}
