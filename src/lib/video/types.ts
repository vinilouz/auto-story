export interface VideoTransition {
  type: "fade" | "slide" | "wipe" | "none";
  durationInFrames: number;
}

export type SceneEffect =
  | "zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right"
  | "static";

export interface SceneDebugInfo {
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  confidence?: number;
  naturalDurationSeconds?: number;
  playbackRate?: number;
  transitionFrames?: number;
}

export interface VideoScene {
  id: string;
  imageUrl: string;
  videoClipUrl?: string;
  startFrame: number;
  durationInFrames: number;
  effect: SceneEffect;
  playbackRate?: number;
  transition?: VideoTransition;
  textFragment?: string;
  debug?: SceneDebugInfo;
}

export interface AudioTrackConfig {
  src: string;
  startFrame: number;
  durationInFrames: number;
  volume?: number;
}

export interface Caption {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs?: number;
}

export interface CaptionStyle {
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  maxWordsPerLine: number;
  uppercase: boolean;
  highlightColor: string;
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontSize: 60,
  fontFamily: "TikTok Sans, sans-serif",
  fontWeight: 800,
  maxWordsPerLine: 3,
  uppercase: true,
  highlightColor: "#FFE81F",
};

import type { BeatResult, FrequencyBands } from "@/lib/audio/analysis";

/** Available audio visualization effects rendered via WebGL/Three.js */
export type AudioVizEffectType =
  | "pro-spectrum"
  | "audio-particles"
  | "smooth-waveform"
  | "post-processing"
  | "scene-modulation";

/** Professional spectrum bars using instanced meshes with rounded-top SDF shaders and mirror reflections */
export interface ProSpectrumConfig {
  barCount: number;
  cornerRadius: number;
  gap: number;
  maxHeight: number;
  reflectionOpacity: number;
  glowIntensity: number;
  position: "bottom" | "top" | "center";
}

/** Music-reactive particles in 3D simplex noise field with beat-triggered burst emissions */
export interface AudioParticlesConfig {
  count: number;
  noiseScale: number;
  trailLength: number;
  turbulence: number;
  baseSize: number;
  maxSize: number;
}

/** Smooth waveform via Catmull-Rom spline interpolation with variable-width Line2 */
export interface SmoothWaveformConfig {
  position: "center" | "bottom" | "top";
  splineTension: number;
  glowIntensity: number;
  thicknessScale: number;
  colorMapping: "frequency" | "amplitude" | "fixed";
}

/** GPU post-processing: bass-reactive bloom, beat-triggered chromatic aberration, bass-reactive vignette */
export interface PostProcessingConfig {
  bloomIntensity: number;
  bloomThreshold: number;
  chromaticOffset: number;
  vignetteDarkness: number;
}

/** Audio-driven scene zoom/pan modulation */
export interface SceneModulationConfig {
  zoomIntensity: number;
  panIntensity: number;
}

/** Top-level audio visualization configuration. `effects` selects which effects render; per-effect configs control parameters. */
export interface AudioVizConfig {
  enabled: boolean;
  effects: AudioVizEffectType[];
  opacity: number;
  color: string;
  proSpectrum: ProSpectrumConfig;
  audioParticles: AudioParticlesConfig;
  smoothWaveform: SmoothWaveformConfig;
  postProcessing: PostProcessingConfig;
  sceneModulation: SceneModulationConfig;
}

export const DEFAULT_AUDIO_VIZ_CONFIG: AudioVizConfig = {
  enabled: true,
  effects: ["pro-spectrum", "post-processing", "scene-modulation"],
  opacity: 0.7,
  color: "#FFE81F",
  proSpectrum: {
    barCount: 64,
    cornerRadius: 0.15,
    gap: 2,
    maxHeight: 30,
    reflectionOpacity: 0.3,
    glowIntensity: 0.5,
    position: "bottom",
  },
  audioParticles: {
    count: 800,
    noiseScale: 1.0,
    trailLength: 0.6,
    turbulence: 1.5,
    baseSize: 2,
    maxSize: 8,
  },
  smoothWaveform: {
    position: "center",
    splineTension: 0.5,
    glowIntensity: 0.4,
    thicknessScale: 1.0,
    colorMapping: "frequency",
  },
  postProcessing: {
    bloomIntensity: 0.5,
    bloomThreshold: 0.6,
    chromaticOffset: 0.002,
    vignetteDarkness: 0.4,
  },
  sceneModulation: {
    zoomIntensity: 20,
    panIntensity: 150,
  },
};

/** Per-frame audio analysis consumed by all visualization effects. Produced by the analysis pipeline in AudioVizOverlay. */
export interface AudioAnalysisData {
  bands: FrequencyBands;
  beat: BeatResult;
  smoothedFrequencies: number[];
  rmsEnergy: number;
}

export interface RemotionVideoProps {
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
  scenes: VideoScene[];
  audioTracks: AudioTrackConfig[];
  captions: Caption[];
  captionStyle?: CaptionStyle;
  videoVolume?: number;
  musicSrc?: string;
  musicVolume?: number;
  musicCompressor?: boolean;
  transitionOverride?: string;
  audioViz?: AudioVizConfig;
}
