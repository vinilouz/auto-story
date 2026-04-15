jest.mock("three/examples/jsm/math/SimplexNoise.js", () => {
  class MockSimplexNoise {
    private perm: number[];

    constructor(r: { random: () => number } = Math) {
      const p: number[] = [];
      for (let i = 0; i < 256; i++) {
        p[i] = Math.floor(r.random() * 256);
      }
      this.perm = [];
      for (let i = 0; i < 512; i++) {
        this.perm[i] = p[i & 255];
      }
    }

    noise3d(x: number, y: number, z: number): number {
      const h =
        this.perm[((x * 1000) | 0) & 255] ^
        this.perm[((y * 1000) | 0) & 255] ^
        this.perm[((z * 1000) | 0) & 255];
      return h / 128 - 1;
    }
  }

  return { SimplexNoise: MockSimplexNoise };
});

import {
  createNoiseField,
  createSeededRandom,
  sampleNoiseField,
} from "./audio-particles-noise";

describe("createSeededRandom", () => {
  it("produces deterministic sequence for given seed", () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    for (let i = 0; i < 20; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it("produces different sequences for different seeds", () => {
    const rng1 = createSeededRandom(1);
    const rng2 = createSeededRandom(2);
    let same = 0;
    for (let i = 0; i < 10; i++) {
      if (rng1() === rng2()) same++;
    }
    expect(same).toBeLessThan(10);
  });

  it("produces values in [0, 1) range", () => {
    const rng = createSeededRandom(12345);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("createNoiseField", () => {
  it("produces deterministic noise for same seed", () => {
    const n1 = createNoiseField(42);
    const n2 = createNoiseField(42);
    const v1 = n1.noise3d(1.5, 2.3, 0.7);
    const v2 = n2.noise3d(1.5, 2.3, 0.7);
    expect(v1).toBe(v2);
  });

  it("produces different noise for different seeds", () => {
    const n1 = createNoiseField(1);
    const n2 = createNoiseField(2);
    const v1 = n1.noise3d(1.5, 2.3, 0.7);
    const v2 = n2.noise3d(1.5, 2.3, 0.7);
    expect(v1).not.toBe(v2);
  });
});

describe("sampleNoiseField", () => {
  const noise = createNoiseField(42);

  it("returns a 3-element tuple", () => {
    const result = sampleNoiseField(noise, 0, 0, 0, 0, 1, 1);
    expect(result).toHaveLength(3);
  });

  it("returns deterministic results for same inputs", () => {
    const r1 = sampleNoiseField(noise, 1, 2, 3, 0.5, 1, 1.5);
    const r2 = sampleNoiseField(noise, 1, 2, 3, 0.5, 1, 1.5);
    expect(r1).toEqual(r2);
  });

  it("scales by turbulence factor", () => {
    const r1 = sampleNoiseField(noise, 1, 2, 3, 0, 1, 1);
    const r2 = sampleNoiseField(noise, 1, 2, 3, 0, 1, 2);
    for (let i = 0; i < 3; i++) {
      expect(r2[i]).toBeCloseTo(r1[i] * 2, 5);
    }
  });

  it("uses scale to multiply input coordinates", () => {
    const r1 = sampleNoiseField(noise, 1, 0, 0, 0, 1, 1);
    const r2 = sampleNoiseField(noise, 0.5, 0, 0, 0, 2, 1);
    expect(r1).toEqual(r2);
  });

  it("different time offsets produce different values", () => {
    const r1 = sampleNoiseField(noise, 1, 2, 3, 0, 1, 1);
    const r2 = sampleNoiseField(noise, 1, 2, 3, 10, 1, 1);
    expect(r1).not.toEqual(r2);
  });
});
