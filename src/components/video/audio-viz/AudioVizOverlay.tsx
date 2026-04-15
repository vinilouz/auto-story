import { useWindowedAudioData, visualizeAudio } from "@remotion/media-utils";
import type React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useRef } from "react";
import type {
  AudioFrequencyData,
  AudioTrackConfig,
  AudioVizConfig,
} from "@/lib/video/types";
import { AudioParticles } from "./AudioParticles";
import { SpectrumBars } from "./SpectrumBars";
import { VignetteGlow } from "./VignetteGlow";
import { WaveformRibbon } from "./WaveformRibbon";

const FFT_SAMPLES = 512;
const OUTPUT_BARS = 64;

function averageBand(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function buildLogEdges(count: number): number[] {
  const minFreq = 20;
  const maxFreq = 20000;
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  const edges: number[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const freq = Math.round(Math.pow(10, logMin + t * (logMax - logMin)));
    edges.push(freq);
  }
  return edges;
}

const LOG_EDGES = buildLogEdges(OUTPUT_BARS);

function fftBinIndex(freq: number, fftSize: number, sampleRate = 44100): number {
  return Math.round((freq / sampleRate) * fftSize);
}

function mapLogFrequencies(raw: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < OUTPUT_BARS; i++) {
    const loBin = fftBinIndex(LOG_EDGES[i], FFT_SAMPLES);
    const hiBin = fftBinIndex(LOG_EDGES[i + 1], FFT_SAMPLES);
    let sum = 0;
    let count = 0;
    for (let j = loBin; j < hiBin && j < raw.length; j++) {
      sum += raw[j];
      count++;
    }
    out.push(count > 0 ? sum / count : 0);
  }
  return out;
}

const SMOOTH_UP = 0.18;
const SMOOTH_DOWN = 0.08;

interface AudioVizOverlayProps {
  audioTracks: AudioTrackConfig[];
  config: AudioVizConfig;
}

export const AudioVizOverlay: React.FC<AudioVizOverlayProps> = ({
  audioTracks,
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const smoothedRef = useRef<number[]>(new Array(OUTPUT_BARS).fill(0));

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
    numberOfSamples: FFT_SAMPLES,
    optimizeFor: "speed",
    dataOffsetInSeconds,
  });

  const logBars = mapLogFrequencies(rawFrequencies);

  const smoothed = logBars.map((v, i) => {
    const prev = smoothedRef.current[i] ?? 0;
    const factor = v > prev ? SMOOTH_UP : SMOOTH_DOWN;
    const next = prev + (v - prev) * factor;
    smoothedRef.current[i] = next;
    return next;
  });

  const freqData: AudioFrequencyData = {
    bass: averageBand(smoothed.slice(0, 16)),
    mid: averageBand(smoothed.slice(16, 40)),
    treble: averageBand(smoothed.slice(40)),
    overall: averageBand(smoothed),
    frequencies: smoothed,
  };

  const hasEffect = (name: AudioVizConfig["effects"][number]) =>
    config.effects.includes(name);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {hasEffect("spectrum-bars") && (
        <SpectrumBars data={freqData} config={config} />
      )}
      {hasEffect("vignette-glow") && (
        <VignetteGlow data={freqData} config={config} />
      )}
      {hasEffect("particles") && (
        <AudioParticles data={freqData} config={config} />
      )}
      {hasEffect("waveform-ribbon") && (
        <WaveformRibbon data={freqData} config={config} />
      )}
    </AbsoluteFill>
  );
};
