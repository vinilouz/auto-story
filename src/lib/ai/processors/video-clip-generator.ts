import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { execute } from "@/lib/ai/providers";
import { type BatchResult, executeBatch } from "@/lib/ai/queue";
import type { VideoResponse } from "@/lib/ai/registry";
import { createLogger } from "@/lib/logger";
import { StorageService } from "@/lib/storage";
import { getProjectDirName } from "@/lib/utils";

const log = createLogger("video-clip");

export interface VideoClipRequest {
  prompt: string;
  referenceImage?: string;
  duration?: number;
}

async function resolveImage(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:")
  )
    return url;
  if (url.startsWith("/")) {
    try {
      const buf = await fsp.readFile(path.join(process.cwd(), "public", url));
      const ext = path.extname(url).replace(".", "");
      return `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${buf.toString("base64")}`;
    } catch {
      return undefined;
    }
  }
  return url;
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
    fs.writeFileSync(filepath, Buffer.from(await res.arrayBuffer()));
  }

  return filename;
}

export async function generateAndSaveVideoClip(
  req: VideoClipRequest,
  projectId: string,
  projectName: string,
  segmentIndex = 0,
): Promise<string> {
  const referenceImage = await resolveImage(req.referenceImage);
  const { videoUrl } = await execute("generateVideo", {
    prompt: req.prompt,
    referenceImage,
    duration: req.duration,
  });

  const dir = getProjectDirName(projectId, projectName);
  const pubDir = path.join(process.cwd(), "public", "projects", dir, "clips");
  const filename = await saveClip(videoUrl, pubDir, segmentIndex);
  const publicPath = `/projects/${dir}/clips/${filename}`;

  // Salva imediatamente no config.json — não espera o cliente
  await StorageService.patchSegmentClip(
    projectId,
    projectName,
    segmentIndex,
    publicPath,
  );

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
  projectName: string,
  onResult?: (result: BatchClipResult) => void,
): Promise<BatchClipResult[]> {
  // Resolve imagens de referência antes de enviar para a queue
  const resolved = await Promise.all(
    requests.map(async (r) => ({
      prompt: r.prompt,
      referenceImage: await resolveImage(r.referenceImage),
      duration: r.duration,
    })),
  );

  const dir = getProjectDirName(projectId, projectName);
  const pubDir = path.join(process.cwd(), "public", "projects", dir, "clips");

  const clipResults: BatchClipResult[] = [];
  const savePromises: Promise<void>[] = [];

  const handleResult = async (br: BatchResult<VideoResponse>) => {
    const segmentIndex = requests[br.id].index; // índice real do segmento

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
      // Nome: clip-1.mp4, clip-2.mp4 ... (usa segmentIndex, não br.id)
      const filename = await saveClip(br.data.videoUrl, pubDir, segmentIndex);
      const publicPath = `/projects/${dir}/clips/${filename}`;

      // ⚡ Salva no config.json IMEDIATAMENTE — antes de responder ao cliente
      // Se a conexão SSE cair depois disso, o clip já está persistido
      await StorageService.patchSegmentClip(
        projectId,
        projectName,
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
