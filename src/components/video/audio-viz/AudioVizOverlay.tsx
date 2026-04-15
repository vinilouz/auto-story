import { useWindowedAudioData, visualizeAudio } from "@remotion/media-utils";
import { ThreeCanvas } from "@remotion/three";
import type React from "react";
import { useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { computeAudioAnalysis } from "@/lib/audio/analysis";
import type {
  AudioAnalysisData,
  AudioTrackConfig,
  AudioVizConfig,
} from "@/lib/video/types";
import { AudioParticles } from "./AudioParticles";
import { PostProcessingStack } from "./PostProcessingStack";
import { ProSpectrum } from "./ProSpectrum";
import { SmoothWaveform } from "./SmoothWaveform";

const FFT_SAMPLES = 512;
const OUTPUT_BARS = 64;

interface AudioVizOverlayProps {
  audioTracks: AudioTrackConfig[];
  config: AudioVizConfig;
}

export const AudioVizOverlay: React.FC<AudioVizOverlayProps> = ({
  audioTracks,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
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

  let analysisData: AudioAnalysisData | null = null;

  if (track && audioData) {
    const rawFrequencies = visualizeAudio({
      fps,
      frame: localFrame,
      audioData,
      numberOfSamples: FFT_SAMPLES,
      optimizeFor: "speed",
      dataOffsetInSeconds,
    });

    const result = computeAudioAnalysis(
      rawFrequencies,
      OUTPUT_BARS,
      smoothedRef.current,
      cooldownRef.current,
      fps,
    );

    smoothedRef.current = result.newSmoothed;
    cooldownRef.current = result.newCooldown;

    analysisData = {
      bands: result.bands,
      beat: result.beat,
      smoothedFrequencies: result.smoothedFrequencies,
      rmsEnergy: result.rmsEnergy,
    };
  }

  if (!analysisData) return null;

  const hasEffect = (name: AudioVizConfig["effects"][number]) =>
    config.effects.includes(name);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <ThreeCanvas
        width={width}
        height={height}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
        }}
        camera={{ position: [0, 0, 5], fov: 75 }}
        gl={{ alpha: true }}
      >
        {hasEffect("pro-spectrum") && (
          <ProSpectrum data={analysisData} config={config} />
        )}
        {hasEffect("audio-particles") && (
          <AudioParticles data={analysisData} config={config} />
        )}
        {hasEffect("smooth-waveform") && (
          <SmoothWaveform data={analysisData} config={config} />
        )}
        {hasEffect("post-processing") && (
          <PostProcessingStack data={analysisData} config={config} />
        )}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
