import type {
  CaptionStyle,
  CommentatorConfig,
  EntityAsset,
  Segment,
} from "@/lib/flows/types";
import type { AudioBatch, TranscriptionResult } from "@/lib/flows/types";

export type Stage =
  | "input"
  | "commentator"
  | "comments"
  | "descriptions"
  | "entities"
  | "images"
  | "audio"
  | "transcription"
  | "split"
  | "clips"
  | "video"
  | "download"
  | "music";

export type FlowMode = "simple" | "commentator" | "video-story" | "from-audio";

export interface StoryFlowProps {
  mode: FlowMode;
  projectId: string;
  onBack: () => void;
}

export interface ExecuteConfig {
  fn: () => Promise<void>;
  ok: boolean;
  label: string;
  busy: boolean;
}

export interface StoryFlowState {
  mode: FlowMode;
  projectId: string;
  stage: Stage;
  setStage: (stage: Stage) => void;
  title: string;
  setTitle: (title: string) => void;
  scriptText: string;
  setScriptText: (text: string) => void;
  segmentSize: number[];
  setSegmentSize: (size: number[]) => void;
  language: string;
  setLanguage: (lang: string) => void;
  imagePromptStyle: string;
  setImagePromptStyle: (style: string) => void;
  audioVoice: string;
  setAudioVoice: (voice: string) => void;
  consistency: boolean;
  setConsistency: (consistency: boolean) => void;
  music: boolean;
  setMusic: (music: boolean) => void;
  musicPrompt: string;
  setMusicPrompt: (prompt: string) => void;
  musicUrl: string | null;
  setMusicUrl: (url: string | null) => void;
  /** Audio file chosen by the user – only used in the from-audio flow */
  uploadedAudioFile: File | null;
  setUploadedAudioFile: (file: File | null) => void;
  commentator: CommentatorConfig | null;
  setCommentator: (commentator: CommentatorConfig | null) => void;
  commName: string;
  setCommName: (name: string) => void;
  commPersonality: string;
  setCommPersonality: (personality: string) => void;
  commImagePrompt: string;
  setCommImagePrompt: (prompt: string) => void;
  commImage: string | null;
  setCommImage: (image: string | null) => void;
  audioSystemPrompt: string;
  setAudioSystemPrompt: (prompt: string) => void;
  segments: Segment[];
  setSegments: (segments: Segment[] | ((prev: Segment[]) => Segment[])) => void;
  entities: EntityAsset[];
  setEntities: (
    entities: EntityAsset[] | ((prev: EntityAsset[]) => EntityAsset[]),
  ) => void;
  imageStatuses: Map<number, "generating" | "error">;
  setImageStatuses: (
    statuses:
      | Map<number, "generating" | "error">
      | ((
          prev: Map<number, "generating" | "error">,
        ) => Map<number, "generating" | "error">),
  ) => void;
  captionStyle: CaptionStyle;
  setCaptionStyle: (
    style: CaptionStyle | ((prev: CaptionStyle) => CaptionStyle),
  ) => void;
  videoVolume: number;
  setVideoVolume: (volume: number) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  stages: Stage[];
  stageIdx: number;
  maxStep: number;
  hasPrompts: boolean;
  hasImages: boolean;
  hasClips: boolean;
  hasMusic: boolean;
  hasComments: boolean;
  hasAudio: boolean;
  hasTranscription: boolean;
  clipDuration: number;
  audio: ReturnType<typeof import("@/lib/flows/hooks").useAudio>;
  transcription: ReturnType<
    typeof import("@/lib/flows/hooks").useTranscription
  >;
  videoClips: ReturnType<typeof import("@/lib/flows/hooks").useVideoClips>;
  video: ReturnType<typeof import("@/lib/flows/hooks").useVideo>;
  project: ReturnType<typeof import("@/lib/flows/hooks").useProject>;
  dl: ReturnType<typeof import("@/lib/flows/hooks").useDownload>;
}
