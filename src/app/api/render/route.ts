import { bundle } from "@remotion/bundler";
import { type OnStartData, renderMedia } from "@remotion/renderer";
import ffmpeg from "ffmpeg-static";
import fs from "node:fs";
import { cpus } from "node:os";
import path from "node:path";
// @ts-expect-error
import ffprobe from "ffprobe-static";
import { type NextRequest, NextResponse } from "next/server";
import { ACTIVE_RENDERER, RENDERER } from "@/lib/video/config";
import { renderWithMediabunny } from "@/lib/video/mediabunny";
import type { RemotionVideoProps } from "@/lib/video/types";
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
  musicSrc: props.musicSrc
    ? toAbsoluteUrl(props.musicSrc as string, origin)
    : undefined,
});

const cpuCount = cpus().length;
const RENDER_CONCURRENCY = cpuCount > 10 ? 10 : Math.floor(cpuCount / 2);

async function checkUrl(
  url: string,
  origin?: string,
): Promise<{ url: string; ok: boolean; status?: number }> {
  if (!url || url.startsWith("data:")) return { url, ok: true };

  const isSameHost = (a: string, b: string): boolean => {
    try {
      const ua = new URL(a);
      const ub = new URL(b);
      return ua.hostname === ub.hostname && ua.port === ub.port;
    } catch {
      return false;
    }
  };

  const isLocal = (target: string): boolean => {
    if (target.startsWith("/")) return true;
    if (origin && isSameHost(target, origin)) return true;
    return false;
  };

  if (isLocal(url)) {
    let localPath = url;
    try {
      const parsed = new URL(url);
      localPath = parsed.pathname;
    } catch {
      // already relative
    }
    const filePath = path.join(process.cwd(), "public", localPath);
    try {
      await fs.promises.access(filePath);
      return { url, ok: true };
    } catch {
      return { url, ok: false };
    }
  }

  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    return { url, ok: res.ok, status: res.status };
  } catch {
    return { url, ok: false };
  }
}

async function validateAssets(
  props: Record<string, unknown>,
  origin: string,
): Promise<{ valid: boolean; broken: string[] }> {
  const urls: string[] = [];

  const scenes = props.scenes as Array<Record<string, unknown>> | undefined;
  if (scenes) {
    for (const s of scenes) {
      if (s.imageUrl) urls.push(s.imageUrl as string);
      if (s.videoClipUrl) urls.push(s.videoClipUrl as string);
    }
  }

  const audioTracks = props.audioTracks as Array<Record<string, unknown>> | undefined;
  if (audioTracks) {
    for (const t of audioTracks) {
      if (t.src) urls.push(t.src as string);
    }
  }

  if (props.musicSrc) urls.push(props.musicSrc as string);

  const uniqueUrls = [...new Set(urls)];
  const results = await Promise.all(uniqueUrls.map((url) => checkUrl(url, origin)));
  const broken = results.filter((r) => !r.ok).map((r) => r.url);

  if (broken.length > 0) {
    log.error(`Asset validation failed: ${broken.length}/${uniqueUrls.length} URLs broken`);
  } else {
    log.info(`Asset validation passed: ${uniqueUrls.length} URLs OK`);
  }

  return { valid: broken.length === 0, broken };
}

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
      origin,
    );
  } catch (error: unknown) {
    log.error("Render route error", error);
    if (tempOutput) fs.promises.unlink(tempOutput).catch(() => { });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to render",
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
      let closed = false;
      const sendEvent = (data: Record<string, unknown>) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        sendEvent({ type: "progress", progress: 0, stage: "validating" });
        const { valid, broken } = await validateAssets(props, origin);
        if (!valid) {
          sendEvent({
            type: "error",
            error: `Broken assets (${broken.length}): ${broken.join(", ")}`,
          });
          closed = true;
          controller.close();
          return;
        }

        sendEvent({ type: "progress", progress: 0, stage: "rendering" });

        const { outputPath, videoUrl } = getOutputPath(projectId);

        await renderWithMediabunny(
          props as unknown as RemotionVideoProps,
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
        closed = true;
        controller.close();
      } catch (error: unknown) {
        log.error("Mediabunny render failed", error);
        sendEvent({
          type: "error",
          error: error instanceof Error ? error.message : "Render failed",
        });
        closed = true;
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
  origin: string,
): Promise<Response> {
  const bundleLocation = await ensureBundle();
  const { outputPath, videoUrl } = getOutputPath(projectId);

  log.info(`Rendering video (composition: ${compositionId})`);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const sendEvent = (data: Record<string, unknown>) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        sendEvent({ type: "progress", progress: 0, stage: "validating" });
        const { valid, broken } = await validateAssets(props, origin);
        if (!valid) {
          sendEvent({
            type: "error",
            error: `Broken assets (${broken.length}): ${broken.join(", ")}`,
          });
          closed = true;
          controller.close();
          return;
        }

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
            defaultProps: {},
            defaultCodec: null,
            defaultOutName: null,
            defaultVideoImageFormat: null,
            defaultPixelFormat: null,
            defaultProResProfile: null,
            defaultSampleRate: null,
          },
          serveUrl: bundleLocation,
          codec: "h264",
          outputLocation: outputPath,
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
              renderStartMs: Date.now(),
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

        log.success(`Remotion render complete: ${videoUrl}`);
        sendEvent({ type: "complete", videoUrl });
        closed = true;
        controller.close();
      } catch (error: unknown) {
        log.error("Remotion render failed", error);
        if (fs.existsSync(outputPath))
          fs.promises.unlink(outputPath).catch(() => { });
        sendEvent({
          type: "error",
          error: error instanceof Error ? error.message : "Render failed",
        });
        closed = true;
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

function getOutputPath(projectId: string | undefined): {
  outputPath: string;
  videoUrl: string;
} {
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
  if (!fs.existsSync(rendersDir)) fs.mkdirSync(rendersDir, { recursive: true });
  const fileName = `render-${Date.now()}.mp4`;
  const outputPath = path.join(rendersDir, fileName);
  const videoUrl = `/renders/${fileName}`;
  return { outputPath, videoUrl };
}
