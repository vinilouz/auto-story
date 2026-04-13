import { type NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import path from "path";
import { getCredentials } from "@/lib/ai/registry";
import { apiRequestSSE } from "@/lib/ai/http-client";
import { saveMusic } from "@/lib/services/media-saver";
import { StorageService } from "@/lib/storage";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/music");

export const maxDuration = 300;

const DEFAULT_MUSIC_PROMPT =
  "Soft spiritual instrumental, gentle piano, warm strings and ambient choir, peaceful and sacred mood, reflective atmosphere inspired by biblical themes, perfect background music for narrating stories from the Bible, no vocals.";

export async function POST(request: NextRequest) {
  try {
    const { projectId, prompt, style } = await request.json();

    if (projectId) {
      const rawPath = path.join(
        process.cwd(), "public", "projects", projectId, "music", "background-raw.mp4",
      );
      const compressedPath = path.join(
        process.cwd(), "public", "projects", projectId, "music", "background.mp4",
      );

      if (existsSync(rawPath) || existsSync(compressedPath)) {
        const useCompressed = existsSync(compressedPath);
        const publicPath = `/projects/${projectId}/music/${useCompressed ? "background.mp4" : "background-raw.mp4"}`;
        await StorageService.patchMusic(projectId, publicPath);
        log.success(`Music already exists, returning cached: ${publicPath}`);
        return NextResponse.json({ type: "done", musicUrl: publicPath });
      }
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
              style,
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

                const finalUrl = projectId
                  ? await saveMusic(parsed.url, projectId)
                  : parsed.url;

                send(controller, { type: "done", musicUrl: finalUrl });
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
