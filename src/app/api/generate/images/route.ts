import { type NextRequest, NextResponse } from "next/server";
import "@/lib/ai/providers";
import { executeBatch } from "@/lib/ai/queue";
import type { ImageRequest, ImageResponse } from "@/lib/ai/registry";
import { createLogger } from "@/lib/logger";
import { StorageService } from "@/lib/storage";

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

    // index undefined = imagem avulsa (ex: entity, commentator) — sem patchSegmentImage
    const segmentIndex: number | undefined = body.index;

    const singleReq: ImageRequest = {
      prompt: body.imagePrompt,
      referenceImages:
        body.referenceImages ||
        (body.referenceImage ? [body.referenceImage] : undefined),
      config: body.imageConfig,
    };
    const results = await executeBatch("generateImage", [singleReq]);
    const result = results[0];

    if (result.status === "error") {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    let imageUrl = result.data!.imageUrl;

    if (
      body.projectId &&
      body.projectName &&
      imageUrl.startsWith("data:image/")
    ) {
      const m = imageUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (m) {
        const ext = m[1] === "jpeg" ? "jpg" : m[1];
        // Se tem index explícito → nome img-N.jpg e patch no config
        // Se não tem index (entity, etc) → nome genérico sem patch de segmento
        const fileName =
          segmentIndex !== undefined
            ? `img-${segmentIndex + 1}.${ext}`
            : `img-${Date.now()}.${ext}`;

        const local = await StorageService.saveBase64Image(
          body.projectId,
          fileName,
          m[2],
          body.projectName,
        );
        if (local) {
          imageUrl = local;
          // Só patcha o config se for uma imagem de segmento (index explícito)
          if (segmentIndex !== undefined) {
            await StorageService.patchSegmentImage(
              body.projectId,
              body.projectName,
              segmentIndex,
              imageUrl,
            );
          }
        }
      }
    }

    return NextResponse.json({ imageUrl, id: result.id });
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
  const batchRequests: ImageRequest[] = requests.map((r) => ({
    prompt: r.imagePrompt,
    referenceImages:
      r.referenceImages || (r.referenceImage ? [r.referenceImage] : undefined),
    config: r.imageConfig,
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (data: any) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const pending: Promise<void>[] = [];
      await executeBatch("generateImage", batchRequests, {
        onResult: (r) => {
          const p = (async () => {
            try {
              if (r.status === "error") {
                send({
                  id: r.id,
                  status: "error",
                  error: r.error,
                  errorKind: r.errorKind,
                });
                return;
              }

              const segmentIndex: number | undefined = requests[r.id]?.index;
              const imgRes = r.data as ImageResponse;
              let imageUrl = imgRes.imageUrl;

              if (
                projectId &&
                projectName &&
                imageUrl.startsWith("data:image/")
              ) {
                const m = imageUrl.match(
                  /^data:image\/([a-zA-Z0-9]+);base64,(.+)$/,
                );
                if (m) {
                  const ext = m[1] === "jpeg" ? "jpg" : m[1];
                  const fileName =
                    segmentIndex !== undefined
                      ? `img-${segmentIndex + 1}.${ext}`
                      : `img-${Date.now()}.${ext}`;

                  const local = await StorageService.saveBase64Image(
                    projectId,
                    fileName,
                    m[2],
                    projectName,
                  );
                  if (local) {
                    imageUrl = local;
                    if (segmentIndex !== undefined) {
                      await StorageService.patchSegmentImage(
                        projectId,
                        projectName,
                        segmentIndex,
                        imageUrl,
                      );
                    }
                  }
                }
              }

              send({ id: r.id, status: "success", data: { imageUrl } });
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
