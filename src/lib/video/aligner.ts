import {
  REMOTION_CROPPED_HEIGHT,
  REMOTION_CROPPED_WIDTH,
  REMOTION_DEFAULT_FPS,
} from "@/remotion/constants";

import type {
  AudioTrackConfig,
  Caption,
  RemotionVideoProps,
  SceneEffect,
  VideoScene,
  VideoTransition,
} from "./types";

import { createLogger } from "../logger";

import { flattenTranscription } from "./alignment/flatten-transcription";
import {
  findSegmentTimingsWithConfidence,
  findSegmentTimingsSimple,
} from "./alignment/find-segment-timings";
import { generateScenes } from "./alignment/generate-scenes";
import type { Word } from "./alignment/text-matching";

const logger = createLogger("aligner");

const FIXED_CLIP_DURATION_SECONDS = 8;

// --- Interfaces & Types ---

interface AlignmentContext {
  segments: {
    id: string;
    text: string;
    imageUrl: string;
    videoClipUrl?: string;
  }[];
  transcriptionResults: { words: Word[] }[];
  audioUrls: string[];
  audioDurations?: number[];
  fps: number;
  fixedClipDuration?: number;
}

interface AlignmentStrategy {
  align(context: AlignmentContext): RemotionVideoProps;
}

// --- Strategies ---

export class PrecisionAlignmentStrategy implements AlignmentStrategy {
  private static EFFECTS: SceneEffect[] = [
    "zoom-in",
    "zoom-out",
    "pan-left",
    "pan-right",
  ];
  private static TRANSITIONS: VideoTransition["type"][] = [
    "fade",
    "wipe",
    "slide",
  ];
  private static TRANSITION_DURATION = 30; // Even number as requested

  align(context: AlignmentContext): RemotionVideoProps {
    const { segments, transcriptionResults, audioUrls, fps } = context;

    // 1. Pipeline Stage: Flatten Transcription
    const { allWords, audioTracks, totalAudioDurationSeconds } =
      flattenTranscription(
        transcriptionResults,
        audioUrls,
        fps,
        context.audioDurations,
      );

    // 2. Pipeline Stage: Find Anchors (Time in Seconds)
    const segmentTimings = findSegmentTimingsWithConfidence(
      segments,
      allWords,
      totalAudioDurationSeconds,
    );

    // 3. Pipeline Stage: Generate Scenes (Frame Conversions)
    const scenes = generateScenes(segments, segmentTimings, fps, {
      effects: PrecisionAlignmentStrategy.EFFECTS,
      transitions: PrecisionAlignmentStrategy.TRANSITIONS,
      transitionFrames: PrecisionAlignmentStrategy.TRANSITION_DURATION,
    });

    const captions: Caption[] = allWords.map((w) => ({
      text: w.text,
      startMs: Math.round(w.globalStart * 1000),
      endMs: Math.round(w.globalEnd * 1000),
    }));

    const totalAudioDurationFrames = Math.ceil(totalAudioDurationSeconds * fps);

    logger.info("Precision Alignment Complete.", {
      scenes: scenes.length,
      captions: captions.length,
      durationFrames: totalAudioDurationFrames,
      durationSeconds: totalAudioDurationFrames / fps,
    });

    return {
      fps,
      durationInFrames: totalAudioDurationFrames,
      width: REMOTION_CROPPED_WIDTH,
      height: REMOTION_CROPPED_HEIGHT,
      scenes,
      audioTracks,
      captions,
    };
  }
}

export class ContinuousAlignmentStrategy implements AlignmentStrategy {
  // 92% speed → each clip yields ~(slowedFrames - naturalFrames) transition frames
  private static readonly PLAYBACK_RATE = 0.92;

  private static readonly TRANSITIONS: VideoTransition["type"][] = [
    "fade",
    "wipe",
    "slide",
  ];

  align(
    context: AlignmentContext & { videoDurations?: number[] },
  ): RemotionVideoProps {
    const {
      segments,
      transcriptionResults,
      audioUrls,
      audioDurations,
      videoDurations,
      fps,
    } = context;

    if (!videoDurations || videoDurations.length !== segments.length) {
      throw new Error(
        `[ContinuousAligner] videoDurations must have exactly one entry per segment. ` +
          `Got ${videoDurations?.length ?? 0}, expected ${segments.length}.`,
      );
    }

    // ── 1. Audio tracks ───────────────────────────────────────────────────────
    let totalAudioDurationSeconds = 0;
    const audioTracks: AudioTrackConfig[] = [];

    const safeAudioDurations = audioDurations ?? [];
    transcriptionResults.forEach((result, batchIndex) => {
      const durationSeconds = safeAudioDurations[batchIndex];
      if (durationSeconds == null || durationSeconds <= 0) {
        throw new Error(
          `[ContinuousAligner] audioDurations[${batchIndex}] is missing or zero.`,
        );
      }
      const durationFrames = Math.ceil(durationSeconds * fps);
      audioTracks.push({
        src: audioUrls[batchIndex],
        startFrame: Math.round(totalAudioDurationSeconds * fps),
        durationInFrames: durationFrames,
      });
      totalAudioDurationSeconds += durationSeconds;
    });

    // ── 2. Scenes with playbackRate-derived transitions ───────────────────────
    const scenes: VideoScene[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const realDurationSeconds = videoDurations[i];

      if (realDurationSeconds == null || realDurationSeconds <= 0) {
        throw new Error(
          `[ContinuousAligner] videoDurations[${i}] is missing or zero for "${seg.id}".`,
        );
      }

      const slowedDurationSeconds =
        realDurationSeconds / ContinuousAlignmentStrategy.PLAYBACK_RATE;

      const naturalFrames = Math.round(realDurationSeconds * fps);
      const slowedFrames = Math.round(slowedDurationSeconds * fps);
      const transitionFrames = slowedFrames - naturalFrames;

      const isLast = i === segments.length - 1;
      const transitionType =
        ContinuousAlignmentStrategy.TRANSITIONS[
          i % ContinuousAlignmentStrategy.TRANSITIONS.length
        ];

      scenes.push({
        id: seg.id,
        imageUrl: seg.imageUrl,
        videoClipUrl: seg.videoClipUrl,
        startFrame: 0,
        durationInFrames: slowedFrames,
        effect: "static",
        playbackRate: ContinuousAlignmentStrategy.PLAYBACK_RATE,
        transition: !isLast
          ? { type: transitionType, durationInFrames: transitionFrames }
          : undefined,
        textFragment: seg.text,
        debug: {
          startSeconds: 0,
          endSeconds: slowedDurationSeconds,
          durationSeconds: slowedDurationSeconds,
          naturalDurationSeconds: realDurationSeconds,
          playbackRate: ContinuousAlignmentStrategy.PLAYBACK_RATE,
          transitionFrames,
        },
      });
    }

    // ── 3. Total duration ─────────────────────────────────────────────────────
    const totalTransitionFrames = scenes
      .filter((s) => s.transition)
      .reduce((acc, s) => acc + (s.transition?.durationInFrames ?? 0), 0);
    const totalVideoFrames =
      scenes.reduce((acc, s) => acc + s.durationInFrames, 0) -
      totalTransitionFrames;

    const totalAudioFrames = Math.ceil(totalAudioDurationSeconds * fps);

    if (totalAudioFrames > totalVideoFrames) {
      throw new Error(
        `[ContinuousAligner] Audio (${totalAudioFrames}f / ${totalAudioDurationSeconds.toFixed(2)}s) exceeds video (${totalVideoFrames}f / ${(totalVideoFrames / fps).toFixed(2)}s). Segment count mismatch: ${scenes.length} scenes for ${totalAudioDurationSeconds.toFixed(2)}s of audio.`,
      );
    }

    const totalFrames = totalAudioFrames;

    // ── 4. Captions ───────────────────────────────────────────────────────────
    let globalTimeOffset = 0;
    const captions: Caption[] = [];

    transcriptionResults.forEach((result, batchIndex) => {
      const words: any[] = Array.isArray(result) ? result : result.words;
      const trackDurationSeconds =
        audioTracks[batchIndex].durationInFrames / fps;

      words.forEach((w) => {
        if (!w.text.trim()) return;
        captions.push({
          text: w.text,
          startMs: Math.round((globalTimeOffset + w.startMs / 1000) * 1000),
          endMs: Math.round((globalTimeOffset + w.endMs / 1000) * 1000),
        });
      });

      globalTimeOffset += trackDurationSeconds;
    });

    logger.info("Continuous Alignment Complete.", {
      scenes: scenes.length,
      captions: captions.length,
      playbackRate: ContinuousAlignmentStrategy.PLAYBACK_RATE,
      totalVideoFrames,
      totalAudioFrames,
      totalFrames,
      fps,
    });

    return {
      fps,
      durationInFrames: totalFrames,
      width: REMOTION_CROPPED_WIDTH,
      height: REMOTION_CROPPED_HEIGHT,
      scenes,
      audioTracks,
      captions,
    };
  }
}

export class ImageAlignmentStrategy implements AlignmentStrategy {
  private static EFFECTS: SceneEffect[] = [
    "zoom-in",
    "zoom-out",
    "pan-left",
    "pan-right",
  ];
  private static TRANSITIONS: VideoTransition["type"][] = [
    "fade",
    "wipe",
    "slide",
  ];
  private static TRANSITION_DURATION = 30;

  align(context: AlignmentContext): RemotionVideoProps {
    const { segments, transcriptionResults, audioUrls, fps } = context;

    const { allWords, audioTracks, totalAudioDurationSeconds } =
      flattenTranscription(
        transcriptionResults,
        audioUrls,
        fps,
        context.audioDurations,
      );

    const segmentTimings = findSegmentTimingsSimple(
      segments,
      allWords,
      totalAudioDurationSeconds,
    );

    const scenes = generateScenes(segments, segmentTimings, fps, {
      effects: ImageAlignmentStrategy.EFFECTS,
      transitions: ImageAlignmentStrategy.TRANSITIONS,
      transitionFrames: ImageAlignmentStrategy.TRANSITION_DURATION,
    });

    const captions: Caption[] = allWords.map((w) => ({
      text: w.text,
      startMs: Math.round(w.globalStart * 1000),
      endMs: Math.round(w.globalEnd * 1000),
    }));

    const totalAudioDurationFrames = Math.ceil(totalAudioDurationSeconds * fps);

    logger.info("Image Alignment Complete.", {
      segments: segments.length,
      audioTracks: audioTracks.length,
      durationSec: totalAudioDurationSeconds,
      durationFrames: totalAudioDurationFrames,
    });

    return {
      fps,
      durationInFrames: Math.max(1, totalAudioDurationFrames),
      width: REMOTION_CROPPED_WIDTH,
      height: REMOTION_CROPPED_HEIGHT,
      scenes,
      audioTracks,
      captions,
    };
  }
}

export class HybridAlignmentStrategy implements AlignmentStrategy {
  private static readonly PLAYBACK_RATE = 0.92;

  private static readonly EFFECTS: SceneEffect[] = [
    "zoom-in",
    "zoom-out",
    "pan-left",
    "pan-right",
  ];

  private static readonly TRANSITIONS: VideoTransition["type"][] = [
    "fade",
    "wipe",
    "slide",
  ];

  align(context: AlignmentContext): RemotionVideoProps {
    const {
      segments,
      transcriptionResults,
      audioUrls,
      audioDurations,
      fps,
      fixedClipDuration,
    } = context;

    const clipDuration = fixedClipDuration ?? FIXED_CLIP_DURATION_SECONDS;

    // ── 1. Audio tracks ───────────────────────────────────────────────────────
    let totalAudioDurationSeconds = 0;
    const audioTracks: AudioTrackConfig[] = [];

    const safeAudioDurations = audioDurations ?? [];
    transcriptionResults.forEach((result, batchIndex) => {
      const durationSeconds = safeAudioDurations[batchIndex];
      if (durationSeconds == null || durationSeconds <= 0) {
        throw new Error(
          `[HybridAligner] audioDurations[${batchIndex}] is missing or zero.`,
        );
      }
      const durationFrames = Math.ceil(durationSeconds * fps);
      audioTracks.push({
        src: audioUrls[batchIndex],
        startFrame: Math.round(totalAudioDurationSeconds * fps),
        durationInFrames: durationFrames,
      });
      totalAudioDurationSeconds += durationSeconds;
    });

    // ── 2. Scenes ─────────────────────────────────────────────────────────────
    const scenes: VideoScene[] = [];

    const naturalDurationSeconds = clipDuration;
    const slowedDurationSeconds =
      naturalDurationSeconds / HybridAlignmentStrategy.PLAYBACK_RATE;
    const naturalFrames = Math.round(naturalDurationSeconds * fps);
    const slowedFrames = Math.round(slowedDurationSeconds * fps);
    const transitionFrames = slowedFrames - naturalFrames;

    let videoCount = 0;
    let imageCount = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const isLast = i === segments.length - 1;
      const hasVideo = !!seg.videoClipUrl;
      const transitionType =
        HybridAlignmentStrategy.TRANSITIONS[
          i % HybridAlignmentStrategy.TRANSITIONS.length
        ];
      const imageEffect =
        HybridAlignmentStrategy.EFFECTS[
          Math.floor(Math.random() * HybridAlignmentStrategy.EFFECTS.length)
        ];

      if (hasVideo) {
        videoCount++;
      } else {
        imageCount++;
      }

      scenes.push({
        id: seg.id,
        imageUrl: seg.imageUrl,
        videoClipUrl: hasVideo ? seg.videoClipUrl : undefined,
        startFrame: 0,
        durationInFrames: slowedFrames,
        effect: hasVideo ? "static" : imageEffect,
        playbackRate: hasVideo ? HybridAlignmentStrategy.PLAYBACK_RATE : undefined,
        transition: !isLast
          ? { type: transitionType, durationInFrames: transitionFrames }
          : undefined,
        textFragment: seg.text,
        debug: {
          startSeconds: 0,
          endSeconds: slowedDurationSeconds,
          durationSeconds: slowedDurationSeconds,
          naturalDurationSeconds,
          playbackRate: hasVideo ? HybridAlignmentStrategy.PLAYBACK_RATE : undefined,
          transitionFrames,
        },
      });
    }

    // ── 3. Total duration ─────────────────────────────────────────────────────
    const totalTransitionFrames = scenes
      .filter((s) => s.transition)
      .reduce((acc, s) => acc + (s.transition?.durationInFrames ?? 0), 0);
    const totalVideoFrames =
      scenes.reduce((acc, s) => acc + s.durationInFrames, 0) -
      totalTransitionFrames;

    const totalAudioFrames = Math.ceil(totalAudioDurationSeconds * fps);

    if (totalAudioFrames > totalVideoFrames) {
      throw new Error(
        `[HybridAligner] Audio (${totalAudioFrames}f / ${totalAudioDurationSeconds.toFixed(2)}s) exceeds video (${totalVideoFrames}f / ${(totalVideoFrames / fps).toFixed(2)}s). Segment count mismatch: ${scenes.length} scenes for ${totalAudioDurationSeconds.toFixed(2)}s of audio.`,
      );
    }

    const totalFrames = totalAudioFrames;

    // ── 4. Captions ───────────────────────────────────────────────────────────
    let globalTimeOffset = 0;
    const captions: Caption[] = [];

    transcriptionResults.forEach((result, batchIndex) => {
      const words: any[] = Array.isArray(result) ? result : result.words;
      const trackDurationSeconds =
        audioTracks[batchIndex].durationInFrames / fps;

      words.forEach((w) => {
        if (!w.text.trim()) return;
        captions.push({
          text: w.text,
          startMs: Math.round((globalTimeOffset + w.startMs / 1000) * 1000),
          endMs: Math.round((globalTimeOffset + w.endMs / 1000) * 1000),
        });
      });

      globalTimeOffset += trackDurationSeconds;
    });

    logger.info("Hybrid Alignment Complete.", {
      scenes: scenes.length,
      captions: captions.length,
      videoCount,
      imageCount,
      totalVideoFrames,
      totalAudioFrames,
      totalFrames,
      fps,
    });

    return {
      fps,
      durationInFrames: totalFrames,
      width: REMOTION_CROPPED_WIDTH,
      height: REMOTION_CROPPED_HEIGHT,
      scenes,
      audioTracks,
      captions,
    };
  }
}

// --- Main Export ---

export type AlignmentMode = "image" | "video" | "hybrid";

export function alignVideoProps(
  segments: {
    id: string;
    text: string;
    imageUrl: string;
    videoClipUrl?: string;
  }[],
  transcriptionResults: { words: Word[] }[],
  audioUrls: string[],
  audioDurations: number[] = [],
  videoDurations: number[] = [],
  fps: number = REMOTION_DEFAULT_FPS,
  mode: AlignmentMode = "video",
  videoVolume: number = 0.1,
  fixedClipDuration?: number,
): RemotionVideoProps {
  if (mode === "hybrid") {
    const strategy = new HybridAlignmentStrategy();
    return {
      ...strategy.align({
        segments,
        transcriptionResults,
        audioUrls,
        audioDurations,
        fps,
        fixedClipDuration: fixedClipDuration ?? FIXED_CLIP_DURATION_SECONDS,
      }),
      videoVolume,
    };
  }

  if (mode === "image") {
    const strategy = new PrecisionAlignmentStrategy();
    return {
      ...strategy.align({
        segments,
        transcriptionResults,
        audioUrls,
        audioDurations,
        fps,
      }),
      videoVolume,
    };
  }

  const strategy = new ContinuousAlignmentStrategy();
  return {
    ...strategy.align({
      segments,
      transcriptionResults,
      audioUrls,
      audioDurations,
      videoDurations,
      fps,
    }),
    videoVolume,
  };
}
