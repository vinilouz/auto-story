import fs from "fs";
import path from "path";
import { execute } from "@/lib/ai/providers";
import { type BatchResult, executeBatch } from "@/lib/ai/queue";
import type { VideoResponse } from "@/lib/ai/registry";
import { createLogger } from "@/lib/logger";
import { StorageService } from "@/lib/storage";
import { resolveImage } from "@/lib/utils/resolve-image";

const log = createLogger("video-clip");

export interface VideoClipRequest {
  prompt: string;
  referenceImage?: string;
  duration?: number;
}

/**
 * Salva o vídeo no disco com nome baseado no índice do segmento.
 * Nome: clip-1.mp4, clip-2.mp4, etc. (1-indexed, legível e rastreável)
 */
async function saveClip(
  videoUrl: string,
  pubDir: string,
  segmentIndex: number,
): Promise<string> {
  if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });

  const filename = `clip-${segmentIndex + 1}.mp4`;
  const filepath = path.join(pubDir, filename);

  if (videoUrl.startsWith("data:")) {
    const [, base64Data] = videoUrl.split(",");
    fs.writeFileSync(filepath, Buffer.from(base64Data, "base64"));
  } else {
    const res = await fetch(videoUrl);
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (
      !ct.startsWith("video/") &&
      !ct.startsWith("application/octet-stream")
    ) {
      throw new Error(`Invalid content-type: ${ct} (expected video)`);
    }
    fs.writeFileSync(filepath, Buffer.from(await res.arrayBuffer()));
  }

  return filename;
}

export async function generateAndSaveVideoClip(
  req: VideoClipRequest,
  projectId: string,
  segmentIndex = 0,
): Promise<string> {
  const resolvedRef = await resolveImage(req.referenceImage);
  const { videoUrl } = await execute("generateVideo", {
    prompt: req.prompt,
    referenceImage: resolvedRef,
    duration: req.duration,
  });

  const pubDir = path.join(
    process.cwd(),
    "public",
    "projects",
    projectId,
    "clips",
  );
  const filename = await saveClip(videoUrl, pubDir, segmentIndex);
  const publicPath = `/projects/${projectId}/clips/${filename}`;

  await StorageService.patchSegmentClip(projectId, segmentIndex, publicPath);

  log.success(`Saved clip: ${publicPath}`);
  return publicPath;
}

export interface BatchClipRequest {
  index: number; // índice do segmento — usado no nome do arquivo e no config patch
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

export async function generateAndSaveVideoClipBatch(
  requests: BatchClipRequest[],
  projectId: string,
  onResult?: (result: BatchClipResult) => void,
): Promise<BatchClipResult[]> {
  const resolved = await Promise.all(
    requests.map(async (r) => ({
      prompt: r.prompt,
      referenceImage: await resolveImage(r.referenceImage),
      duration: r.duration,
    })),
  );

  const pubDir = path.join(
    process.cwd(),
    "public",
    "projects",
    projectId,
    "clips",
  );

  const clipResults: BatchClipResult[] = [];
  const savePromises: Promise<void>[] = [];

  const handleResult = async (br: BatchResult<VideoResponse>) => {
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

    try {
      const filename = await saveClip(br.data.videoUrl, pubDir, segmentIndex);
      const publicPath = `/projects/${projectId}/clips/${filename}`;

      await StorageService.patchSegmentClip(
        projectId,
        segmentIndex,
        publicPath,
      );

      log.success(`Saved clip #${segmentIndex + 1}: ${publicPath}`);
      const r: BatchClipResult = {
        index: segmentIndex,
        status: "success",
        videoUrl: publicPath,
      };
      clipResults.push(r);
      onResult?.(r);
    } catch (e: any) {
      log.error(`Failed to save clip #${segmentIndex + 1}`, e);
      const r: BatchClipResult = {
        index: segmentIndex,
        status: "error",
        error: e.message,
      };
      clipResults.push(r);
      onResult?.(r);
    }
  };

  await executeBatch("generateVideo", resolved, {
    maxRetries: 3,
    onResult: (br) => {
      savePromises.push(handleResult(br));
    },
  });

  await Promise.all(savePromises);

  return clipResults;
}
