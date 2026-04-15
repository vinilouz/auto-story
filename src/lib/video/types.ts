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

export type AudioVizEffectType =
  | "spectrum-bars"
  | "vignette-glow"
  | "particles"
  | "waveform-ribbon"
  | "scene-modulation";

export interface SpectrumBarsConfig {
  maxHeight: number;
  barGap: number;
  borderRadius: number;
  glow: boolean;
  position: "bottom" | "top" | "center" | "left" | "right";
}

export interface VignetteGlowConfig {
  spread: number;
  minOpacity: number;
  maxOpacity: number;
}

export interface AudioParticlesConfig {
  count: number;
  speed: number;
  size: number;
  scale: number;
  noise: number;
}

export interface WaveformConfig {
  radius: number;
  displacement: number;
  thickness: number;
  glow: boolean;
  position: "center" | "bottom" | "top";
}

export interface SceneModulationConfig {
  zoomIntensity: number;
  panIntensity: number;
}

export interface AudioVizConfig {
  enabled: boolean;
  effects: AudioVizEffectType[];
  opacity: number;
  color: string;
  spectrumBars: SpectrumBarsConfig;
  vignetteGlow: VignetteGlowConfig;
  particles: AudioParticlesConfig;
  waveformRibbon: WaveformConfig;
  sceneModulation: SceneModulationConfig;
}

export const DEFAULT_AUDIO_VIZ_CONFIG: AudioVizConfig = {
  enabled: true,
  effects: [
    "spectrum-bars",
    "vignette-glow",
    "particles",
    "waveform-ribbon",
    "scene-modulation",
  ],
  opacity: 0.7,
  color: "#FFE81F",
  spectrumBars: {
    maxHeight: 30,
    barGap: 2,
    borderRadius: 2,
    glow: true,
    position: "bottom",
  },
  vignetteGlow: {
    spread: 60,
    minOpacity: 2,
    maxOpacity: 50,
  },
  particles: {
    count: 100,
    speed: 0.8,
    size: 3,
    scale: 10,
    noise: 2,
  },
  waveformRibbon: {
    radius: 20,
    displacement: 40,
    thickness: 3,
    glow: true,
    position: "center",
  },
  sceneModulation: {
    zoomIntensity: 20,
    panIntensity: 150,
  },
};

export interface AudioFrequencyData {
  bass: number;
  mid: number;
  treble: number;
  overall: number;
  frequencies: number[];
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
