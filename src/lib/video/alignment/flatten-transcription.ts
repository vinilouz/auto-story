import type { AudioTrackConfig } from "../types";
import type { FlattenedWord, Word } from "./text-matching";

export function flattenTranscription(
  transcriptionResults: { words?: Word[] }[],
  audioUrls: string[],
  fps: number,
  audioDurations?: number[],
) {
  let globalTimeOffset = 0;
  const allWords: FlattenedWord[] = [];
  const audioTracks: AudioTrackConfig[] = [];

  transcriptionResults.forEach((result, batchIndex) => {
    // handle varying formats
    const words = Array.isArray(result) ? result : result.words || [];
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
      durationInFrames: durationFrames,
    });

    words.forEach((w: Word, i: number) => {
      if (!w.text.trim()) return;
      const startSeconds = w.startMs / 1000;
      const endSeconds = w.endMs / 1000;
      
      allWords.push({
        ...w,
        originalIndex: i,
        batchIndex,
        globalStart: globalTimeOffset + startSeconds,
        globalEnd: globalTimeOffset + endSeconds,
      });
    });

    globalTimeOffset += durationSeconds;
  });

  return { 
    allWords, 
    audioTracks, 
    totalAudioDurationSeconds: globalTimeOffset 
  };
}
