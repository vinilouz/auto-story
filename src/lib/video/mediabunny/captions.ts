import type { Caption } from "../types";

interface PositionedWord {
  text: string;
  x: number;
}

export function renderCaptions(
  ctx: OffscreenCanvasRenderingContext2D,
  captions: Caption[],
  currentMs: number,
): void {
  const active = captions.find(
    (c) => currentMs >= c.startMs && currentMs <= c.endMs,
  );
  if (!active) return;

  const words = active.text.split(" ");
  const wordDuration = (active.endMs - active.startMs) / words.length;
  const currentWordIndex = Math.min(
    Math.floor((currentMs - active.startMs) / wordDuration),
    words.length - 1,
  );

  ctx.textAlign = "center";
  ctx.font = "bold 52px -apple-system, BlinkMacSystemFont, sans-serif";

  const maxWidth = ctx.canvas.width * 0.85;
  const lines = wrapText(ctx, words, maxWidth);
  const lineHeight = 70;

  const totalHeight = lines.length * lineHeight;
  let y = ctx.canvas.height - 180 - totalHeight / 2;

  let wordIdx = 0;
  for (const line of lines) {
    for (const word of line) {
      const isHighlighted = wordIdx === currentWordIndex;

      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillText(word.text, word.x + 3, y + 3);

      ctx.fillStyle = isHighlighted ? "#FFD700" : "#FFFFFF";
      ctx.fillText(word.text, word.x, y);

      wordIdx++;
    }
    y += lineHeight;
  }
}

function wrapText(
  ctx: OffscreenCanvasRenderingContext2D,
  words: string[],
  maxWidth: number,
): PositionedWord[][] {
  const lines: PositionedWord[][] = [];
  let currentLine: PositionedWord[] = [];
  let currentLineWidth = 0;

  for (const word of words) {
    const wordWidth = ctx.measureText(word).width;
    const spaceWidth = ctx.measureText(" ").width;

    if (currentLineWidth + wordWidth + spaceWidth > maxWidth && currentLine.length > 0) {
      lines.push(centerLine(currentLine, ctx.canvas.width));
      currentLine = [];
      currentLineWidth = 0;
    }

    currentLine.push({ text: word, x: 0 });
    currentLineWidth += wordWidth + spaceWidth;
  }

  if (currentLine.length > 0) {
    lines.push(centerLine(currentLine, ctx.canvas.width));
  }

  return lines;
}

function centerLine(
  line: PositionedWord[],
  canvasWidth: number,
): PositionedWord[] {
  const ctx = new OffscreenCanvas(1, 1).getContext("2d")!;
  ctx.font = "bold 52px -apple-system, BlinkMacSystemFont, sans-serif";

  let totalWidth = 0;
  for (const word of line) {
    totalWidth += ctx.measureText(word.text).width;
  }
  totalWidth += ctx.measureText(" ").width * (line.length - 1);

  let x = (canvasWidth - totalWidth) / 2;
  const result: PositionedWord[] = [];

  for (let i = 0; i < line.length; i++) {
    result.push({ text: line[i].text, x });
    x += ctx.measureText(line[i].text).width + ctx.measureText(" ").width;
  }

  return result;
}
