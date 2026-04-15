import type { SimplexNoise } from "three/examples/jsm/math/SimplexNoise.js";
import type { AudioParticlesConfig } from "@/lib/video/types";

export type FrequencyBand = "bass" | "mid" | "treble";

export interface ParticleBuffers {
  positions: Float32Array;
  velocities: Float32Array;
  ages: Float32Array;
  maxAges: Float32Array;
  sizes: Float32Array;
  colors: Float32Array;
  bands: FrequencyBand[];
}

export function initializeParticles(
  count: number,
  rng: () => number,
): ParticleBuffers {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const ages = new Float32Array(count);
  const maxAges = new Float32Array(count);
  const sizes = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const bands: FrequencyBand[] = new Array(count);

  for (let i = 0; i < count; i++) {
    resetParticle(
      i,
      positions,
      velocities,
      ages,
      maxAges,
      sizes,
      colors,
      bands,
      rng,
    );
  }

  return { positions, velocities, ages, maxAges, sizes, colors, bands };
}

export const BAND_COLORS: Record<FrequencyBand, [number, number, number]> = {
  bass: [1.0, 0.4, 0.1],
  mid: [1.0, 0.9, 0.2],
  treble: [0.2, 0.6, 1.0],
};

function resetParticle(
  i: number,
  positions: Float32Array,
  velocities: Float32Array,
  ages: Float32Array,
  maxAges: Float32Array,
  sizes: Float32Array,
  colors: Float32Array,
  bands: FrequencyBand[],
  rng: () => number,
) {
  const theta = rng() * Math.PI * 2;
  const phi = Math.acos(2 * rng() - 1);
  const r = 2 + rng() * 4;

  const i3 = i * 3;
  positions[i3] = r * Math.sin(phi) * Math.cos(theta);
  positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5;
  positions[i3 + 2] = (rng() - 0.5) * 2;

  velocities[i3] = 0;
  velocities[i3 + 1] = 0;
  velocities[i3 + 2] = 0;

  ages[i] = rng() * 3;
  maxAges[i] = 2 + rng() * 4;
  sizes[i] = 0.5 + rng() * 1.5;

  const bandIndex = Math.floor(rng() * 3);
  const band: FrequencyBand =
    bandIndex === 0 ? "bass" : bandIndex === 1 ? "mid" : "treble";
  bands[i] = band;
  const bandColor = BAND_COLORS[band];
  colors[i3] = bandColor[0];
  colors[i3 + 1] = bandColor[1];
  colors[i3 + 2] = bandColor[2];
}

export function updateParticles(
  buffers: ParticleBuffers,
  noise: SimplexNoise,
  time: number,
  deltaTime: number,
  config: AudioParticlesConfig,
  bassEnergy: number,
  midEnergy: number,
  trebleEnergy: number,
): void {
  const { positions, velocities, ages, maxAges, sizes, colors, bands } =
    buffers;
  const count = ages.length;
  const turbulence = config.turbulence * (1 + bassEnergy * 3);
  const sizeMod = 1 + midEnergy * 2;

  for (let i = 0; i < count; i++) {
    ages[i] += deltaTime;
    if (ages[i] >= maxAges[i]) {
      resetParticle(
        i,
        positions,
        velocities,
        ages,
        maxAges,
        sizes,
        colors,
        bands,
        Math.random,
      );
      ages[i] = 0;
      continue;
    }

    const i3 = i * 3;
    const [nx, ny, nz] = sampleNoise(
      noise,
      positions[i3],
      positions[i3 + 1],
      positions[i3 + 2],
      time,
      config.noiseScale,
      turbulence,
    );

    velocities[i3] += nx * deltaTime;
    velocities[i3 + 1] += ny * deltaTime;
    velocities[i3 + 2] += nz * deltaTime;

    velocities[i3] *= 0.98;
    velocities[i3 + 1] *= 0.98;
    velocities[i3 + 2] *= 0.98;

    positions[i3] += velocities[i3];
    positions[i3 + 1] += velocities[i3 + 1];
    positions[i3 + 2] += velocities[i3 + 2];

    sizes[i] = (0.5 + trebleEnergy * 1.5) * sizeMod;
  }
}

function sampleNoise(
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
  return [
    noise.noise3d(sx, sy, sz) * turbulence,
    noise.noise3d(sx + 100, sy, sz) * turbulence,
    noise.noise3d(sx, sy + 100, sz) * turbulence,
  ];
}

export type BeatType = "kick" | "snare" | "hihat" | null;

export function classifyBeat(
  bands: { subBass: number; bass: number; highMid: number; brilliance: number },
  isBeat: boolean,
): BeatType {
  if (!isBeat) return null;
  const bassScore = (bands.subBass + bands.bass) / 2;
  const snareScore = bands.highMid;
  const hihatScore = bands.brilliance;
  const max = Math.max(bassScore, snareScore, hihatScore);
  if (bassScore === max) return "kick";
  if (snareScore === max) return "snare";
  return "hihat";
}

export function beatTypeToBand(beatType: BeatType): FrequencyBand {
  if (!beatType) return "bass";
  switch (beatType) {
    case "kick":
      return "bass";
    case "snare":
      return "mid";
    case "hihat":
      return "treble";
  }
}

export function emitBurst(
  buffers: ParticleBuffers,
  beatType: BeatType,
  config: AudioParticlesConfig,
): void {
  if (!beatType) return;

  const { positions, velocities, ages, maxAges, sizes, colors, bands } =
    buffers;
  const count = ages.length;

  let burstCount: number;
  let burstSize: number;
  let burstSpeed: number;

  switch (beatType) {
    case "kick":
      burstCount = Math.min(30, count);
      burstSize = config.maxSize;
      burstSpeed = 3;
      break;
    case "snare":
      burstCount = Math.min(15, count);
      burstSize = config.baseSize * 2;
      burstSpeed = 2;
      break;
    case "hihat":
      burstCount = Math.min(8, count);
      burstSize = config.baseSize;
      burstSpeed = 1.5;
      break;
  }

  const band = beatTypeToBand(beatType);
  const bandColor = BAND_COLORS[band];

  const oldest = findOldestIndices(ages, burstCount);
  for (const i of oldest) {
    const i3 = i * 3;

    positions[i3] = (Math.random() - 0.5) * 0.5;
    positions[i3 + 1] = (Math.random() - 0.5) * 0.5;
    positions[i3 + 2] = (Math.random() - 0.5) * 0.5;

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    velocities[i3] = Math.sin(phi) * Math.cos(theta) * burstSpeed;
    velocities[i3 + 1] = Math.sin(phi) * Math.sin(theta) * burstSpeed;
    velocities[i3 + 2] = Math.cos(phi) * burstSpeed;

    ages[i] = 0;
    maxAges[i] = 1 + Math.random() * 2;
    sizes[i] = burstSize;

    bands[i] = band;
    colors[i3] = bandColor[0];
    colors[i3 + 1] = bandColor[1];
    colors[i3 + 2] = bandColor[2];
  }
}

function findOldestIndices(ages: Float32Array, count: number): number[] {
  const indexed = Array.from({ length: ages.length }, (_, i) => ({
    i,
    age: ages[i] / (ages[i] > 0 ? 1 : 0.001),
  }));
  indexed.sort((a, b) => b.age - a.age);
  return indexed.slice(0, count).map((x) => x.i);
}

export function computeParticleAttributes(
  buffers: ParticleBuffers,
  config: AudioParticlesConfig,
  trebleEnergy: number,
  opacity: number,
): {
  positions: Float32Array;
  aSize: Float32Array;
  aOpacity: Float32Array;
  aColor: Float32Array;
} {
  const count = buffers.ages.length;
  const aSize = new Float32Array(count);
  const aOpacity = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const lifeRatio = buffers.ages[i] / buffers.maxAges[i];
    const fadeIn = Math.min(1, lifeRatio * 5);
    const fadeOut = Math.max(0, 1 - lifeRatio);
    const trailFade = fadeOut ** (1 / Math.max(0.1, config.trailLength));

    aSize[i] = buffers.sizes[i];
    aOpacity[i] = fadeIn * trailFade * (0.3 + trebleEnergy * 0.7) * opacity;
  }

  return {
    positions: buffers.positions,
    aSize,
    aOpacity,
    aColor: buffers.colors,
  };
}
