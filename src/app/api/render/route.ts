import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { bundle } from "@remotion/bundler";
import { renderMedia, OnStartData } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import os from "os";
import ffmpeg from "ffmpeg-static";
// @ts-ignore
import ffprobe from "ffprobe-static";
import {
  REMOTION_CACHE_SIZE,
  REMOTION_CRF,
  REMOTION_X264_PRESET,
} from "@/remotion/constants";

if (ffmpeg && ffprobe && ffprobe.path) {
  const ffmpegDir = path.dirname(ffmpeg);
  const ffprobeDir = path.dirname(ffprobe.path);
  process.env.PATH = `${ffmpegDir}${path.delimiter}${ffprobeDir}${path.delimiter}${process.env.PATH}`;
}


let cachedBundleLocation: string | null = null;

const ensureBundle = async (): Promise<string> => {
  if (cachedBundleLocation) return cachedBundleLocation;

  const entryPoint = path.join(process.cwd(), "src", "remotion", "index.ts");
  console.log("Bundling Remotion project (first request, will be cached)...");

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

  return cachedBundleLocation;
};

const toAbsoluteUrl = (url: string, origin: string): string => {
  if (!url) return url;
  if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) return url;
  const pathname = url.startsWith("/") ? url : `/${url}`;
  return `${origin}${pathname}`;
};

const normalizeProps = (props: any, origin: string): any => ({
  ...props,
  scenes: props.scenes?.map((s: any) => ({ ...s, imageUrl: toAbsoluteUrl(s.imageUrl, origin) })) ?? [],
  audioTracks: props.audioTracks?.map((t: any) => ({ ...t, src: toAbsoluteUrl(t.src, origin) })) ?? [],
});

const RENDER_CONCURRENCY = Math.max(1, Math.ceil(os.cpus().length / 2));

export async function POST(req: NextRequest) {
  let tempOutput = "";
  try {
    const body = await req.json();
    const { videoProps, projectId, projectName } = body;

    if (!videoProps) {
      return NextResponse.json(
        { error: "Missing videoProps" },
        { status: 400 }
      );
    }

    const origin = req.nextUrl.origin;
    const normalizedProps = normalizeProps(videoProps, origin);

    const bundleLocation = await ensureBundle();
    const compositionId = "CaptionedVideo";

    console.log(`Rendering video (concurrency: ${RENDER_CONCURRENCY})...`);
    tempOutput = path.join(os.tmpdir(), `render-${Date.now()}.mp4`);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          sendEvent({ type: "progress", progress: 0, stage: "bundling" });

          let totalFrames = normalizedProps.durationInFrames || 1;

          await renderMedia({
            composition: {
              id: compositionId,
              props: normalizedProps,
              durationInFrames: normalizedProps.durationInFrames,
              fps: normalizedProps.fps,
              width: normalizedProps.width,
              height: normalizedProps.height,
            } as any,
            serveUrl: bundleLocation,
            codec: "h264",
            outputLocation: tempOutput,
            inputProps: normalizedProps,
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
              gl: "swangle",
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
                (progress.renderedFrames / totalFrames) * 100
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

          // Ensure renders directory exists within the project directory
          let publicOutput: string;
          let videoUrl: string;

          if (projectId && projectName) {
            const cleanTitle = (text: string) => text.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').substring(0, 10);
            const slug = cleanTitle(projectName) || 'untitled';
            const shortId = projectId.split('-')[0] || projectId.substring(0, 8);
            const dirName = `${slug}-${shortId}`;

            const rendersDir = path.join(process.cwd(), "public", "projects", dirName, "videos");
            if (!fs.existsSync(rendersDir)) {
              await fs.promises.mkdir(rendersDir, { recursive: true });
            }

            const fileName = `render-${Date.now()}.mp4`;
            publicOutput = path.join(rendersDir, fileName);
            videoUrl = `/projects/${dirName}/videos/${fileName}`;
          } else {
            // Fallback for requests without project context
            const rendersDir = path.join(process.cwd(), "public", "renders");
            if (!fs.existsSync(rendersDir)) {
              await fs.promises.mkdir(rendersDir, { recursive: true });
            }
            const fileName = `render-${Date.now()}.mp4`;
            publicOutput = path.join(rendersDir, fileName);
            videoUrl = `/renders/${fileName}`;
          }

          // Move temp file to persistent storage
          await fs.promises.rename(tempOutput, publicOutput);

          sendEvent({ type: "complete", videoUrl });
          controller.close();
        } catch (error: any) {
          console.error("Render API Error:", error);
          if (tempOutput && fs.existsSync(tempOutput)) {
            fs.promises.unlink(tempOutput).catch(() => { });
          }
          sendEvent({ type: "error", error: error.message || "Render failed" });
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
  } catch (error: any) {
    console.error("Render API Error:", error);
    if (tempOutput) fs.promises.unlink(tempOutput).catch(() => { });
    return NextResponse.json(
      { error: error.message || "Failed to render" },
      { status: 500 }
    );
  }
}
