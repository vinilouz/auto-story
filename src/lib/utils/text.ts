import { createLogger } from "../logger";
import type {
  Segment,
  TranscriptionResult,
  TranscriptionWord,
} from "../flows/types";

const log = createLogger("utils/text");

export async function getTranscription(
  url: string,
): Promise<TranscriptionWord[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load transcription: ${url}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : data.words || []).map(
    (w: { text?: string; word?: string; startMs?: number; start?: number; endMs?: number; end?: number }) => ({
      text: w.text ?? w.word,
      startMs: w.startMs ?? w.start,
      endMs: w.endMs ?? w.end,
    }),
  );
}

const PROTECTED_ABBREVIATIONS = [
  "dr.",
  "dra.",
  "sr.",
  "sra.",
  "exmo.",
  "exma.",
  "v.s.a.",
  "n.a.",
];

const cleanText = (text: string): string => {
  return text
    .replace(/\s+/g, " ") // Remove multiple whitespaces
    .replace(/\n+/g, " ") // Remove newlines
    .replace(/\t+/g, " ") // Remove tabs
    .trim();
};

const shouldBreakAtChar = (text: string, index: number): boolean => {
  const char = text[index];

  if (char === ";") return true;

  if (char === ".") {
    // Don't break at ellipsis
    if (index > 0 && text[index - 1] === ".") return false;
    if (index < text.length - 1 && text[index + 1] === ".") return false;

    // Don't break at period followed by quotes
    if (index < text.length - 1 && text[index + 1] === '"') return false;

    // Check for protected abbreviations
    const context = text
      .substring(Math.max(0, index - 4), index + 1)
      .toLowerCase();
    if (PROTECTED_ABBREVIATIONS.some((abbr) => context.includes(abbr))) {
      return false;
    }

    return true;
  }

  return false;
};

export function splitBySentences(text: string, maxLength: number): string[] {
  if (!text.trim()) return [];

  const segments: string[] = [];
  let currentText = cleanText(text);
  log.info("Cleaned text length:", { length: currentText.length });

  while (currentText.length > 0) {
    if (currentText.length <= maxLength) {
      segments.push(currentText.trim());
      break;
    }

    let nextStop = -1;
    for (let i = maxLength; i < currentText.length; i++) {
      if (shouldBreakAtChar(currentText, i)) {
        nextStop = i + 1;
        break;
      }
    }

    if (nextStop === -1) {
      segments.push(currentText.trim());
      break;
    }

    const segment = currentText.substring(0, nextStop).trim();
    segments.push(segment);

    currentText = currentText.substring(nextStop).trim();
  }

  return segments.filter((segment) => segment.length > 0);
}

export function splitIntoBatches(
  text: string,
  maxLength: number = 2000,
  header: string = "",
): string[] {
  // Normalize line endings
  const normalizedText = text.replace(/\r\n/g, "\n").trim();

  // Header handling
  const effectiveMaxLength = maxLength - (header ? header.length + 2 : 0); // +2 for \n\n
  if (effectiveMaxLength <= 100) {
    log.warn(
      "Header is too long for the maxLength, minimal space left for content.",
    );
  }

  // Split into logical lines (assuming input format has one speaker segment per line/block)
  // We filter out empty lines to avoid noise
  const lines = normalizedText.split("\n").filter((l) => l.trim().length > 0);

  const batches: string[] = [];
  let currentBatch = "";

  const speakerRegex = /^([a-zA-Z0-9\-_]+):\s*(.+)/;
  let currentSpeaker = ""; // Context for current line/block

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check for speaker change
    const match = trimmedLine.match(speakerRegex);
    if (match) {
      currentSpeaker = match[1];
    }

    // Determine if adding this line would exceed effectiveMaxLength
    // +1 for the newline check if we join with \n or space
    if (currentBatch.length + trimmedLine.length + 1 <= effectiveMaxLength) {
      currentBatch += (currentBatch ? "\n" : "") + trimmedLine;
    } else {
      // Adding this line would overflow.
      if (currentBatch.length > 0) {
        batches.push(header ? `${header}\n\n${currentBatch}` : currentBatch);
        currentBatch = "";
      }

      // Now checks if the line fits in an empty batch
      if (trimmedLine.length <= effectiveMaxLength) {
        currentBatch = trimmedLine;
      } else {
        // The line itself is larger than effectiveMaxLength. We must split it hard (preserving context).
        let remainingLine = trimmedLine;
        // The line likely starts with "speaker: ...".
        // If it continues in chunks, we must prepend "speaker: " to chunks.

        // Re-detect speaker for this specific line (it should match since we are here)
        // But if it was a continuation line (no speaker prefix), use `currentSpeaker`.
        let linePrefix = "";
        if (match) {
          linePrefix = match[1] + ": "; // "narrator: "
        } else if (currentSpeaker) {
          linePrefix = currentSpeaker + ": ";
        }

        // Loop to chop the giant line
        while (remainingLine.length > 0) {
          const prefixToUse =
            remainingLine !== trimmedLine && linePrefix ? linePrefix : "";
          const availableSpace = effectiveMaxLength - prefixToUse.length;

          if (remainingLine.length <= availableSpace) {
            // Fits!
            currentBatch = prefixToUse + remainingLine;
            break; // Done with this line
          }

          // Split needed
          let splitIndex = -1;
          const searchRegion = remainingLine.substring(0, availableSpace);

          // Intelligent split (punctuation)
          const lastPunc = Math.max(
            searchRegion.lastIndexOf("."),
            searchRegion.lastIndexOf("!"),
            searchRegion.lastIndexOf("?"),
          );

          if (lastPunc > availableSpace * 0.5) {
            splitIndex = lastPunc + 1;
          } else {
            const lastSpace = searchRegion.lastIndexOf(" ");
            splitIndex = lastSpace > -1 ? lastSpace : availableSpace;
          }

          const part = remainingLine.substring(0, splitIndex).trim();
          remainingLine = remainingLine.substring(splitIndex).trim();

          const batchContent = prefixToUse + part;
          batches.push(header ? `${header}\n\n${batchContent}` : batchContent);
          // Continues loop with remainingLine
        }
      }
    }
  }

  if (currentBatch) {
    batches.push(header ? `${header}\n\n${currentBatch}` : currentBatch);
  }

  return batches;
}

export async function splitTranscriptionByDuration(
  transcriptionResults: TranscriptionResult[],
  clipDurationSec: number,
  audioDurationsMs: number[],
): Promise<Segment[]> {
  const validResult = transcriptionResults.find(
    (r) => r.status === "completed" && r.transcriptionUrl,
  );

  if (!validResult?.transcriptionUrl) return [];

  const words = await getTranscription(validResult.transcriptionUrl);

  if (words.length === 0) return [];

  const totalDurationMs = audioDurationsMs.reduce((a, b) => a + b, 0);
  const clipDurationMs = clipDurationSec * 1000;
  const numSegments = Math.ceil(totalDurationMs / clipDurationMs);

  const segments: Segment[] = [];

  for (let i = 0; i < numSegments; i++) {
    const windowStart = i * clipDurationMs;
    const windowEnd = (i + 1) * clipDurationMs;

    const wordsInWindow = words.filter(
      (w) => w.startMs >= windowStart && w.startMs < windowEnd,
    );

    const text =
      wordsInWindow
        .map((w) => w.text)
        .join(" ")
        .trim() || `[Segment ${i + 1}]`;

    segments.push({
      id: crypto.randomUUID(),
      text,
      startMs: wordsInWindow.length > 0 ? wordsInWindow[0].startMs : windowStart,
      endMs:
        wordsInWindow.length > 0
          ? wordsInWindow[wordsInWindow.length - 1].endMs
          : Math.min(windowEnd, totalDurationMs),
    } as Segment);
  }

  return segments;
}

export function splitWordsIntoSegments(
  words: TranscriptionWord[],
  maxLength: number,
): Segment[] {
  if (words.length === 0) return [];

  const segments: Segment[] = [];
  let currentWords: TranscriptionWord[] = [];

  for (const word of words) {
    const currentText = currentWords.map((w) => w.text).join(" ");
    const potentialText = currentText
      ? `${currentText} ${word.text}`
      : word.text;

    if (potentialText.length <= maxLength) {
      currentWords.push(word);
    } else {
      if (currentWords.length > 0) {
        segments.push({
          id: crypto.randomUUID(),
          text: currentWords.map((w) => w.text).join(" "),
          startMs: currentWords[0].startMs,
          endMs: currentWords[currentWords.length - 1].endMs,
        } as Segment);
      }
      currentWords = [word];
    }
  }

  if (currentWords.length > 0) {
    segments.push({
      id: crypto.randomUUID(),
      text: currentWords.map((w) => w.text).join(" "),
      startMs: currentWords[0].startMs,
      endMs: currentWords[currentWords.length - 1].endMs,
    } as Segment);
  }

  return segments;
}
