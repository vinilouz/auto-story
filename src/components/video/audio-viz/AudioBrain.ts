import { useWindowedAudioData, visualizeAudio } from "@remotion/media-utils";
import { useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  type AudioAnalysisResult,
  computeAudioAnalysis,
} from "@/lib/audio/analysis";
import type { AudioTrackConfig } from "@/lib/video/types";

const FFT_SIZE = 256;
const OUTPUT_BARS = 64;

export interface AudioBrainData {
  frequencyData: number[];
  analysis: AudioAnalysisResult;
}

export function useAudioBrain(
  audioTracks: AudioTrackConfig[],
): AudioBrainData | null {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const smoothedRef = useRef<number[]>(new Array(OUTPUT_BARS).fill(0));
  const cooldownRef = useRef(0);

  const track = audioTracks[0];
  const src = track?.src ?? "";
  const localFrame = track ? frame - track.startFrame : 0;

  const { audioData, dataOffsetInSeconds } = useWindowedAudioData({
    src,
    frame: localFrame,
    fps,
    windowInSeconds: 10,
  });

  if (!track || !audioData) return null;

  const rawFrequencies = visualizeAudio({
    fps,
    frame: localFrame,
    audioData,
    numberOfSamples: FFT_SIZE,
    optimizeFor: "speed",
    dataOffsetInSeconds,
  });

  const analysis = computeAudioAnalysis(
    rawFrequencies,
    OUTPUT_BARS,
    smoothedRef.current,
    cooldownRef.current,
    fps,
  );

  smoothedRef.current = analysis.smoothedFrequencies;
  cooldownRef.current = analysis.newCooldown;

  return {
    frequencyData: analysis.smoothedFrequencies,
    analysis,
  };
}
