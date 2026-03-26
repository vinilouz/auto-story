import { createHash } from "node:crypto";
import path from "node:path";
import { ALL_FORMATS, FilePathSource, Input } from "mediabunny";

export async function getAudioDuration(filePath: string): Promise<number> {
  const input = new Input({
    source: new FilePathSource(filePath),
    formats: ALL_FORMATS,
  });
  const duration = await input.computeDuration();
  input.dispose();
  return Math.round(duration * 1000);
}

import fs from "node:fs/promises";

export async function concatenateAudio(
  files: string[],
  outputPath: string,
): Promise<string> {
  if (files.length === 0) return outputPath;
  const buffers = await Promise.all(files.map((f) => fs.readFile(f)));
  await fs.writeFile(outputPath, Buffer.concat(buffers));
  return outputPath;
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
