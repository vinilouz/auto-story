import { useState } from "react";
import { notify } from "@/lib/utils/notify";
import { type AlignmentMode, alignVideoProps } from "@/lib/video/aligner";
import type { RemotionVideoProps } from "@/lib/video/types";
import { getTranscription } from "@/lib/utils/text";
import type {
  AudioBatch,
  CaptionStyle,
  TranscriptionResult,
  TranscriptionWord,
} from "../types";

const MEDIA_METADATA_TIMEOUT_MS = 8000;

export function useVideo() {
  const [videoProps, setVideoProps] = useState<RemotionVideoProps | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<{
    progress: number;
    stage: string;
    renderedFrames?: number;
    totalFrames?: number;
    remainingSeconds?: number;
  } | null>(null);

  const generate = async (
    segments: {
      id: string;
      text: string;
      imageUrl: string;
      videoClipUrl?: string;
    }[],
    audioBatches: AudioBatch[],
    transcriptionResult: TranscriptionResult | null,
    alignmentMode: AlignmentMode = "video",
    videoVolume: number = 0.1,
    musicUrl?: string,
    musicVolume: number = 0.3,
  ) => {
    const completed = audioBatches.filter(
      (b) => b.status === "completed" && b.url,
    );
    const audioUrls = completed.map((b) => b.url!);

    if (
      !transcriptionResult?.status ||
      transcriptionResult.status !== "completed" ||
      !transcriptionResult.transcriptionUrl
    ) {
      throw new Error("No valid transcription");
    }

    const words = await getTranscription(transcriptionResult.transcriptionUrl);

    setIsGenerating(true);
    try {
      const transcriptions = [
        {
          words: words.map((w) => ({
            text: w.text,
            startMs: w.startMs,
            endMs: w.endMs,
          })),
        },
      ];

      const validUrls = [transcriptionResult.url];

      const audioDurations = await Promise.all(
        validUrls.map(
          (url) =>
            new Promise<number>((resolve, reject) => {
              const timeout = setTimeout(
                () => reject(new Error(`Audio metadata timeout: ${url}`)),
                MEDIA_METADATA_TIMEOUT_MS,
              );
              const el = new Audio(url);
              el.onloadedmetadata = () => {
                clearTimeout(timeout);
                resolve(el.duration);
              };
              el.onerror = () => {
                clearTimeout(timeout);
                reject(new Error(`Audio load error: ${url}`));
              };
            }),
        ),
      );

      // In hybrid mode: validate clips — strip videoClipUrl for corrupt/inaccessible files
      const validatedSegments =
        alignmentMode === "hybrid"
          ? await Promise.all(
              segments.map(async (seg) => {
                if (!seg.videoClipUrl) return seg;
                try {
                  await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(
                      () => reject(new Error("timeout")),
                      MEDIA_METADATA_TIMEOUT_MS,
                    );
                    const el = document.createElement("video");
                    el.preload = "metadata";
                    el.onloadedmetadata = () => {
                      clearTimeout(timeout);
                      resolve();
                    };
                    el.onerror = () => {
                      clearTimeout(timeout);
                      reject(new Error("load failed"));
                    };
                    el.src = seg.videoClipUrl!;
                  });
                  return seg;
                } catch {
                  return { ...seg, videoClipUrl: undefined };
                }
              }),
            )
          : segments;

      const videoDurations =
        alignmentMode === "hybrid"
          ? validatedSegments.map(() => 0)
          : await Promise.all(
              segments.map(
                (seg, i) =>
                  new Promise<number>((resolve, reject) => {
                    if (!seg.videoClipUrl) {
                      if (alignmentMode === "video") {
                        return reject(
                          new Error(
                            `[generate] Segment ${i} ("${seg.id}") has no videoClipUrl but alignmentMode is "video".`,
                          ),
                        );
                      }
                      return resolve(0);
                    }
                    const timeout = setTimeout(
                      () =>
                        reject(
                          new Error(
                            `Video load error: ${seg.videoClipUrl}`,
                          ),
                        ),
                      MEDIA_METADATA_TIMEOUT_MS,
                    );
                    const el = document.createElement("video");
                    el.preload = "metadata";
                    el.onloadedmetadata = () => {
                      clearTimeout(timeout);
                      resolve(el.duration);
                    };
                    el.onerror = () => {
                      clearTimeout(timeout);
                      reject(
                        new Error(`Video load error: ${seg.videoClipUrl}`),
                      );
                    };
                    el.src = seg.videoClipUrl;
                  }),
              ),
            );

      const props = alignVideoProps(
        validatedSegments,
        transcriptions,
        validUrls,
        audioDurations,
        videoDurations,
        undefined,
        alignmentMode,
        videoVolume,
        8,
      );

      if (props.durationInFrames <= 0)
        throw new Error("Zero duration after alignment");

      if (musicUrl) {
        props.musicSrc = musicUrl;
        props.musicVolume = musicVolume;
      }

      setVideoProps(props);
      return props;
    } finally {
      setIsGenerating(false);
    }
  };

  const render = async (
    props: RemotionVideoProps,
    captionStyle: CaptionStyle,
    projectId?: string,
  ) => {
    setIsRendering(true);
    setRenderProgress({ progress: 0, stage: "bundling" });
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoProps: { ...props, captionStyle },
          projectId,
        }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({}))).error || "Render failed",
        );

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let buffer = "";
      let renderStartMs: number | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));
          if (data.type === "progress") {
            if (data.stage === "rendering" && data.renderStartMs) {
              renderStartMs = data.renderStartMs;
            }
            if (renderStartMs && data.stage === "rendering" && data.progress > 0) {
              const elapsedMs = Date.now() - renderStartMs;
              const totalEstimatedMs = elapsedMs / (data.progress / 100);
              data.remainingSeconds = Math.round((totalEstimatedMs - elapsedMs) / 1000);
            }
            setRenderProgress(data);
          }
          else if (data.type === "complete") {
            const link = document.createElement("a");
            link.href = data.videoUrl;
            link.download = `video-${Date.now()}.mp4`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            notify("Video Ready", "Download started");
          } else if (data.type === "error") throw new Error(data.error);
        }
      }
    } finally {
      setIsRendering(false);
      setRenderProgress(null);
    }
  };

  return {
    videoProps,
    setVideoProps,
    generate,
    render,
    isGenerating,
    isRendering,
    renderProgress,
  };
}
