import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { StorageService } from "@/lib/storage";
import { createLogger } from "@/lib/logger";

const log = createLogger("media-saver");

const PUBLIC_DIR = path.join(process.cwd(), "public", "projects");

async function writeToFile(urlOrBase64: string, destPath: string): Promise<void> {
  if (urlOrBase64.startsWith("data:")) {
    const [, base64Data] = urlOrBase64.split(",");
    writeFileSync(destPath, Buffer.from(base64Data, "base64"));
  } else {
    const res = await fetch(urlOrBase64);
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    writeFileSync(destPath, Buffer.from(await res.arrayBuffer()));
  }
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export async function saveAudio(
  audioBuffer: ArrayBuffer,
  projectId: string,
  batchIndex: number,
): Promise<string> {
  const dir = path.join(PUBLIC_DIR, projectId, "audios");
  ensureDir(dir);

  const filename = `audio_${batchIndex + 1}.mp3`;
  writeFileSync(path.join(dir, filename), Buffer.from(audioBuffer));
  const publicPath = `/projects/${projectId}/audios/${filename}`;
  log.success(`Audio saved: ${publicPath}`);
  return publicPath;
}

export async function saveVideoClip(
  videoUrlOrBase64: string,
  projectId: string,
  segmentIndex: number,
): Promise<string> {
  const dir = path.join(PUBLIC_DIR, projectId, "clips");
  ensureDir(dir);

  const filename = `clip-${segmentIndex + 1}.mp4`;
  await writeToFile(videoUrlOrBase64, path.join(dir, filename));
  const publicPath = `/projects/${projectId}/clips/${filename}`;

  await StorageService.patchSegmentClip(projectId, segmentIndex, publicPath);
  log.success(`Video clip saved: ${publicPath}`);
  return publicPath;
}

export async function saveMusic(
  musicUrlOrBase64: string,
  projectId: string,
): Promise<string> {
  const dir = path.join(PUBLIC_DIR, projectId, "music");
  ensureDir(dir);

  const filename = "background.mp4";
  await writeToFile(musicUrlOrBase64, path.join(dir, filename));
  const publicPath = `/projects/${projectId}/music/${filename}`;

  await StorageService.patchMusic(projectId, publicPath);
  log.success(`Music saved: ${publicPath}`);
  return publicPath;
}
