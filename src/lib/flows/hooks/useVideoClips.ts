import { useState } from "react";
import { notify } from "@/lib/utils/notify";
import type { Segment } from "../types";

export function useVideoClips() {
  const [clipStatuses, setClipStatuses] = useState<
    Map<number, "generating" | "completed" | "error">
  >(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const generateAll = async (
    segments: Segment[],
    setSegments: React.Dispatch<React.SetStateAction<Segment[]>>,
    opts: {
      projectId?: string | null;
      clipDuration?: number;
      onClipCompleted?: (newSegments: Segment[]) => Promise<void>;
    },
  ) => {
    setIsLoading(true);

    const clips = segments
      .map((seg, i) => ({
        index: i,
        prompt: seg.imagePrompt!,
        referenceImage: seg.imagePath,
        duration: opts.clipDuration,
      }))
      .filter((c) => c.prompt && !segments[c.index].videoClipUrl);

    if (!clips.length) {
      setIsLoading(false);
      return;
    }

    console.log(`[video] Batch: ${clips.length} clips`);
    clips.forEach((c) =>
      setClipStatuses((p) => new Map(p).set(c.index, "generating")),
    );

    try {
      const res = await fetch("/api/generate/video-clips-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clips,
          projectId: opts.projectId,
        }),
      });
      if (!res.ok) throw new Error("Batch clip generation failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let okCount = 0;
      let failCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "result") {
            const status = data.status === "success" ? "completed" : "error";
            setClipStatuses((p) => new Map(p).set(data.index, status));

            if (data.status === "success") okCount++;
            else failCount++;

            if (data.status === "success" && data.videoUrl) {
              let updatedSegments: Segment[] = [];
              setSegments((prev) => {
                updatedSegments = prev.map((s, j) =>
                  j === data.index ? { ...s, videoClipUrl: data.videoUrl } : s,
                );
                return updatedSegments;
              });
              if (opts.onClipCompleted && updatedSegments.length) {
                await opts.onClipCompleted(updatedSegments);
              }
            }
          } else if (data.type === "done") {
            console.log(
              `[video] Batch done: ${data.success} success, ${data.failed} failed`,
            );
            notify("Video Clips Ready", `${data.success} clips generated`);
          } else if (data.type === "error") {
            console.error("[video] Batch error:", data.error);
          }
        }
      }
    } catch (e) {
      console.error("[video] Batch request failed", e);
      clips.forEach((c) =>
        setClipStatuses((p) => new Map(p).set(c.index, "error")),
      );
    }

    setIsLoading(false);
  };

  const regenerateClip = async (
    index: number,
    segments: Segment[],
    setSegments: React.Dispatch<React.SetStateAction<Segment[]>>,
    opts: {
      projectId?: string | null;
      clipDuration?: number;
      onClipCompleted?: (newSegments: Segment[]) => Promise<void>;
    },
  ) => {
    const seg = segments[index];
    if (!seg?.imagePrompt) return;

    setClipStatuses((p) => new Map(p).set(index, "generating"));

    try {
      const res = await fetch("/api/generate/video-clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: seg.imagePrompt,
          referenceImage: seg.imagePath,
          duration: opts.clipDuration,
          projectId: opts.projectId,
          index: index,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      let updatedSegments: Segment[] = [];
      setSegments((prev) => {
        updatedSegments = prev.map((s, j) =>
          j === index ? { ...s, videoClipUrl: data.videoUrl } : s,
        );
        return updatedSegments;
      });
      setClipStatuses((p) => new Map(p).set(index, "completed"));

      if (opts.onClipCompleted) {
        await opts.onClipCompleted(updatedSegments);
      }
    } catch {
      setClipStatuses((p) => new Map(p).set(index, "error"));
    }
  };

  return { clipStatuses, generateAll, regenerateClip, isLoading };
}
