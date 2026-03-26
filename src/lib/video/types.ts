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
  transitionOverride?: string;
}
