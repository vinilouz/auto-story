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

const getMimeType = (filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
};

const toDataUri = async (url: string) => {
  if (!url) return url;

  let filePath = "";

  if (url.startsWith("/")) {
    filePath = path.join(process.cwd(), "public", url);
  } else if (url.includes("localhost")) {
    try {
      const parsed = new URL(url);
      filePath = path.join(process.cwd(), "public", parsed.pathname);
    } catch {
      return url;
    }
  } else {
    return url;
  }

  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found for data URI conversion: ${filePath}`);
      return url;
    }

    const buffer = await fs.promises.readFile(filePath);
    const mimeType = getMimeType(filePath);
    const base64 = buffer.toString("base64");
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`Error converting to data URI for ${filePath}:`, error);
    return url;
  }
};

const processVideoProps = async (props: any) => {
  const newProps = { ...props };

  if (newProps.audioTracks) {
    newProps.audioTracks = await Promise.all(
      newProps.audioTracks.map(async (track: any) => ({
        ...track,
        src: await toDataUri(track.src),
      }))
    );
  }

  if (newProps.scenes) {
    newProps.scenes = await Promise.all(
      newProps.scenes.map(async (scene: any) => ({
        ...scene,
        imageUrl: await toDataUri(scene.imageUrl),
      }))
    );
  }

  return newProps;
};

const RENDER_CONCURRENCY = Math.max(1, Math.ceil(os.cpus().length / 2));

export async function POST(req: NextRequest) {
  let tempOutput = "";
  try {
    const body = await req.json();
    let { videoProps } = body;

    if (!videoProps) {
      return NextResponse.json(
        { error: "Missing videoProps" },
        { status: 400 }
      );
    }

    videoProps = await processVideoProps(videoProps);

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

          let totalFrames = videoProps.durationInFrames || 1;

          await renderMedia({
            composition: {
              id: compositionId,
              props: videoProps,
              durationInFrames: videoProps.durationInFrames,
              fps: videoProps.fps,
              width: videoProps.width,
              height: videoProps.height,
            } as any,
            serveUrl: bundleLocation,
            codec: "h264",
            outputLocation: tempOutput,
            inputProps: videoProps,
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
            hardwareAcceleration: "if-possible",
          });

          sendEvent({ type: "progress", progress: 100, stage: "encoding" });

          // Ensure renders directory exists
          const rendersDir = path.join(process.cwd(), "public", "renders");
          if (!fs.existsSync(rendersDir)) {
            await fs.promises.mkdir(rendersDir, { recursive: true });
          }

          const fileName = `render-${Date.now()}.mp4`;
          const publicOutput = path.join(rendersDir, fileName);

          // Move temp file to public/renders
          await fs.promises.rename(tempOutput, publicOutput);

          // Return URL relative to public
          const videoUrl = `/renders/${fileName}`;

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
