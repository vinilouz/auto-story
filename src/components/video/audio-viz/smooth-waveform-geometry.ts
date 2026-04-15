import { parseHexColor } from "./pro-spectrum-geometry";

export function catmullRomPoint(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
  tension: number,
): number {
  const s = (1 - tension) / 2;
  const t2 = t * t;
  const t3 = t2 * t;

  const m0 = s * (p2 - p0);
  const m1 = s * (p3 - p1);

  const a = 2 * t3 - 3 * t2 + 1;
  const b = t3 - 2 * t2 + t;
  const c = -2 * t3 + 3 * t2;
  const d = t3 - t2;

  return a * p1 + b * m0 + c * p2 + d * m1;
}

export function interpolateCatmullRom(
  points: number[],
  subdivisions: number,
  tension: number,
): number[] {
  if (points.length < 2) return points;
  if (subdivisions <= 0) return points;

  const result: number[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[Math.min(points.length - 1, i + 1)];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    for (let s = 0; s < subdivisions; s++) {
      const t = s / subdivisions;
      result.push(catmullRomPoint(p0, p1, p2, p3, t, tension));
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

export function generateFrequencyGradient(
  pointCount: number,
  baseColor: [number, number, number],
  mode: "frequency" | "amplitude" | "fixed",
  amplitudes?: number[],
): Float32Array {
  const colors = new Float32Array(pointCount * 3);

  for (let i = 0; i < pointCount; i++) {
    const t = pointCount > 1 ? i / (pointCount - 1) : 0;

    let r: number;
    let g: number;
    let b: number;

    if (mode === "fixed") {
      r = baseColor[0];
      g = baseColor[1];
      b = baseColor[2];
    } else if (mode === "amplitude") {
      const amp = amplitudes?.[i] ?? 0;
      const brightness = 0.3 + amp * 0.7;
      r = baseColor[0] * brightness;
      g = baseColor[1] * brightness;
      b = baseColor[2] * brightness;
    } else {
      r = baseColor[0] * (1 - t * 0.4) + t * 0.2;
      g = baseColor[1] * (0.6 + t * 0.4);
      b = baseColor[2] + t * 0.6;

      const brightness = 0.7 + Math.sin(t * Math.PI) * 0.3;
      r *= brightness;
      g *= brightness;
      b *= brightness;
    }

    colors[i * 3] = Math.min(1, Math.max(0, r));
    colors[i * 3 + 1] = Math.min(1, Math.max(0, g));
    colors[i * 3 + 2] = Math.min(1, Math.max(0, b));
  }

  return colors;
}

export function computeWaveformPoints(
  frequencies: number[],
  viewWidth: number,
  positionY: number,
  maxHeight: number,
  subdivisions: number,
  tension: number,
  beatPulse: number,
): Float32Array {
  if (frequencies.length === 0) return new Float32Array(0);

  const interpolated = interpolateCatmullRom(
    frequencies,
    subdivisions,
    tension,
  );
  const count = interpolated.length;
  if (count === 0) return new Float32Array(0);
  const positions = new Float32Array(count * 3);

  const pulseExpansion = beatPulse * maxHeight * 0.3;
  const xDivisor = Math.max(1, count - 1);

  for (let i = 0; i < count; i++) {
    const x = (i / xDivisor - 0.5) * viewWidth;
    const amplitude = interpolated[i];
    const height = amplitude * maxHeight + amplitude * pulseExpansion;
    positions[i * 3] = x;
    positions[i * 3 + 1] = positionY + height;
    positions[i * 3 + 2] = 0;
  }

  return positions;
}

export function computeLineColors(
  pointCount: number,
  color: string,
  colorMapping: "frequency" | "amplitude" | "fixed",
  amplitudes: number[],
): Float32Array {
  const baseColor = parseHexColor(color);
  return generateFrequencyGradient(
    pointCount,
    baseColor,
    colorMapping,
    amplitudes,
  );
}

export function calculateBeatPulse(
  isBeat: boolean,
  intensity: number,
  currentPulse: number,
): number {
  if (isBeat) return Math.min(1, 0.4 + intensity * 0.6);
  return Math.max(0, currentPulse * 0.9);
}

export function getPositionY(
  position: "center" | "bottom" | "top",
  viewportHeight: number,
): number {
  const halfH = viewportHeight / 2;
  switch (position) {
    case "bottom":
      return -halfH + 1;
    case "top":
      return halfH - 1;
    case "center":
      return 0;
  }
}
