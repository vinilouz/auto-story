import { SimplexNoise } from "three/examples/jsm/math/SimplexNoise.js";

export function createSeededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = ((s * 1664525 + 1013904223) | 0) >>> 0;
    return s / 4294967296;
  };
}

export function createNoiseField(seed: number): SimplexNoise {
  const rng = createSeededRandom(seed);
  return new SimplexNoise({ random: rng });
}

export function sampleNoiseField(
  noise: SimplexNoise,
  x: number,
  y: number,
  z: number,
  time: number,
  scale: number,
  turbulence: number,
): [number, number, number] {
  const sx = x * scale;
  const sy = y * scale;
  const sz = z * scale + time;
  const nx = noise.noise3d(sx, sy, sz) * turbulence;
  const ny = noise.noise3d(sx + 100, sy, sz) * turbulence;
  const nz = noise.noise3d(sx, sy + 100, sz) * turbulence;
  return [nx, ny, nz];
}
