import type React from "react";
import type { CaptionStyle, CommentatorConfig, EntityAsset, Segment } from "@/lib/flows/types";
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
  | "download";

export type FlowMode = "simple" | "commentator" | "video-story";

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
  setEntities: (entities: EntityAsset[] | ((prev: EntityAsset[]) => EntityAsset[])) => void;
  imageStatuses: Map<number, "generating" | "error">;
  setImageStatuses: (statuses: Map<number, "generating" | "error"> | ((prev: Map<number, "generating" | "error">) => Map<number, "generating" | "error">)) => void;
  captionStyle: CaptionStyle;
  setCaptionStyle: (style: CaptionStyle | ((prev: CaptionStyle) => CaptionStyle)) => void;
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
  hasComments: boolean;
  hasAudio: boolean;
  hasTranscription: boolean;
  clipDuration: number;
  audio: {
    batches: AudioBatch[];
    setBatches: (batches: AudioBatch[]) => void;
    generate: (opts: { text: string; voice: string; systemPrompt: string; projectId: string; projectName: string }) => Promise<AudioBatch[]>;
    regenerateBatch: (index: number, opts: { text: string; voice: string; systemPrompt: string; projectId: string; projectName: string }) => Promise<void>;
    isLoading: boolean;
  };
  transcription: {
    results: TranscriptionResult[];
    setResults: (results: TranscriptionResult[]) => void;
    transcribe: (batches: AudioBatch[], language: string) => Promise<TranscriptionResult[] | undefined>;
    retry: (url: string, language: string) => Promise<TranscriptionResult[] | undefined>;
    isLoading: boolean;
  };
  videoClips: {
    clipStatuses: Map<number, "generating" | "error" | "completed">;
    generateAll: (
      segments: Segment[],
      setSegments: React.Dispatch<React.SetStateAction<Segment[]>>,
      opts: {
        projectId?: string | null;
        projectName?: string;
        clipDuration?: number;
        onClipCompleted?: (segments: Segment[]) => Promise<void>;
      }
    ) => Promise<void>;
    regenerateClip: (
      index: number,
      segments: Segment[],
      setSegments: React.Dispatch<React.SetStateAction<Segment[]>>,
      opts: {
        projectId?: string | null;
        projectName?: string;
        clipDuration?: number;
        onClipCompleted?: (segments: Segment[]) => Promise<void>;
      }
    ) => Promise<void>;
    isLoading: boolean;
  };
  video: {
    videoProps: any;
    setVideoProps: (props: any) => void;
    generate: (segments: any[], batches: AudioBatch[], results: TranscriptionResult[], mode: "image" | "video", videoVolume?: number) => Promise<any>;
    render: (props: any, captionStyle: CaptionStyle, projectId?: string, title?: string) => Promise<void>;
    isGenerating: boolean;
    isRendering: boolean;
    renderProgress: any;
  };
  project: {
    projectId: string | null;
    setProjectId: (id: string | null) => void;
    load: (id: string) => Promise<any>;
    save: (data: any) => Promise<any>;
    isSaving: boolean;
  };
  dl: {
    downloadZip: (opts: { segments: Segment[]; audioUrls: string[]; transcriptionResults: TranscriptionResult[]; filename: string }) => Promise<void>;
    isDownloading: boolean;
  };
}
