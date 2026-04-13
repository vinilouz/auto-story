import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import ffmpeg from "ffmpeg-static";
import { StorageService } from "@/lib/storage";
import { createLogger } from "@/lib/logger";

const log = createLogger("media-saver");
const execFileAsync = promisify(execFile);

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

export async function normalizeLoudness(inputPath: string, outputPath: string): Promise<void> {
  if (!ffmpeg || !existsSync(ffmpeg)) return;

  const af =
    "compand=attacks=0:decays=0.21:soft-knee=0.01:gain=0" +
    ":points=-80/-80|-40/-40|-20/-39.8|0/-39.6" +
    ":delay=0.001";

  await execFileAsync(ffmpeg, [
    "-y",
    "-i", inputPath,
    "-af", af,
    "-c:v", "copy",
    outputPath,
  ]);
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

  const rawName = "background-raw.mp4";
  const rawPath = path.join(dir, rawName);
  await writeToFile(musicUrlOrBase64, rawPath);

  const compressedName = "background.mp4";
  const compressedPath = path.join(dir, compressedName);

  try {
    await normalizeLoudness(rawPath, compressedPath);
  } catch (e) {
    log.warn("Loudness normalization failed, using raw file", e);
  }

  const useCompressed = existsSync(compressedPath);
  const finalName = useCompressed ? compressedName : rawName;
  const publicPath = `/projects/${projectId}/music/${finalName}`;
  await StorageService.patchMusic(projectId, publicPath);
  log.success(`Music saved: ${publicPath}${useCompressed ? " (compressed)" : " (raw fallback)"}`);
  return publicPath;
}
