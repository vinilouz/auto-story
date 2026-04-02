import { execute } from "@/lib/ai/providers";
import { type BatchResult, executeBatch } from "@/lib/ai/queue";
import type { VideoResponse } from "@/lib/ai/registry";
import { createLogger } from "@/lib/logger";
import { resolveImage } from "@/lib/utils/resolve-image";

const log = createLogger("video-clip");

export interface VideoClipRequest {
  prompt: string;
  referenceImage?: string;
  duration?: number;
}

export async function generateVideoClip(
  req: VideoClipRequest,
): Promise<{ videoUrl: string }> {
  const resolvedRef = await resolveImage(req.referenceImage);
  return execute("generateVideo", {
    prompt: req.prompt,
    referenceImage: resolvedRef,
    duration: req.duration,
  });
}

export interface BatchClipRequest {
  index: number;
  prompt: string;
  referenceImage?: string;
  duration?: number;
}

export interface BatchClipResult {
  index: number;
  status: "success" | "error";
  videoUrl?: string;
  error?: string;
}

export async function generateVideoClipBatch(
  requests: BatchClipRequest[],
  onResult?: (result: BatchClipResult) => void,
): Promise<BatchClipResult[]> {
  const resolved = await Promise.all(
    requests.map(async (r) => ({
      prompt: r.prompt,
      referenceImage: await resolveImage(r.referenceImage),
      duration: r.duration,
    })),
  );

  const clipResults: BatchClipResult[] = [];

  await executeBatch("generateVideo", resolved, {
    maxRetries: 3,
    onResult: (br: BatchResult<VideoResponse>) => {
      const segmentIndex = requests[br.id].index;

      if (br.status === "error" || !br.data?.videoUrl) {
        const r: BatchClipResult = {
          index: segmentIndex,
          status: "error",
          error: br.error || "No video URL",
        };
        clipResults.push(r);
        onResult?.(r);
        return;
      }

      log.success(`Clip #${segmentIndex + 1} generated`);
      const r: BatchClipResult = {
        index: segmentIndex,
        status: "success",
        videoUrl: br.data.videoUrl,
      };
      clipResults.push(r);
      onResult?.(r);
    },
  });

  return clipResults;
}
