import { TranscriptionWord } from "@/lib/flows/types"

export interface TranscriptionSegment {
  text: string
  startMs: number
  endMs: number
}

export function splitByTranscriptionTime(
  words: TranscriptionWord[],
  clipDurationMs: number
): TranscriptionSegment[] {
  if (words.length === 0) return []

  const segments: TranscriptionSegment[] = []
  let currentWords: TranscriptionWord[] = []
  let segmentStartMs = words[0].startMs
  let nextBoundary = segmentStartMs + clipDurationMs

  for (const word of words) {
    if (word.startMs >= nextBoundary && currentWords.length > 0) {
      segments.push({
        text: currentWords.map(w => w.text).join(' '),
        startMs: segmentStartMs,
        endMs: currentWords[currentWords.length - 1].endMs
      })
      segmentStartMs = word.startMs
      nextBoundary = segmentStartMs + clipDurationMs
      currentWords = []
    }
    currentWords.push(word)
  }

  if (currentWords.length > 0) {
    segments.push({
      text: currentWords.map(w => w.text).join(' '),
      startMs: segmentStartMs,
      endMs: currentWords[currentWords.length - 1].endMs
    })
  }

  return segments
}
