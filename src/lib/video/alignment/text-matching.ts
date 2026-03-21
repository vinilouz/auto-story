export interface Word {
  text: string;
  startMs: number;
  endMs: number;
}

export interface FlattenedWord extends Word {
  originalIndex: number;
  batchIndex: number;
  globalStart: number;
  globalEnd: number;
}

export function levenshtein(a: string, b: string): number {
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
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]|_/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isWordMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length > 3 && nb.length > 3 && levenshtein(na, nb) <= 2) return true;
  return false;
}

export function findSegmentEnd(
  segmentText: string,
  words: FlattenedWord[],
  startWordIndex: number,
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

export function findSegmentStartWithConfidence(
  segmentText: string,
  words: FlattenedWord[],
  startIndex: number,
): { index: number; score: number } {
  const normSeg = normalize(segmentText);
  const segWords = normSeg.split(" ");
  if (segWords.length === 0) return { index: -1, score: 0 };

  const N = Math.min(segWords.length, 5);
  const searchLimit = words.length;

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
          if (misses > 2) break; 
        }
      }

      const requiredMatches = Math.max(1, Math.floor(head.length * 0.6));
      const score = matchCount / head.length;

      if (matchCount >= requiredMatches) {
        return { index: i, score };
      }
    }
  }

  return { index: -1, score: 0 };
}
