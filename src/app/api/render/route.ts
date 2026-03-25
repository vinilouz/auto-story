import { bundle } from "@remotion/bundler";
import { type OnStartData, renderMedia } from "@remotion/renderer";
import ffmpeg from "ffmpeg-static";
import fs from "node:fs";
import path from "node:path";
// @ts-expect-error
import ffprobe from "ffprobe-static";
import os from "node:os";
import { type NextRequest, NextResponse } from "next/server";
import { ACTIVE_RENDERER, RENDERER } from "@/lib/video/config";
import { renderWithMediabunny } from "@/lib/video/mediabunny";
import { createLogger } from "@/lib/logger";
import {
  REMOTION_CACHE_SIZE,
  REMOTION_CRF,
  REMOTION_X264_PRESET,
} from "@/remotion/constants";

const log = createLogger("api/render");

if (ffmpeg && ffprobe && ffprobe.path) {
  const ffmpegDir = path.dirname(ffmpeg);
  const ffprobeDir = path.dirname(ffprobe.path);
  process.env.PATH = `${ffmpegDir}${path.delimiter}${ffprobeDir}${path.delimiter}${process.env.PATH}`;
}

let cachedBundleLocation: string | null = null;

const ensureBundle = async (): Promise<string> => {
  if (cachedBundleLocation) return cachedBundleLocation;

  const entryPoint = path.join(process.cwd(), "src", "remotion", "index.ts");
  log.info("Bundling Remotion project (first request, will be cached)...");

  cachedBundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...(config.resolve?.alias ?? {}),
          "@": path.join(process.cwd(), "src"),
        },
      },
    }),
  });

  log.success("Remotion bundle ready");
  return cachedBundleLocation;
};

const toAbsoluteUrl = (url: string, origin: string): string => {
  if (!url) return url;
  if (
    url.startsWith("data:") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  )
    return url;
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
};

const normalizeProps = (props: Record<string, unknown>, origin: string) => ({
  ...props,
  scenes:
    (props.scenes as Array<Record<string, unknown>>)?.map((s) => ({
      ...s,
      imageUrl: toAbsoluteUrl(s.imageUrl as string, origin),
      videoClipUrl: s.videoClipUrl
        ? toAbsoluteUrl(s.videoClipUrl as string, origin)
        : undefined,
    })) ?? [],
  audioTracks:
    (props.audioTracks as Array<Record<string, unknown>>)?.map((t) => ({
      ...t,
      src: toAbsoluteUrl(t.src as string, origin),
    })) ?? [],
});

const RENDER_CONCURRENCY = Math.max(1, os.cpus().length);

export async function POST(req: NextRequest) {
  let tempOutput = "";
  try {
    const body = await req.json();
    const {
      videoProps,
      projectId,
      projectName,
      compositionId = "CaptionedVideo",
    } = body;

    if (!videoProps) {
      return NextResponse.json(
        { error: "Missing videoProps" },
        { status: 400 },
      );
    }

    const origin = req.nextUrl.origin;
    const normalizedProps = normalizeProps(videoProps, origin);

    log.info(`Using renderer: ${ACTIVE_RENDERER}`);

    if (ACTIVE_RENDERER === RENDERER.MEDIABUNNY) {
      return handleMediabunnyRender(
        normalizedProps,
        projectId,
        projectName,
        origin,
      );
    }

    return handleRemotionRender(
      normalizedProps,
      projectId,
      projectName,
      compositionId,
    );
  } catch (error: unknown) {
    log.error("Render route error", error);
    if (tempOutput) fs.promises.unlink(tempOutput).catch(() => {});
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to render",
      },
      { status: 500 },
    );
  }
}

async function handleMediabunnyRender(
  props: Record<string, unknown>,
  projectId: string | undefined,
  projectName: string | undefined,
  origin: string,
): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        sendEvent({ type: "progress", progress: 0, stage: "rendering" });

        const { outputPath, videoUrl } = getOutputPath(projectId);

        await renderWithMediabunny(
          props as Parameters<typeof renderWithMediabunny>[0],
          outputPath,
          (progress) => {
            sendEvent({
              type: "progress",
              progress: Math.round(progress * 100),
              stage: "rendering",
            });
          },
        );

        log.success(`Mediabunny render complete: ${videoUrl}`);
        sendEvent({ type: "progress", progress: 100, stage: "complete" });
        sendEvent({ type: "complete", videoUrl });
        controller.close();
      } catch (error: unknown) {
        log.error("Mediabunny render failed", error);
        sendEvent({
          type: "error",
          error: error instanceof Error ? error.message : "Render failed",
        });
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
}

async function handleRemotionRender(
  props: Record<string, unknown>,
  projectId: string | undefined,
  projectName: string | undefined,
  compositionId: string,
): Promise<Response> {
  const bundleLocation = await ensureBundle();
  const tempOutput = path.join(os.tmpdir(), `render-${Date.now()}.mp4`);

  log.info(
    `Rendering video (concurrency: ${RENDER_CONCURRENCY}, composition: ${compositionId})`,
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        sendEvent({ type: "progress", progress: 0, stage: "bundling" });
        let totalFrames = (props.durationInFrames as number) || 1;

        await renderMedia({
          composition: {
            id: compositionId,
            props,
            durationInFrames: props.durationInFrames as number,
            fps: props.fps as number,
            width: props.width as number,
            height: props.height as number,
          },
          serveUrl: bundleLocation,
          codec: "h264",
          outputLocation: tempOutput,
          inputProps: props,
          timeoutInMilliseconds: 3600000,
          concurrency: RENDER_CONCURRENCY,
          crf: REMOTION_CRF,
          x264Preset: REMOTION_X264_PRESET,
          imageFormat: "jpeg",
          disallowParallelEncoding: false,
          offthreadVideoThreads: RENDER_CONCURRENCY,
          offthreadVideoCacheSizeInBytes: REMOTION_CACHE_SIZE,
          mediaCacheSizeInBytes: REMOTION_CACHE_SIZE,
          logLevel: "info",
          chromiumOptions: {
            ignoreCertificateErrors: true,
            enableMultiProcessOnLinux: true,
            disableWebSecurity: true,
            gl: "angle-egl",
          },
          onStart: (data: OnStartData) => {
            totalFrames = data.frameCount;
            sendEvent({
              type: "progress",
              progress: 0,
              stage: "rendering",
              totalFrames,
            });
          },
          onProgress: (progress) => {
            const pct = Math.round(
              (progress.renderedFrames / totalFrames) * 100,
            );
            sendEvent({
              type: "progress",
              progress: pct,
              stage: "rendering",
              renderedFrames: progress.renderedFrames,
              totalFrames,
            });
          },
        });

        sendEvent({ type: "progress", progress: 100, stage: "encoding" });

        const { outputPath, videoUrl } = getOutputPath(projectId);

        await fs.promises.rename(tempOutput, outputPath);
        log.success(`Remotion render complete: ${videoUrl}`);
        sendEvent({ type: "complete", videoUrl });
        controller.close();
      } catch (error: unknown) {
        log.error("Remotion render failed", error);
        if (tempOutput && fs.existsSync(tempOutput))
          fs.promises.unlink(tempOutput).catch(() => {});
        sendEvent({
          type: "error",
          error: error instanceof Error ? error.message : "Render failed",
        });
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
}

function getOutputPath(
  projectId: string | undefined,
): { outputPath: string; videoUrl: string } {
  if (projectId) {
    const rendersDir = path.join(
      process.cwd(),
      "public",
      "projects",
      projectId,
      "videos",
    );
    if (!fs.existsSync(rendersDir))
      fs.mkdirSync(rendersDir, { recursive: true });
    const fileName = `render-${Date.now()}.mp4`;
    const outputPath = path.join(rendersDir, fileName);
    const videoUrl = `/projects/${projectId}/videos/${fileName}`;
    return { outputPath, videoUrl };
  }

  const rendersDir = path.join(process.cwd(), "public", "renders");
  if (!fs.existsSync(rendersDir))
    fs.mkdirSync(rendersDir, { recursive: true });
  const fileName = `render-${Date.now()}.mp4`;
  const outputPath = path.join(rendersDir, fileName);
  const videoUrl = `/renders/${fileName}`;
  return { outputPath, videoUrl };
}
