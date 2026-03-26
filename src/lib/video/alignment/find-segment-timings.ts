import { createLogger } from "../../logger";
import {
  findSegmentEnd,
  findSegmentStartWithConfidence,
  type FlattenedWord,
} from "./text-matching";

const logger = createLogger("aligner");

export function findSegmentTimingsWithConfidence(
  segments: { id: string; text: string }[],
  allWords: FlattenedWord[],
  totalDuration: number,
) {
  const timings: {
    start: number;
    end: number;
    confidence: number;
    found: boolean;
  }[] = [];
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
      const match = findSegmentStartWithConfidence(
        segments[i].text,
        allWords,
        searchStartWordIndex,
      );
      if (match.index !== -1) {
        startWordIndex = match.index;
        startSeconds = allWords[match.index].globalStart;
        startConfidence = match.score;
        searchStartWordIndex = match.index;
      } else {
        logger.warn(
          `Start not found for ${segments[i].id}: "${segments[i].text.substring(0, 30)}"`,
        );
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
      const endMatch = findSegmentEnd(
        segments[i].text,
        allWords,
        startWordIndex,
      );
      if (endMatch.index !== -1) {
        endSeconds = allWords[endMatch.index].globalEnd;
        endConfidence = endMatch.score;
      } else {
        logger.warn(
          `End not found for ${segments[i].id}, will be resolved in gap fill.`,
        );
        endSeconds = -1;
        endConfidence = 0;
      }
    }

    timings.push({
      start: startSeconds,
      end: endSeconds,
      confidence: (startConfidence + endConfidence) / 2,
      found: startSeconds !== -1 && endSeconds !== -1,
    });
  }

  // Gap fill: resolve any timings where end or start was not found
  for (let i = 0; i < timings.length; i++) {
    if (timings[i].found) continue;

    let prevEnd = 0;
    for (let k = i - 1; k >= 0; k--) {
      if (timings[k].found) {
        prevEnd = timings[k].end;
        break;
      }
    }

    let nextStart = totalDuration;
    for (let j = i + 1; j < timings.length; j++) {
      if (timings[j].found) {
        nextStart = timings[j].start;
        break;
      }
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

export function findSegmentTimingsSimple(
  segments: { id: string; text: string }[],
  allWords: FlattenedWord[],
  totalDuration: number,
) {
  const starts: number[] = [];
  let searchFrom = 0;

  for (let i = 0; i < segments.length; i++) {
    if (i === 0) {
      starts.push(0);
      continue;
    }

    const match = findSegmentStartWithConfidence(
      segments[i].text,
      allWords,
      searchFrom,
    );
    if (match.index !== -1) {
      starts.push(allWords[match.index].globalStart);
      searchFrom = match.index;
    } else {
      starts.push(-1);
    }
  }

  const timings: { start: number; end: number; confidence: number }[] = [];

  for (let i = 0; i < segments.length; i++) {
    const start = starts[i] !== -1 ? starts[i] : i > 0 ? timings[i - 1].end : 0;
    const end =
      i < segments.length - 1
        ? starts[i + 1] !== -1
          ? starts[i + 1]
          : totalDuration
        : totalDuration;

    timings.push({ start, end: Math.max(end, start), confidence: 1 });
  }

  return timings;
}
