import { createHash } from "node:crypto";
import path from "node:path";
import {
  ALL_FORMATS,
  AudioBufferSource,
  AudioSampleSink,
  FilePathSource,
  FilePathTarget,
  Input,
  Mp3OutputFormat,
  Output,
  QUALITY_HIGH,
} from "mediabunny";

export async function getAudioDuration(filePath: string): Promise<number> {
  const input = new Input({
    source: new FilePathSource(filePath),
    formats: ALL_FORMATS,
  });
  const duration = await input.computeDuration();
  input.dispose();
  return Math.round(duration * 1000);
}

export async function concatenateAudio(
  files: string[],
  outputPath: string,
): Promise<string> {
  const output = new Output({
    format: new Mp3OutputFormat(),
    target: new FilePathTarget(outputPath),
  });

  const audioSource = new AudioBufferSource({
    codec: "mp3",
    bitrate: QUALITY_HIGH,
  });

  output.addAudioTrack(audioSource);
  await output.start();

  for (const file of files) {
    const input = new Input({
      source: new FilePathSource(file),
      formats: ALL_FORMATS,
    });

    const audioTrack = await input.getPrimaryAudioTrack();
    if (!audioTrack) {
      input.dispose();
      continue;
    }

    const sink = new AudioSampleSink(audioTrack);
    for await (const sample of sink.samples()) {
      const audioBuffer = sample.toAudioBuffer();
      await audioSource.add(audioBuffer);
      sample.close();
    }

    sink.close();
    input.dispose();
  }

  await output.finalize();
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
