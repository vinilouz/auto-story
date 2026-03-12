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

export interface VideoScene {
  id: string;
  imageUrl: string;
  videoClipUrl?: string;
  startFrame: number;
  durationInFrames: number;
  effect: SceneEffect;
  transition?: VideoTransition;
  textFragment?: string;
  debug?: {
    startSeconds: number;
    endSeconds: number;
    durationSeconds: number;
  };
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
  maxWordsPerLine: number;
  uppercase: boolean;
  highlightColor: string;
  fontWeight?: number;
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
  transitionOverride?: string;
}