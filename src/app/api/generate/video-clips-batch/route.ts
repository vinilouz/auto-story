import type { NextRequest } from "next/server";
import {
  type BatchClipRequest,
  generateVideoClipBatch,
} from "@/lib/ai/processors/video-clip-generator";
import { saveVideoClip } from "@/lib/services/media-saver";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/video-clips-batch");

export async function POST(request: NextRequest) {
  const { clips, projectId } = (await request.json()) as {
    clips: BatchClipRequest[];
    projectId?: string;
  };

  if (!clips?.length) {
    return new Response(JSON.stringify({ error: "Missing clips" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  log.info(`Batch video clip request: ${clips.length} clips`);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // ignore closed streams
        }
      };

      try {
        const results = await generateVideoClipBatch(
          clips,
          async (result) => {
            if (result.status === "success" && projectId && result.videoUrl) {
              try {
                result.videoUrl = await saveVideoClip(
                  result.videoUrl,
                  projectId,
                  result.index,
                );
              } catch (e: any) {
                result.status = "error";
                result.error = `Save failed: ${e.message}`;
              }
            }
            send({ type: "result", ...result });
          },
        );

        const ok = results.filter((r) => r.status === "success").length;
        const fail = results.filter((r) => r.status === "error").length;
        log.info(`Batch complete: ${ok} success, ${fail} failed`);
        send({ type: "done", total: clips.length, success: ok, failed: fail });
      } catch (e: any) {
        log.error("Batch video clip generation failed", e);
        send({ type: "error", error: e.message || "Internal error" });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
