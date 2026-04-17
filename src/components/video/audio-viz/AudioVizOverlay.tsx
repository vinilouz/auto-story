import { ThreeCanvas } from "@remotion/three";
import type React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import type {
  AudioAnalysisData,
  AudioTrackConfig,
  AudioVizConfig,
} from "@/lib/video/types";
import { useAudioBrain } from "./AudioBrain";
import { AudioParticles } from "./AudioParticles";
import { PostProcessingStack } from "./PostProcessingStack";
import { ProSpectrum } from "./ProSpectrum";
import { WaveformCanvas } from "./WaveformCanvas";

interface AudioVizOverlayProps {
  audioTracks: AudioTrackConfig[];
  config: AudioVizConfig;
}

export const AudioVizOverlay: React.FC<AudioVizOverlayProps> = ({
  audioTracks,
  config,
}) => {
  const { width, height } = useVideoConfig();
  const brain = useAudioBrain(audioTracks);

  if (!brain) return null;

  const analysisData: AudioAnalysisData = {
    bands: brain.analysis.bands,
    beat: brain.analysis.beat,
    smoothedFrequencies: brain.analysis.smoothedFrequencies,
  };

  const has = (name: AudioVizConfig["effects"][number]) =>
    config.effects.includes(name);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <ThreeCanvas
        width={width}
        height={height}
        style={{ position: "absolute", top: 0, left: 0 }}
        camera={{ position: [0, 0, 5], fov: 75 }}
        gl={{ alpha: true }}
      >
        {has("pro-spectrum") && (
          <ProSpectrum data={analysisData} config={config} />
        )}
        {has("audio-particles") && (
          <AudioParticles data={analysisData} config={config} />
        )}
        {has("post-processing") && (
          <PostProcessingStack data={analysisData} config={config} />
        )}
      </ThreeCanvas>
      {has("smooth-waveform") && (
        <WaveformCanvas
          data={analysisData}
          config={config}
          width={width}
          height={height}
        />
      )}
    </AbsoluteFill>
  );
};
