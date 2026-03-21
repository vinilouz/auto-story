import { useState } from "react";
import { type AlignmentMode, alignVideoProps } from "@/lib/video/aligner";
import type { RemotionVideoProps } from "@/lib/video/types";
import type { AudioBatch, CaptionStyle, TranscriptionResult, TranscriptionWord } from "../types";

export function useVideo() {
  const [videoProps, setVideoProps] = useState<RemotionVideoProps | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<{
    progress: number;
    stage: string;
    renderedFrames?: number;
    totalFrames?: number;
  } | null>(null);

  const generate = async (
    segments: { id: string; text: string; imageUrl: string; videoClipUrl?: string }[],
    audioBatches: AudioBatch[],
    transcriptionResults: TranscriptionResult[],
    alignmentMode: AlignmentMode = "video",
    videoVolume: number = 0.1,
  ) => {
    const completed = audioBatches.filter(
      (b) => b.status === "completed" && b.url,
    );
    const audioUrls = completed.map((b) => b.url!);
    const tMap = new Map(
      transcriptionResults
        .filter((r) => r.status === "completed" && r.data)
        .map((r) => [r.url, r.data]),
    );
    const validUrls = audioUrls.filter((u) => tMap.has(u));
    if (!validUrls.length) throw new Error("No valid transcriptions");

    setIsGenerating(true);
    try {
      const transcriptions = validUrls.map((u) => {
        const raw = tMap.get(u)!;
        const words: TranscriptionWord[] = Array.isArray(raw)
          ? raw
          : (raw as any).words;
        return {
          words: words.map((w) => ({
            text: w.text,
            startMs: w.startMs,
            endMs: w.endMs,
          })),
        };
      });

      const audioDurations = await Promise.all(
        validUrls.map(
          (url) =>
            new Promise<number>((resolve, reject) => {
              const timeout = setTimeout(
                () => reject(new Error(`Audio metadata timeout: ${url}`)),
                8000,
              );
              const el = new Audio(url);
              el.onloadedmetadata = () => { clearTimeout(timeout); resolve(el.duration); };
              el.onerror = () => { clearTimeout(timeout); reject(new Error(`Audio load error: ${url}`)); };
            }),
        ),
      );

      const videoDurations = await Promise.all(
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
                () => reject(new Error(`Video load error: ${seg.videoClipUrl}`)),
                8000,
              );
              const el = document.createElement("video");
              el.preload = "metadata";
              el.onloadedmetadata = () => { clearTimeout(timeout); resolve(el.duration); };
              el.onerror = () => {
                clearTimeout(timeout);
                reject(new Error(`Video load error: ${seg.videoClipUrl}`));
              };
              el.src = seg.videoClipUrl;
            }),
        ),
      );

      const props = alignVideoProps(
        segments,
        transcriptions,
        validUrls,
        audioDurations,
        videoDurations,
        undefined,
        alignmentMode,
        videoVolume,
      );

      if (props.durationInFrames <= 0) throw new Error("Zero duration after alignment");
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
    projectName?: string,
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
          projectName,
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));
          if (data.type === "progress") setRenderProgress(data);
          else if (data.type === "complete") {
            const link = document.createElement("a");
            link.href = data.videoUrl;
            link.download = `video-${Date.now()}.mp4`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
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
