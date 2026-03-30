import { type NextRequest, NextResponse } from "next/server";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { getCredentials } from "@/lib/ai/registry";
import { apiRequestSSE } from "@/lib/ai/http-client";
import { StorageService } from "@/lib/storage";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/music");

export const maxDuration = 300;

const DEFAULT_MUSIC_PROMPT =
  "Soft spiritual instrumental, gentle piano, warm strings and ambient choir, peaceful and sacred mood, reflective atmosphere inspired by biblical themes, perfect background music for narrating stories from the Bible, no vocals.";

export async function POST(request: NextRequest) {
  try {
    const { projectId, prompt } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const creds = getCredentials("louzlabs");
    if (!creds) {
      return NextResponse.json(
        { error: "No credentials for louzlabs" },
        { status: 500 },
      );
    }

    const encoder = new TextEncoder();
    const send = (controller: ReadableStreamDefaultController, data: unknown) =>
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
      );

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const res = await apiRequestSSE(
            `${creds.baseUrl}/v1/music/generations`,
            creds.apiKey,
            {
              prompt: prompt || DEFAULT_MUSIC_PROMPT,
              instrumental: true,
            },
            {
              timeoutMs: 240_000,
              actionName: "generateMusic",
              providerAndModel: "louzlabs/default",
            },
          );

          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const chunks = buffer.split("\n\n");
            buffer = chunks.pop() || "";

            for (const chunk of chunks) {
              for (const line of chunk.split("\n")) {
                if (line.startsWith(": ")) {
                  send(controller, { type: "keepalive" });
                  continue;
                }

                if (!line.startsWith("data: ")) continue;
                const raw = line.slice(6).trim();
                if (!raw || raw === "[DONE]") continue;

                let parsed: { url?: string };
                try {
                  parsed = JSON.parse(raw);
                } catch {
                  continue;
                }

                if (!parsed.url) continue;

                send(controller, {
                  type: "status",
                  message: "Downloading music file...",
                });

                const musicDir = path.join(
                  process.cwd(),
                  "public",
                  "projects",
                  projectId,
                  "music",
                );
                if (!existsSync(musicDir))
                  mkdirSync(musicDir, { recursive: true });

                const filename = "background.mp4";
                const filepath = path.join(musicDir, filename);
                const publicPath = `/projects/${projectId}/music/${filename}`;

                if (parsed.url.startsWith("data:")) {
                  const [, base64Data] = parsed.url.split(",");
                  writeFileSync(filepath, Buffer.from(base64Data, "base64"));
                } else {
                  const dl = await fetch(parsed.url);
                  if (!dl.ok)
                    throw new Error(`Download failed: HTTP ${dl.status}`);
                  writeFileSync(
                    filepath,
                    Buffer.from(await dl.arrayBuffer()),
                  );
                }

                await StorageService.patchMusic(projectId, publicPath);

                log.success(`Music saved: ${publicPath}`);
                send(controller, { type: "done", musicUrl: publicPath });
                controller.close();
                return;
              }
            }
          }

          send(controller, {
            type: "error",
            error: "Stream ended without music URL",
          });
          controller.close();
        } catch (e: any) {
          log.error("Music generation failed", e);
          try {
            send(controller, { type: "error", error: e.message });
          } catch {}
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e: any) {
    log.error("Music generation failed", e);
    return NextResponse.json(
      { error: e.message || "Internal error" },
      { status: 500 },
    );
  }
}
