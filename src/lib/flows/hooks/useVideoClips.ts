import { useState } from "react";
import { notify } from "@/lib/utils/notify";
import type { Segment } from "../types";

const CONCURRENCY = 10;

export function useVideoClips() {
  const [clipStatuses, setClipStatuses] = useState<
    Map<number, "generating" | "completed" | "error">
  >(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const generateClip = async (
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
          index,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      let updatedSegments: Segment[] = [];
      setSegments((prev) => {
        updatedSegments = prev.map((s, j) =>
          j === index ? { ...s, videoClipUrl: data.videoUrl } : s,
        );
        return updatedSegments;
      });
      setClipStatuses((p) => new Map(p).set(index, "completed"));

      if (opts.onClipCompleted && updatedSegments.length) {
        await opts.onClipCompleted(updatedSegments);
      }
    } catch {
      setClipStatuses((p) => new Map(p).set(index, "error"));
    }
  };

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

    const indices = segments
      .map((seg, i) => ({
        index: i,
        hasPrompt: !!seg.imagePrompt,
        hasClip: !!seg.videoClipUrl,
      }))
      .filter((c) => c.hasPrompt && !c.hasClip)
      .map((c) => c.index);

    if (!indices.length) {
      setIsLoading(false);
      return;
    }

    console.log(
      `[video] Pool: ${indices.length} clips, ${CONCURRENCY} workers`,
    );

    let next = 0;
    let okCount = 0;
    let failCount = 0;

    const worker = async () => {
      while (next < indices.length) {
        const idx = indices[next++];
        await generateClip(idx, segments, setSegments, opts);

        const st = clipStatuses.get(idx);
        if (st === "completed") okCount++;
        else failCount++;
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, indices.length) }, () =>
        worker(),
      ),
    );

    console.log(`[video] Pool done: ${okCount} success, ${failCount} failed`);
    notify("Video Clips Ready", `${okCount} clips generated`);
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
    await generateClip(index, segments, setSegments, opts);
  };

  return { clipStatuses, generateAll, regenerateClip, isLoading };
}
