
import { AudioTrackConfig, RemotionVideoProps, VideoScene, SceneEffect, VideoTransition } from "./types";
import { REMOTION_DEFAULT_FPS, REMOTION_CROPPED_WIDTH, REMOTION_CROPPED_HEIGHT } from "@/remotion/constants";

// --- Interfaces & Types ---

interface Word {
  text: string;
  startMs: number;
  endMs: number;
}

interface FlattenedWord extends Word {
  originalIndex: number;
  batchIndex: number;
  globalStart: number;
  globalEnd: number;
}

interface AlignmentContext {
  segments: { id: string; text: string; imageUrl: string }[];
  transcriptionResults: { words: Word[] }[];
  audioUrls: string[];
  audioDurations?: number[];
  fps: number;
}

interface AlignmentStrategy {
  align(context: AlignmentContext): RemotionVideoProps;
}

// --- Helper Functions ---

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ").trim();
}

function isWordMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length > 3 && nb.length > 3 && levenshtein(na, nb) <= 2) return true;
  return false;
}


function findSegmentEnd(
  segmentText: string,
  words: FlattenedWord[],
  startWordIndex: number
): { index: number; score: number } {
  const normSeg = normalize(segmentText);
  const segWords = normSeg.split(" ").filter(Boolean);
  if (segWords.length === 0) return { index: -1, score: 0 };

  const N = Math.min(segWords.length, 5);
  const tail = segWords.slice(-N);

  const approxEnd = startWordIndex + segWords.length;
  const searchFrom = Math.max(startWordIndex, approxEnd - N - 5);
  const searchTo = Math.min(words.length - 1, approxEnd + N * 3);

  for (let i = searchTo; i >= searchFrom; i--) {
    if (!isWordMatch(words[i].text, tail[tail.length - 1])) continue;

    let matchCount = 1;
    for (let j = tail.length - 2; j >= 0; j--) {
      const pos = i - (tail.length - 1 - j);
      if (pos < startWordIndex) break;
      if (isWordMatch(words[pos].text, tail[j])) matchCount++;
    }

    const requiredMatches = Math.max(1, Math.floor(tail.length * 0.6));
    if (matchCount >= requiredMatches) {
      return { index: i, score: matchCount / tail.length };
    }
  }

  return { index: -1, score: 0 };
}

function findSegmentStartWithConfidence(
  segmentText: string,
  words: FlattenedWord[],
  startIndex: number
): { index: number; score: number } {
  const normSeg = normalize(segmentText);
  const segWords = normSeg.split(" ");
  if (segWords.length === 0) return { index: -1, score: 0 };

  const N = Math.min(segWords.length, 5);
  const head = segWords.slice(0, N);
  const searchLimit = words.length;

  // Try different starting positions in the segment text as potential anchors
  const maxAnchors = Math.min(segWords.length, 3);

  for (let anchorIdx = 0; anchorIdx < maxAnchors; anchorIdx++) {
    const head = segWords.slice(anchorIdx, anchorIdx + 5);
    if (head.length === 0) continue;

    for (let i = startIndex; i < searchLimit; i++) {
      if (!isWordMatch(words[i].text, head[0])) continue;

      let matchCount = 1;
      let misses = 0;

      for (let j = 1; j < head.length; j++) {
        if (i + j >= words.length) break;
        if (isWordMatch(words[i + j].text, head[j])) {
          matchCount++;
        } else {
          misses++;
          if (misses > 2) break; // Allow up to 2 misses for longer segments
        }
      }

      const requiredMatches = Math.max(1, Math.floor(head.length * 0.6));
      const score = matchCount / head.length;

      if (matchCount >= requiredMatches) {
        // If we matched an anchor that wasn't the first word, 
        // we should ideally subtract the duration of the words we skipped,
        // but for now, returning i is a good enough approximation for the 'start'.
        return { index: i, score };
      }
    }
  }

  return { index: -1, score: 0 };
}

// --- Strategies ---

export class PrecisionAlignmentStrategy implements AlignmentStrategy {
  private static EFFECTS: SceneEffect[] = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right'];
  private static TRANSITIONS: VideoTransition['type'][] = ['fade', 'wipe', 'slide'];
  private static TRANSITION_DURATION = 30; // Even number as requested

  align(context: AlignmentContext): RemotionVideoProps {
    const { segments, transcriptionResults, audioUrls, fps } = context;

    // 1. Pipeline Stage: Flatten Transcription
    // Audio plays fully from 0 to end. STRICT timings.
    const { allWords, audioTracks, totalAudioDurationSeconds } = this.flattenTranscription(transcriptionResults, audioUrls, fps, context.audioDurations);

    // 2. Pipeline Stage: Find Anchors (Time in Seconds)
    // Fuzzy search with confidence match. NO Gap Filling.
    const segmentTimings = this.findsegmentTimings(segments, allWords, totalAudioDurationSeconds);

    // 3. Pipeline Stage: Generate Scenes (Frame Conversions)
    // Add half-transition duration to maintain strict audio sync.
    const scenes = this.generateScenes(segments, segmentTimings, fps, totalAudioDurationSeconds);


    const captions = allWords.map(w => ({
      text: w.text,
      startMs: Math.round(w.globalStart * 1000),
      endMs: Math.round(w.globalEnd * 1000)
    }));

    const totalAudioDurationFrames = Math.ceil(totalAudioDurationSeconds * fps);

    // Debug Log
    console.log("[Video] Alignment Complete.", {
      scenes: scenes.length,
      captions: captions.length,
      durationFrames: totalAudioDurationFrames,
      durationSeconds: totalAudioDurationFrames / fps
    });

    return {
      fps,
      durationInFrames: totalAudioDurationFrames,
      width: REMOTION_CROPPED_WIDTH,
      height: REMOTION_CROPPED_HEIGHT,
      scenes,
      audioTracks,
      captions
    };
  }

  private flattenTranscription(
    transcriptionResults: { words: Word[] }[],
    audioUrls: string[],
    fps: number,
    audioDurations?: number[]
  ) {
    let globalTimeOffset = 0;
    const allWords: FlattenedWord[] = [];
    const audioTracks: AudioTrackConfig[] = [];

    transcriptionResults.forEach((result, batchIndex) => {
      const words = Array.isArray(result) ? result : (result.words || []);
      const lastWord = words[words.length - 1];

      let durationSeconds = 0;
      if (audioDurations && audioDurations[batchIndex]) {
        durationSeconds = audioDurations[batchIndex];
      } else {
        durationSeconds = lastWord ? lastWord.endMs / 1000 : 0;
      }

      const durationFrames = Math.ceil(durationSeconds * fps);

      audioTracks.push({
        src: audioUrls[batchIndex],
        startFrame: Math.round(globalTimeOffset * fps),
        durationInFrames: durationFrames
      });

      words.forEach((w, i) => {
        if (!w.text.trim()) return;
        const startSeconds = w.startMs / 1000;
        const endSeconds = w.endMs / 1000;
        allWords.push({
          ...w,
          start: startSeconds,
          end: endSeconds,
          originalIndex: i,
          batchIndex,
          globalStart: globalTimeOffset + startSeconds,
          globalEnd: globalTimeOffset + endSeconds
        });
      });

      globalTimeOffset += durationSeconds;
    });

    const totalAudioDurationSeconds = globalTimeOffset;

    return { allWords, audioTracks, totalAudioDurationSeconds };
  }

  private findsegmentTimings(
    segments: { id: string; text: string }[],
    allWords: FlattenedWord[],
    totalDuration: number
  ) {
    const timings: { start: number; end: number; confidence: number; found: boolean }[] = [];
    let searchStartWordIndex = 0;

    for (let i = 0; i < segments.length; i++) {
      const isFirst = i === 0;
      const isLast = i === segments.length - 1;

      let startSeconds: number;
      let startWordIndex: number;
      let startConfidence: number;

      if (isFirst) {
        startSeconds = 0;
        startWordIndex = 0;
        startConfidence = 1;
      } else {
        const match = findSegmentStartWithConfidence(segments[i].text, allWords, searchStartWordIndex);
        if (match.index !== -1) {
          startWordIndex = match.index;
          startSeconds = allWords[match.index].globalStart;
          startConfidence = match.score;
          searchStartWordIndex = match.index;
        } else {
          console.warn(`[Aligner] Start not found for ${segments[i].id}: "${segments[i].text.substring(0, 30)}"`);
          timings.push({ start: -1, end: -1, confidence: 0, found: false });
          continue;
        }
      }

      let endSeconds: number;
      let endConfidence: number;

      if (isLast) {
        endSeconds = totalDuration;
        endConfidence = 1;
      } else {
        const endMatch = findSegmentEnd(segments[i].text, allWords, startWordIndex);
        if (endMatch.index !== -1) {
          endSeconds = allWords[endMatch.index].globalEnd;
          endConfidence = endMatch.score;
        } else {
          console.warn(`[Aligner] End not found for ${segments[i].id}, will be resolved in gap fill.`);
          endSeconds = -1;
          endConfidence = 0;
        }
      }

      timings.push({
        start: startSeconds,
        end: endSeconds,
        confidence: (startConfidence + endConfidence) / 2,
        found: startSeconds !== -1 && endSeconds !== -1
      });
    }

    // Gap fill: resolve any timings where end or start was not found
    for (let i = 0; i < timings.length; i++) {
      if (timings[i].found) continue;

      let prevEnd = 0;
      for (let k = i - 1; k >= 0; k--) {
        if (timings[k].found) { prevEnd = timings[k].end; break; }
      }

      let nextStart = totalDuration;
      for (let j = i + 1; j < timings.length; j++) {
        if (timings[j].found) { nextStart = timings[j].start; break; }
      }

      const missingInGap: number[] = [];
      for (let k = i; k < timings.length; k++) {
        if (!timings[k].found) missingInGap.push(k);
        else break;
      }

      const perSlot = (nextStart - prevEnd) / missingInGap.length;
      missingInGap.forEach((idx, pos) => {
        timings[idx].start = prevEnd + pos * perSlot;
        timings[idx].end = prevEnd + (pos + 1) * perSlot;
        timings[idx].found = true;
      });
    }

    for (const t of timings) {
      if (t.end < t.start) t.end = t.start;
    }

    return timings;
  }

  private generateScenes(
    segments: { id: string; imageUrl?: string; text?: string }[],
    timings: { start: number; end: number; confidence: number }[],
    fps: number,
    totalAudioDurationSeconds: number
  ): VideoScene[] {
    const scenes: VideoScene[] = [];
    const TRANSITION_FRAMES = PrecisionAlignmentStrategy.TRANSITION_DURATION;
    const HALF_TRANSITION = TRANSITION_FRAMES / 2;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const timing = timings[i];

      const startSeconds = timing.start;
      const endSeconds = timing.end;

      // Logical Duration (Audio Time)
      // If segment was not found (start = -1), its logical duration is 0.
      let logicalDurationFrames = 0;
      if (startSeconds !== -1) {
        logicalDurationFrames = Math.round((endSeconds - startSeconds) * fps);
      }

      const isFirst = i === 0;
      const isLast = i === segments.length - 1;

      const effect = PrecisionAlignmentStrategy.EFFECTS[i % PrecisionAlignmentStrategy.EFFECTS.length];
      const transitionType = PrecisionAlignmentStrategy.TRANSITIONS[i % PrecisionAlignmentStrategy.TRANSITIONS.length];

      // Determine if this scene has an incoming or outgoing transition
      // A scene has an outgoing transition if it's not the last scene.
      // A scene has an incoming transition if it's not the first scene.
      let hasTransitionOut = !isLast;
      let hasTransitionIn = !isFirst;

      // Projected duration with full transition padding
      // needed to see if we satisfy the minimum requirements
      const paddingIn = hasTransitionIn ? HALF_TRANSITION : 0;
      const paddingOut = hasTransitionOut ? HALF_TRANSITION : 0;
      const projectedDuration = logicalDurationFrames + paddingIn + paddingOut;

      // Safeguard: If scene is too short for transitions, disable them to prevent Remotion crash.
      // Remotion requires Sequence Duration >= Transition Duration.
      // We use a stricter check (<= 32) to ensure we have at least a tiny bit of content (2 frames)
      // plus the transitions. This handles floating point rounding issues and creates a safety buffer.
      if (projectedDuration <= TRANSITION_FRAMES + 2) {
        // Scene too short! Abort transitions.
        hasTransitionIn = false;
        hasTransitionOut = false;

        // Retroactively remove transition from previous scene if it existed
        // because we can't accept it anymore.
        if (i > 0) {
          const prevScene = scenes[i - 1];
          if (prevScene.transition) {
            prevScene.transition = undefined;
            prevScene.durationInFrames -= HALF_TRANSITION;
            if (prevScene.durationInFrames < TRANSITION_FRAMES) prevScene.durationInFrames = TRANSITION_FRAMES;
          }
        }
      }

      let finalDuration = logicalDurationFrames;
      if (hasTransitionIn) finalDuration += HALF_TRANSITION;
      if (hasTransitionOut) finalDuration += HALF_TRANSITION;

      // Sanity check: ensure duration is at least 1 frame
      if (finalDuration < 1) finalDuration = 1;

      // `startFrame` is primarily for metadata or if not using TransitionSeries.
      // For TransitionSeries, Remotion handles the actual visual positioning based on durations.
      const startFrame = 0; // Placeholder, actual visual start handled by TransitionSeries

      scenes.push({
        id: seg.id,
        imageUrl: seg.imageUrl || "",
        startFrame,
        durationInFrames: Math.round(finalDuration),
        effect,
        transition: hasTransitionOut ? { // Only define transition if there's an outgoing one
          type: transitionType,
          durationInFrames: TRANSITION_FRAMES
        } : undefined,
        textFragment: seg.text,
        debug: {
          startSeconds,
          endSeconds,
          durationSeconds: endSeconds - startSeconds,
          confidence: timing.confidence // Add confidence here
        } as any // Cast to any to allow adding confidence without strict type definition update
      });
    }

    return scenes;
  }
}

// --- Main Export ---

export function alignVideoProps(
  segments: { id: string; text: string; imageUrl: string }[],
  transcriptionResults: { words: Word[] }[],
  audioUrls: string[],
  audioDurations: number[] = [],
  fps: number = REMOTION_DEFAULT_FPS
): RemotionVideoProps {
  const strategy = new PrecisionAlignmentStrategy();
  return strategy.align({
    segments,
    transcriptionResults,
    audioUrls,
    audioDurations,
    fps
  });
}
