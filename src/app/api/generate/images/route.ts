import { type NextRequest, NextResponse } from "next/server";
import "@/lib/ai/providers";
import { executeBatch } from "@/lib/ai/queue";
import { createLogger } from "@/lib/logger";
import {
  processSingleImage,
  createBatchHandler,
  type BatchImageItem,
} from "@/lib/services/image-service";

const log = createLogger("api/images");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (Array.isArray(body.requests)) {
      return handleBatch(body.requests, body.projectId, body.projectName);
    }

    if (!body.imagePrompt) {
      return NextResponse.json(
        { error: "Missing imagePrompt" },
        { status: 400 },
      );
    }

    const result = await processSingleImage(
      {
        imagePrompt: body.imagePrompt,
        referenceImage: body.referenceImage,
        referenceImages: body.referenceImages,
        imageConfig: body.imageConfig,
        index: body.index,
        projectId: body.projectId,
        projectName: body.projectName,
      },
      executeBatch,
    );

    return NextResponse.json({ imageUrl: result.imageUrl, id: result.id });
  } catch (e: any) {
    log.error("Image generation failed", e);
    return NextResponse.json(
      { error: e.message || "Internal error" },
      { status: 500 },
    );
  }
}

async function handleBatch(
  requests: any[],
  projectId?: string,
  projectName?: string,
) {
  const items: BatchImageItem[] = requests.map((r, i) => ({
    index: i,
    imagePrompt: r.imagePrompt,
    referenceImage: r.referenceImage,
    referenceImages: r.referenceImages,
    imageConfig: r.imageConfig,
    entityName: r.entityName,
    projectId,
    projectName,
  }));

  const encoder = new TextEncoder();
  const { requests: batchRequests, processResult } = createBatchHandler(
    items,
    executeBatch,
    encoder,
  );

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (data: any) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const pending: Promise<void>[] = [];
      await executeBatch("generateImage", batchRequests, {
        onResult: async (r) => {
          const p = (async () => {
            try {
              const result = await processResult(r);
              send(result);
            } catch (e: any) {
              send({ id: r.id, status: "error", error: e.message });
            }
          })();
          pending.push(p);
        },
      });

      await Promise.all(pending);
      send({ done: true });
      closed = true;
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
