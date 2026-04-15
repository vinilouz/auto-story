export function calculateBarPositions(
  barCount: number,
  gap: number,
  maxWidth: number,
): { x: number; width: number }[] {
  if (barCount <= 0 || maxWidth <= 0) return [];

  const totalGap = gap * (barCount - 1);
  const barWidth = Math.max(0.01, (maxWidth - totalGap) / barCount);
  const startX = -maxWidth / 2 + barWidth / 2;

  const positions: { x: number; width: number }[] = [];
  for (let i = 0; i < barCount; i++) {
    positions.push({
      x: startX + i * (barWidth + gap),
      width: barWidth,
    });
  }
  return positions;
}

export function mapFrequencyToHeight(
  value: number,
  maxHeight: number,
  minHeight = 0.05,
): number {
  const clamped = Math.max(0, Math.min(1, value));
  return minHeight + clamped * (maxHeight - minHeight);
}

export function generateBarColor(
  index: number,
  total: number,
  baseColor: [number, number, number],
): [number, number, number] {
  if (total <= 1) return baseColor;

  const t = index / (total - 1);

  const warmBias = 1 - t * 0.3;
  const coolBias = 0.5 + t * 0.5;
  const brightnessBoost = 0.8 + Math.sin(t * Math.PI) * 0.2;

  return [
    Math.min(1, baseColor[0] * warmBias * brightnessBoost),
    Math.min(1, baseColor[1] * coolBias * brightnessBoost),
    Math.min(1, baseColor[2] * (0.3 + t * 0.7) * brightnessBoost),
  ];
}

export function parseHexColor(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "");
  const r = Number.parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = Number.parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = Number.parseInt(cleaned.substring(4, 6), 16) / 255;
  return [r, g, b];
}

export function calculateReflectionMatrix(
  yPosition: number,
  reflectionY: number,
): { scaleY: number; offsetY: number } {
  return {
    scaleY: -1,
    offsetY: -(yPosition - reflectionY) * 2,
  };
}

export function calculateBeatFlash(
  isBeat: boolean,
  intensity: number,
  decay: number,
): number {
  if (isBeat) return Math.min(1, 0.3 + intensity * 0.7);
  return Math.max(0, decay * 0.92);
}

export function computeInstanceTransforms(
  frequencies: number[],
  barPositions: { x: number; width: number }[],
  maxHeight: number,
  baseY: number,
  beatFlash: number,
  baseColor: [number, number, number],
): {
  matrices: Float32Array;
  colors: Float32Array;
  flashIntensities: Float32Array;
} {
  const count = Math.min(frequencies.length, barPositions.length);
  const matrices = new Float32Array(count * 16);
  const colors = new Float32Array(count * 3);
  const flashIntensities = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const height = mapFrequencyToHeight(frequencies[i], maxHeight);
    const pos = barPositions[i];

    const bassBias = i < count * 0.25 ? 1 + beatFlash * 0.5 : 1;
    const finalHeight = height * bassBias;

    const col = generateBarColor(i, count, baseColor);

    const m = matrices.subarray(i * 16, i * 16 + 16);
    m[0] = pos.width;
    m[5] = finalHeight;
    m[10] = 1;
    m[12] = pos.x;
    m[13] = baseY + finalHeight / 2;
    m[14] = 0;
    m[15] = 1;

    colors[i * 3] = col[0];
    colors[i * 3 + 1] = col[1];
    colors[i * 3 + 2] = col[2];

    flashIntensities[i] = i < count * 0.25 ? beatFlash : 0;
  }

  return { matrices, colors, flashIntensities };
}
