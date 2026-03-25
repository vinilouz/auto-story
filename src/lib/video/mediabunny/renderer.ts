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
import type { RemotionVideoProps } from "../types";
import { renderCaptions } from "./captions";
import { findActiveScene, renderScene } from "./scene";

export async function renderWithMediabunny(
  props: RemotionVideoProps,
  outputPath: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const canvas = new OffscreenCanvas(props.width, props.height);
  const ctx = canvas.getContext("2d")!;

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

  for (let frame = 0; frame < props.durationInFrames; frame++) {
    const currentMs = (frame / props.fps) * 1000;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, props.width, props.height);

    const scene = findActiveScene(props.scenes, frame);
    if (scene) {
      await renderScene(ctx, scene, frame);
    }

    if (props.captions?.length) {
      renderCaptions(ctx, props.captions, currentMs);
    }

    onProgress?.(frame / props.durationInFrames);
  }

  for (const track of props.audioTracks) {
    const input = new Input({
      source: new FilePathSource(track.src),
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
