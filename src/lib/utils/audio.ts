import { spawn } from "child_process";
import ffmpeg from "ffmpeg-static";
import { createHash } from "crypto";
import path from "path";
import fs from "fs";

export async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = require("ffprobe-static");
    const proc = spawn(ffprobe.path, [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    let output = "";
    proc.stdout.on("data", (data: Buffer) => (output += data.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve(Math.round(parseFloat(output) * 1000));
      else reject(new Error("Failed to get audio duration"));
    });
  });
}

export async function concatenateAudio(
  files: string[],
  outputPath: string,
): Promise<string> {
  const listContent = files.map((f) => `file '${f}'`).join("\n");
  const listPath = outputPath.replace(".mp3", "_list.txt");
  fs.writeFileSync(listPath, listContent);

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg!, [
      "-f", "concat",
      "-safe", "0",
      "-i", listPath,
      "-c", "copy",
      "-y",
      outputPath,
    ]);
    proc.on("close", (code) => {
      fs.unlinkSync(listPath);
      if (code === 0) resolve(outputPath);
      else reject(new Error("Failed to concatenate audio"));
    });
  });
}

export function generateConcatenationHash(urls: string[]): string {
  const content = urls.sort().join("|");
  return createHash("md5").update(content).digest("hex").substring(0, 12);
}

export function resolveAudioPath(url: string): string {
  const publicDir = path.join(process.cwd(), "public");
  return path.join(publicDir, url);
}

export function getConcatenatedPath(projectDir: string, hash: string): string {
  return path.join(projectDir, "audios", `concatenated_${hash}.mp3`);
}

export function getConcatenatedUrl(projectDir: string, hash: string): string {
  return `/projects/${path.basename(projectDir)}/audios/concatenated_${hash}.mp3`;
}

export function ensureDirectoryExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
