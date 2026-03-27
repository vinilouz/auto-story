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
import {
  calculateMaxStep,
  determineInitialStage,
} from "@/lib/domain/navigation";
import { getStages } from "./config";
import type { StoryFlowState, Stage, FlowMode } from "./types";

export function useStoryFlowState(
  mode: FlowMode,
  projectId: string,
): StoryFlowState {
  const [stage, setStage] = useState<Stage>("input");
  const [title, setTitle] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [segmentSize, setSegmentSize] = useState([150]);
  const [language, setLanguage] = useState("english");
  const [imagePromptStyle, setImagePromptStyle] = useState("");
  const [audioVoice, setAudioVoice] = useState("nPczCjzI2devNBz1zQrb");
  const [consistency, setConsistency] = useState(false);
  const [music, setMusic] = useState(false);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);

  // from-audio flow: local File object chosen by the user in InputAudioStage
  const [uploadedAudioFile, setUploadedAudioFile] = useState<File | null>(null);

  const [commentator, setCommentator] =
    useState<StoryFlowState["commentator"]>(null);
  const [commName, setCommName] = useState("");
  const [commPersonality, setCommPersonality] = useState("");
  const [commImagePrompt, setCommImagePrompt] = useState("");
  const [commImage, setCommImage] = useState<string | null>(null);
  const [audioSystemPrompt, setAudioSystemPrompt] = useState("");

  const [segments, setSegments] = useState<StoryFlowState["segments"]>([]);
  const [entities, setEntities] = useState<StoryFlowState["entities"]>([]);
  const [imageStatuses, setImageStatuses] = useState<
    StoryFlowState["imageStatuses"]
  >(new Map());
  const [captionStyle, setCaptionStyle] = useState<
    StoryFlowState["captionStyle"]
  >(DEFAULT_CAPTION_STYLE);
  const [videoVolume, setVideoVolume] = useState(0);
  const [loading, setLoading] = useState(false);

  const audio = useAudio();
  const transcription = useTranscription();
  const videoClips = useVideoClips();
  const video = useVideo();
  const project = useProject();
  const dl = useDownload();

  const clipDuration = getVideoClipDuration();

  const stages = useMemo(
    () => getStages(mode, consistency, music),
    [mode, consistency, music],
  );
  const stageIdx = stages.indexOf(stage);

  const hasPrompts = segments.some((s) => s.imagePrompt);
  const hasImages = segments.some((s) => s.imagePath);
  const hasClips = segments.some((s) => s.videoClipUrl);
  const hasMusic = !!musicUrl;
  const hasComments = segments.some((s) => s.type === "comment");
  const hasAudio = audio.batches.some((b) => b.status === "completed" && b.url);
  const hasTranscription = !!transcription.result;

  const maxStep = useMemo(
    () =>
      calculateMaxStep(stages, mode, {
        hasVideoProps: !!video.videoProps,
        hasClips,
        hasImages,
        hasPrompts,
        hasEntities: entities.length > 0,
        hasComments,
        hasAudio,
        hasTranscription,
        hasCommentator: !!commentator,
        hasSegments: segments.length > 0,
        consistency,
      }),
    [
      stages,
      mode,
      video.videoProps,
      hasClips,
      hasImages,
      hasPrompts,
      entities.length,
      hasComments,
      hasAudio,
      hasTranscription,
      commentator,
      segments.length,
      consistency,
    ],
  );

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
        if (p.musicEnabled) setMusic(p.musicEnabled);
        if (p.music) setMusicUrl(p.music);
        if (p.segments) setSegments(p.segments);
        if (p.entities) setEntities(p.entities);
        if (p.commentator) {
          setCommentator(p.commentator);
          setCommName(p.commentator.name);
          setCommPersonality(p.commentator.personality);
          if (p.commentator.appearance?.imageUrl)
            setCommImage(p.commentator.appearance.imageUrl);
        }
        if (p.audioBatches) audio.setBatches(p.audioBatches);
        if (p.audioSystemPrompt) setAudioSystemPrompt(p.audioSystemPrompt);
        const tr = p.transcriptionResult || (p as any).transcriptionResults;
        if (tr) transcription.setResult(tr);
        if (p.videoVolume !== undefined) setVideoVolume(p.videoVolume);

        setStage(determineInitialStage(mode, p));
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
    music,
    setMusic,
    musicUrl,
    setMusicUrl,
    uploadedAudioFile,
    setUploadedAudioFile,
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
    videoVolume,
    setVideoVolume,
    loading,
    setLoading,
    stages,
    stageIdx,
    maxStep,
    hasPrompts,
    hasImages,
    hasClips,
    hasMusic,
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
