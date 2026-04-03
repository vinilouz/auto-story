"use client";

import { useCallback, useEffect, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStoryFlowState } from "./useStoryFlowState";
import { useStoryFlowActions } from "./useStoryFlowActions";
import { Header } from "./Header";
import { NavigationBar } from "./NavigationBar";
import { InputStage } from "./stages/InputStage";
import { InputAudioStage } from "./stages/InputAudioStage";
import { CommentatorStage } from "./stages/CommentatorStage";
import { CommentsStage } from "./stages/CommentsStage";
import { DescriptionsStage } from "./stages/DescriptionsStage";
import { EntitiesStage } from "./stages/EntitiesStage";
import { ImagesStage } from "./stages/ImagesStage";
import { AudioStage } from "./stages/AudioStage";
import { TranscriptionStage } from "./stages/TranscriptionStage";
import { SplitStage } from "./stages/SplitStage";
import { ClipsStage } from "./stages/ClipsStage";
import { VideoStage } from "./stages/VideoStage";
import { DownloadStage } from "./stages/DownloadStage";
import { MusicStage } from "./stages/MusicStage";
import { STAGE_LABELS } from "./config";
import { getTranscription, splitWordsIntoSegments } from "@/lib/utils/text";
import type { StoryFlowProps, Stage, ExecuteConfig } from "./types";

export default function StoryFlow({ mode, projectId, onBack }: StoryFlowProps) {
  const state = useStoryFlowState(mode, projectId);
  const actions = useStoryFlowActions(state);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const {
    stage,
    stages,
    maxStep,
    stageIdx,
    hasPrompts,
    hasImages,
    hasClips,
    hasMusic,
    hasComments,
    hasAudio,
    hasTranscription,
    loading,
    imageStatuses,
    videoClips,
    audio,
    transcription,
    video,
  } = state;

  const canNext = stageIdx < maxStep;

  const exec = useMemo((): ExecuteConfig => {
    switch (stage) {
      case "input":
        // from-audio: upload file + transcribe in one step
        if (mode === "from-audio")
          return {
            fn: actions.uploadAudioAndTranscribe,
            ok: !!state.uploadedAudioFile,
            label: "Upload & Transcribe",
            busy: loading || transcription.isLoading,
          };
        if (mode === "video-story")
          return {
            fn: actions.generateAudioAction,
            ok: !!state.scriptText.trim(),
            label: "Generate Audio",
            busy: audio.isLoading,
          };
        return {
          fn: actions.splitScenes,
          ok: !!state.scriptText.trim(),
          label: "Split Scenes",
          busy: loading,
        };

      case "transcription":
        // from-audio: split transcript into scenes preserving timing
        if (mode === "from-audio")
          return {
            fn: async () => {
              const transcriptionUrl = transcription.result?.transcriptionUrl;
              if (!transcriptionUrl) return;
              const allWords = await getTranscription(transcriptionUrl);
              if (allWords.length === 0) return;
              const newSegs = splitWordsIntoSegments(
                allWords,
                state.segmentSize[0],
              );
              state.setSegments(newSegs);
              state.setStage("split");
              await actions.save({ segments: newSegs });
            },
            ok: hasTranscription,
            label: "Split into Scenes",
            busy: loading,
          };
        return {
          fn: actions.transcribeAction,
          ok: hasAudio,
          label: hasTranscription ? "Re-transcribe" : "Transcribe",
          busy: transcription.isLoading,
        };

      case "split":
        if (mode === "from-audio")
          return {
            fn: async () =>
              state.setStage(state.consistency ? "entities" : "descriptions"),
            ok: state.segments.length > 0,
            label: "Continue",
            busy: false,
          };
        return {
          fn: actions.splitByDuration,
          ok: hasTranscription,
          label: state.segments.length > 0 ? "Re-split" : "Split by Duration",
          busy: loading,
        };

      case "music":
        return {
          fn: state.musicPrompt
            ? actions.generateMusic
            : actions.generateMusicPrompt,
          ok: true,
          label: hasMusic
            ? "Regenerate"
            : state.musicPrompt
              ? "Generate Music"
              : "Generate Prompt",
          busy: loading,
        };

      case "commentator":
        return {
          fn: actions.saveCommentator,
          ok: !!state.commName.trim() && !!state.commImage,
          label: "Save Commentator",
          busy: false,
        };

      case "comments":
        return {
          fn: actions.generateComments,
          ok: !!state.commentator,
          label: hasComments ? "Regenerate" : "Generate Comments",
          busy: loading,
        };

      case "descriptions":
        return {
          fn: actions.generateDescriptions,
          ok: state.segments.length > 0,
          label: hasPrompts ? "Regenerate" : "Generate Descriptions",
          busy: loading,
        };

      case "entities":
        return {
          fn: actions.extractAndGenerateEntities,
          ok: state.segments.length > 0,
          label:
            state.entities.length > 0 ? "Re-extract" : "Extract & Generate",
          busy: loading,
        };

      case "images":
        return {
          fn: actions.generateAllImages,
          ok: hasPrompts,
          label: hasImages ? "Regenerate All" : "Generate Images",
          busy: imageStatuses.size > 0,
        };

      case "audio":
        return {
          fn: actions.generateAudioAction,
          ok: state.segments.length > 0,
          label: hasAudio ? "Regenerate" : "Generate Audio",
          busy: audio.isLoading,
        };

      case "clips":
        return {
          fn: actions.generateAllClips,
          ok: hasImages,
          label: hasClips ? "Regenerate Clips" : "Generate Video Clips",
          busy: videoClips.isLoading,
        };

      case "video":
        return {
          fn: actions.generateVideoPreview,
          ok:
            mode === "video-story"
              ? hasClips || hasTranscription
              : hasTranscription,
          label: video.videoProps ? "Regenerate" : "Generate Preview",
          busy: video.isGenerating,
        };

      case "download":
        return {
          fn: actions.downloadZipAction,
          ok: true,
          label: "Download ZIP",
          busy: state.dl.isDownloading,
        };
    }
  }, [
    stage,
    mode,
    state.scriptText,
    state.uploadedAudioFile,
    state.commName,
    state.commImage,
    state.commentator,
    state.segments,
    state.entities,
    state.segmentSize,
    state.consistency,
    state.clipDuration,
    hasPrompts,
    hasImages,
    hasClips,
    hasMusic,
    state.musicPrompt,
    hasComments,
    hasAudio,
    hasTranscription,
    loading,
    imageStatuses.size,
    audio.isLoading,
    transcription.isLoading,
    transcription.result,
    videoClips.isLoading,
    video.isGenerating,
    video.videoProps,
    state.dl.isDownloading,
    actions,
  ]);

  const goNext = useCallback(() => {
    if (canNext) state.setStage(stages[stageIdx + 1]);
  }, [canNext, stageIdx, stages, state]);

  const goBack = useCallback(() => {
    if (stageIdx > 0) state.setStage(stages[stageIdx - 1]);
  }, [stageIdx, stages, state]);

  const renderStage = () => {
    const props = { state, actions };
    switch (stage) {
      case "input":
        // from-audio uses a dedicated input stage with file upload
        if (mode === "from-audio") return <InputAudioStage state={state} />;
        return <InputStage {...props} />;
      case "commentator":
        return <CommentatorStage {...props} />;
      case "comments":
        return <CommentsStage {...props} />;
      case "descriptions":
        return <DescriptionsStage {...props} />;
      case "entities":
        return <EntitiesStage {...props} />;
      case "images":
        return <ImagesStage {...props} />;
      case "audio":
        return <AudioStage {...props} />;
      case "transcription":
        return <TranscriptionStage {...props} />;
      case "split":
        return <SplitStage {...props} />;
      case "clips":
        return <ClipsStage {...props} />;
      case "music":
        return <MusicStage {...props} />;
      case "video":
        return <VideoStage {...props} />;
      case "download":
        return <DownloadStage {...props} />;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Header
          mode={mode}
          title={state.title}
          scriptText={state.scriptText}
          isSaving={state.project.isSaving}
          onSave={() => actions.save()}
          onBack={onBack}
        />

        <Tabs
          value={stage}
          onValueChange={(v) => {
            if (stages.indexOf(v as Stage) <= maxStep)
              state.setStage(v as Stage);
          }}
        >
          <TabsList className="w-full flex-wrap justify-start p-1">
            {stages.map((s, i) => (
              <TabsTrigger
                key={s}
                value={s}
                disabled={i > maxStep}
                className="flex-1 py-2 text-xs sm:text-sm truncate data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {i + 1}. {STAGE_LABELS[s]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {renderStage()}
      </div>

      <NavigationBar
        stageIdx={stageIdx}
        canNext={canNext}
        exec={exec}
        onNext={goNext}
        onBack={goBack}
      />
    </div>
  );
}
