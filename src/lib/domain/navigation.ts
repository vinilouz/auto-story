import type { Stage, FlowMode } from "@/components/story-flow/types";

export interface NavigationState {
  hasVideoProps: boolean;
  hasClips: boolean;
  hasImages: boolean;
  hasPrompts: boolean;
  hasEntities: boolean;
  hasComments: boolean;
  hasAudio: boolean;
  hasTranscription: boolean;
  hasCommentator: boolean;
  hasSegments: boolean;
  consistency: boolean;
}

export function calculateMaxStep(
  stages: Stage[],
  mode: FlowMode,
  state: NavigationState,
): number {
  const idx = (s: Stage) => {
    const i = stages.indexOf(s);
    return i === -1 ? 0 : i;
  };

  if (mode === "video-story") {
    if (state.hasVideoProps) return idx("download");
    if (state.hasClips) return idx("video");
    if (state.hasImages) return idx("clips");
    if (state.hasPrompts) return idx("images");
    if (state.consistency && state.hasEntities) return idx("descriptions");
    if (state.hasSegments) return idx(state.consistency ? "entities" : "descriptions");
    if (state.hasTranscription) return idx("split");
    if (state.hasAudio) return idx("transcription");
    return 0;
  }

  if (state.hasVideoProps) return idx("download");
  if (state.hasTranscription) return idx("video");
  if (state.hasAudio) return idx("transcription");
  if (state.hasImages) return idx("audio");
  if (state.hasPrompts) return idx("images");
  if (state.consistency && state.hasEntities) return idx("descriptions");
  if (state.hasComments && mode === "commentator") return idx(state.consistency ? "entities" : "descriptions");
  if (state.hasCommentator && mode === "commentator") return idx("comments");
  if (state.hasSegments) {
    return idx(
      mode === "commentator"
        ? state.consistency
          ? "commentator"
          : "descriptions"
        : state.consistency
          ? "entities"
          : "descriptions",
    );
  }
  return 0;
}

export function determineInitialStage(
  mode: FlowMode,
  project: {
    segments?: Array<{ imagePrompt?: string; imagePath?: string; videoClipUrl?: string; type?: string }>;
    audioBatches?: Array<{ status: string }>;
    transcriptionResults?: unknown[];
    commentator?: unknown;
  },
): Stage {
  if (mode === "video-story") {
    if (project.segments?.some((s) => s.videoClipUrl)) return "clips";
    if (project.segments?.some((s) => s.imagePath)) return "images";
    if (project.segments?.some((s) => s.imagePrompt)) return "descriptions";
    if (project.segments?.length) return "split";
    if (project.transcriptionResults?.length) return "transcription";
    if (project.audioBatches?.some((b) => b.status === "completed")) return "audio";
    return "input";
  }

  if (project.transcriptionResults?.length) return "video";
  if (project.audioBatches?.some((b) => b.status === "completed")) return "audio";
  if (project.segments?.some((s) => s.imagePath)) return "images";
  if (project.segments?.some((s) => s.imagePrompt)) return "descriptions";
  if (project.segments?.length) return mode === "commentator" ? "commentator" : "descriptions";
  return "input";
}
