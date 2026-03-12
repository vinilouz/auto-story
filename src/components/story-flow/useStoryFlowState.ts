"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_CAPTION_STYLE } from "@/lib/flows/types";
import {
  splitTranscriptionByDuration,
  useAudio,
  useDownload,
  useProject,
  useTranscription,
  useVideo,
  useVideoClips,
} from "@/lib/flows/hooks";
import { getVideoClipDuration } from "@/lib/ai/config";
import { getStages } from "./config";
import type { StoryFlowState, Stage, FlowMode } from "./types";

export function useStoryFlowState(mode: FlowMode, projectId: string): StoryFlowState {
  const [stage, setStage] = useState<Stage>("input");
  const [title, setTitle] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [segmentSize, setSegmentSize] = useState([150]);
  const [language, setLanguage] = useState("english");
  const [imagePromptStyle, setImagePromptStyle] = useState("");
  const [audioVoice, setAudioVoice] = useState("nPczCjzI2devNBz1zQrb");
  const [consistency, setConsistency] = useState(false);

  const [commentator, setCommentator] = useState<StoryFlowState["commentator"]>(null);
  const [commName, setCommName] = useState("");
  const [commPersonality, setCommPersonality] = useState("");
  const [commImagePrompt, setCommImagePrompt] = useState("");
  const [commImage, setCommImage] = useState<string | null>(null);
  const [audioSystemPrompt, setAudioSystemPrompt] = useState("");

  const [segments, setSegments] = useState<StoryFlowState["segments"]>([]);
  const [entities, setEntities] = useState<StoryFlowState["entities"]>([]);
  const [imageStatuses, setImageStatuses] = useState<StoryFlowState["imageStatuses"]>(new Map());
  const [captionStyle, setCaptionStyle] = useState<StoryFlowState["captionStyle"]>(DEFAULT_CAPTION_STYLE);
  const [loading, setLoading] = useState(false);

  const audio = useAudio();
  const transcription = useTranscription();
  const videoClips = useVideoClips();
  const video = useVideo();
  const project = useProject();
  const dl = useDownload();

  const clipDuration = getVideoClipDuration();

  const stages = useMemo(() => getStages(mode, consistency), [mode, consistency]);
  const stageIdx = stages.indexOf(stage);

  const hasPrompts = segments.some((s) => s.imagePrompt);
  const hasImages = segments.some((s) => s.imagePath);
  const hasClips = segments.some((s) => s.videoClipUrl);
  const hasComments = segments.some((s) => s.type === "comment");
  const hasAudio = audio.batches.some((b) => b.status === "completed" && b.url);
  const hasTranscription = transcription.results.length > 0;

  const maxStep = useMemo(() => {
    const idx = (s: Stage) => {
      const i = stages.indexOf(s);
      return i === -1 ? 0 : i;
    };

    if (mode === "video-story") {
      if (video.videoProps) return idx("download");
      if (hasClips) return idx("video");
      if (hasImages) return idx("clips");
      if (hasPrompts) return idx("images");
      if (consistency && entities.length > 0) return idx("descriptions");
      if (segments.length > 0) return idx(consistency ? "entities" : "descriptions");
      if (hasTranscription) return idx("split");
      if (hasAudio) return idx("transcription");
      return 0;
    }

    if (video.videoProps) return idx("download");
    if (hasTranscription) return idx("video");
    if (hasAudio) return idx("transcription");
    if (hasImages) return idx("audio");
    if (hasPrompts) return idx("images");
    if (consistency && entities.length > 0) return idx("descriptions");
    if (hasComments && mode === "commentator") return idx(consistency ? "entities" : "descriptions");
    if (commentator && mode === "commentator") return idx("comments");
    if (segments.length > 0)
      return idx(
        mode === "commentator"
          ? consistency
            ? "commentator"
            : "descriptions"
          : consistency
            ? "entities"
            : "descriptions",
      );
    return 0;
  }, [
    stages,
    mode,
    video.videoProps,
    hasTranscription,
    hasAudio,
    hasImages,
    hasClips,
    hasPrompts,
    entities,
    hasComments,
    commentator,
    segments,
    consistency,
  ]);

  useEffect(() => {
    project
      .load(projectId)
      .then((p) => {
        if (!p) return;
        if (p.name) setTitle(p.name);
        if (p.scriptText) setScriptText(p.scriptText);
        if (p.segmentSize) setSegmentSize([p.segmentSize]);
        if (p.language) setLanguage(p.language);
        if (p.style) setImagePromptStyle(p.style);
        if (p.voice) setAudioVoice(p.voice);
        if (p.consistency) setConsistency(p.consistency);
        if (p.segments) setSegments(p.segments);
        if (p.entities) setEntities(p.entities);
        if (p.commentator) {
          setCommentator(p.commentator);
          setCommName(p.commentator.name);
          setCommPersonality(p.commentator.personality);
          if (p.commentator.appearance?.imageUrl) setCommImage(p.commentator.appearance.imageUrl);
        }
        if (p.audioBatches) audio.setBatches(p.audioBatches);
        if (p.audioSystemPrompt) setAudioSystemPrompt(p.audioSystemPrompt);
        if (p.transcriptionResults) transcription.setResults(p.transcriptionResults);

        if (mode === "video-story") {
          if (p.segments?.some((s: any) => s.videoClipUrl)) setStage("clips");
          else if (p.segments?.some((s: any) => s.imagePath)) setStage("images");
          else if (p.segments?.some((s: any) => s.imagePrompt)) setStage("descriptions");
          else if (p.segments?.length) setStage("split");
          else if (p.transcriptionResults?.length) setStage("transcription");
          else if (p.audioBatches?.some((b: any) => b.status === "completed")) setStage("audio");
        } else {
          if (p.transcriptionResults?.length) setStage("video");
          else if (p.audioBatches?.some((b: any) => b.status === "completed")) setStage("audio");
          else if (p.segments?.some((s: any) => s.imagePath)) setStage("images");
          else if (p.segments?.some((s: any) => s.imagePrompt)) setStage("descriptions");
          else if (p.segments?.length) setStage(mode === "commentator" ? "commentator" : "descriptions");
        }
      })
      .catch(() => {});
  }, [projectId]);

  return {
    mode,
    projectId,
    stage,
    setStage,
    title,
    setTitle,
    scriptText,
    setScriptText,
    segmentSize,
    setSegmentSize,
    language,
    setLanguage,
    imagePromptStyle,
    setImagePromptStyle,
    audioVoice,
    setAudioVoice,
    consistency,
    setConsistency,
    commentator,
    setCommentator,
    commName,
    setCommName,
    commPersonality,
    setCommPersonality,
    commImagePrompt,
    setCommImagePrompt,
    commImage,
    setCommImage,
    audioSystemPrompt,
    setAudioSystemPrompt,
    segments,
    setSegments,
    entities,
    setEntities,
    imageStatuses,
    setImageStatuses,
    captionStyle,
    setCaptionStyle,
    loading,
    setLoading,
    stages,
    stageIdx,
    maxStep,
    hasPrompts,
    hasImages,
    hasClips,
    hasComments,
    hasAudio,
    hasTranscription,
    clipDuration,
    audio,
    transcription,
    videoClips,
    video,
    project,
    dl,
  };
}
