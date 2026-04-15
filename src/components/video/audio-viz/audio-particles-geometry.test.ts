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

import type { AudioParticlesConfig } from "@/lib/video/types";
import {
  BAND_COLORS,
  type BeatType,
  classifyBeat,
  beatTypeToBand,
  computeParticleAttributes,
  emitBurst,
  initializeParticles,
  updateParticles,
} from "./audio-particles-geometry";
import { createNoiseField, createSeededRandom } from "./audio-particles-noise";

const DEFAULT_CONFIG: AudioParticlesConfig = {
  count: 800,
  noiseScale: 1.0,
  trailLength: 0.6,
  turbulence: 1.5,
  baseSize: 2,
  maxSize: 8,
};

describe("initializeParticles", () => {
  it("creates buffers with correct sizes", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(100, rng);
    expect(buffers.positions).toHaveLength(100 * 3);
    expect(buffers.velocities).toHaveLength(100 * 3);
    expect(buffers.ages).toHaveLength(100);
    expect(buffers.maxAges).toHaveLength(100);
    expect(buffers.sizes).toHaveLength(100);
    expect(buffers.colors).toHaveLength(100 * 3);
    expect(buffers.bands).toHaveLength(100);
  });

  it("initializes positions in reasonable range (sphere distribution)", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(500, rng);
    for (let i = 0; i < 500; i++) {
      const x = buffers.positions[i * 3];
      const y = buffers.positions[i * 3 + 1];
      const z = buffers.positions[i * 3 + 2];
      expect(Math.abs(x)).toBeLessThan(10);
      expect(Math.abs(y)).toBeLessThan(5);
      expect(Math.abs(z)).toBeLessThan(3);
    }
  });

  it("initializes velocities to zero", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(100, rng);
    for (let i = 0; i < 100 * 3; i++) {
      expect(buffers.velocities[i]).toBe(0);
    }
  });

  it("sets ages within valid range", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(100, rng);
    for (let i = 0; i < 100; i++) {
      expect(buffers.ages[i]).toBeGreaterThanOrEqual(0);
      expect(buffers.maxAges[i]).toBeGreaterThan(0);
    }
  });

  it("sets sizes within valid range", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(100, rng);
    for (let i = 0; i < 100; i++) {
      expect(buffers.sizes[i]).toBeGreaterThan(0);
    }
  });

  it("is deterministic for same seed", () => {
    const rng1 = createSeededRandom(99);
    const rng2 = createSeededRandom(99);
    const b1 = initializeParticles(50, rng1);
    const b2 = initializeParticles(50, rng2);
    expect(b1.positions).toEqual(b2.positions);
    expect(b1.ages).toEqual(b2.ages);
    expect(b1.maxAges).toEqual(b2.maxAges);
    expect(b1.sizes).toEqual(b2.sizes);
  });
});

describe("updateParticles", () => {
  it("ages all particles by deltaTime", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(10, rng);
    const noise = createNoiseField(42);
    const agesBefore = Array.from(buffers.ages);

    updateParticles(buffers, noise, 0, 0.1, DEFAULT_CONFIG, 0, 0, 0);

    for (let i = 0; i < 10; i++) {
      expect(buffers.ages[i]).toBeCloseTo(agesBefore[i] + 0.1, 5);
    }
  });

  it("moves particles based on noise field", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(10, rng);
    const noise = createNoiseField(42);
    const posBefore = Array.from(buffers.positions);

    updateParticles(buffers, noise, 0.5, 0.1, DEFAULT_CONFIG, 0.3, 0.2, 0.1);

    let moved = false;
    for (let i = 0; i < 10 * 3; i++) {
      if (Math.abs(buffers.positions[i] - posBefore[i]) > 0.0001) {
        moved = true;
        break;
      }
    }
    expect(moved).toBe(true);
  });

  it("respawns expired particles", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(10, rng);

    for (let i = 0; i < 10; i++) {
      buffers.ages[i] = buffers.maxAges[i] + 1;
    }

    const noise = createNoiseField(42);
    updateParticles(buffers, noise, 0, 0.1, DEFAULT_CONFIG, 0, 0, 0);

    for (let i = 0; i < 10; i++) {
      expect(buffers.ages[i]).toBeLessThan(buffers.maxAges[i]);
    }
  });

  it("increases turbulence with bass energy", () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    const b1 = initializeParticles(20, rng1);
    const b2 = initializeParticles(20, rng2);
    const n1 = createNoiseField(42);
    const n2 = createNoiseField(42);

    updateParticles(b1, n1, 1, 0.1, DEFAULT_CONFIG, 0, 0, 0);
    updateParticles(b2, n2, 1, 0.1, DEFAULT_CONFIG, 0.8, 0, 0);

    let highBassDisplacement = 0;
    let lowBassDisplacement = 0;
    for (let i = 0; i < 20; i++) {
      const i3 = i * 3;
      highBassDisplacement += Math.abs(b2.velocities[i3]);
      lowBassDisplacement += Math.abs(b1.velocities[i3]);
    }
    expect(highBassDisplacement).toBeGreaterThan(lowBassDisplacement);
  });
});

describe("classifyBeat", () => {
  it("returns null when no beat", () => {
    expect(
      classifyBeat(
        { subBass: 0.5, bass: 0.4, highMid: 0.1, brilliance: 0.1 },
        false,
      ),
    ).toBeNull();
  });

  it("classifies kick when bass dominates", () => {
    expect(
      classifyBeat(
        { subBass: 0.9, bass: 0.8, highMid: 0.2, brilliance: 0.1 },
        true,
      ),
    ).toBe("kick");
  });

  it("classifies snare when highMid dominates", () => {
    expect(
      classifyBeat(
        { subBass: 0.2, bass: 0.3, highMid: 0.8, brilliance: 0.1 },
        true,
      ),
    ).toBe("snare");
  });

  it("classifies hihat when brilliance dominates", () => {
    expect(
      classifyBeat(
        { subBass: 0.1, bass: 0.2, highMid: 0.3, brilliance: 0.9 },
        true,
      ),
    ).toBe("hihat");
  });
});

describe("emitBurst", () => {
  it("repositions burst particles for kick", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(100, rng);

    const posBefore = Array.from(buffers.positions);
    emitBurst(buffers, "kick", DEFAULT_CONFIG);

    let repositioned = 0;
    for (let i = 0; i < 100; i++) {
      const i3 = i * 3;
      if (buffers.positions[i3] !== posBefore[i3] || buffers.ages[i] === 0) {
        repositioned++;
      }
    }
    expect(repositioned).toBeGreaterThan(0);
  });

  it("sets burst particles near center", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(100, rng);

    emitBurst(buffers, "kick", DEFAULT_CONFIG);

    let centered = 0;
    for (let i = 0; i < 100; i++) {
      if (buffers.ages[i] === 0) {
        const i3 = i * 3;
        const dist = Math.sqrt(
          buffers.positions[i3] ** 2 +
            buffers.positions[i3 + 1] ** 2 +
            buffers.positions[i3 + 2] ** 2,
        );
        if (dist < 1) centered++;
      }
    }
    expect(centered).toBeGreaterThan(0);
  });

  it("gives burst particles outward velocity", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(100, rng);

    emitBurst(buffers, "kick", DEFAULT_CONFIG);

    let hasVelocity = false;
    for (let i = 0; i < 100; i++) {
      if (buffers.ages[i] === 0) {
        const i3 = i * 3;
        const speed = Math.sqrt(
          buffers.velocities[i3] ** 2 +
            buffers.velocities[i3 + 1] ** 2 +
            buffers.velocities[i3 + 2] ** 2,
        );
        if (speed > 0) hasVelocity = true;
      }
    }
    expect(hasVelocity).toBe(true);
  });

  it("does nothing for null beat type", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(100, rng);
    const agesBefore = Array.from(buffers.ages);

    emitBurst(buffers, null, DEFAULT_CONFIG);

    expect(Array.from(buffers.ages)).toEqual(agesBefore);
  });

  it("kick burst is larger than snare burst", () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    const b1 = initializeParticles(100, rng1);
    const b2 = initializeParticles(100, rng2);

    emitBurst(b1, "kick", DEFAULT_CONFIG);
    emitBurst(b2, "snare", DEFAULT_CONFIG);

    const kickReset = b1.ages.filter((a) => a === 0).length;
    const snareReset = b2.ages.filter((a) => a === 0).length;
    expect(kickReset).toBeGreaterThan(snareReset);
  });
});

describe("band colors and assignment", () => {
  it("assigns valid frequency bands to all particles", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(200, rng);
    const validBands = new Set(["bass", "mid", "treble"]);
    for (let i = 0; i < 200; i++) {
      expect(validBands.has(buffers.bands[i])).toBe(true);
    }
  });

  it("assigns colors matching the band definition", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(200, rng);
    for (let i = 0; i < 200; i++) {
      const i3 = i * 3;
      const expected = BAND_COLORS[buffers.bands[i]];
      expect(buffers.colors[i3]).toBeCloseTo(expected[0], 5);
      expect(buffers.colors[i3 + 1]).toBeCloseTo(expected[1], 5);
      expect(buffers.colors[i3 + 2]).toBeCloseTo(expected[2], 5);
    }
  });

  it("produces at least two different band types across particles", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(500, rng);
    const uniqueBands = new Set(buffers.bands);
    expect(uniqueBands.size).toBeGreaterThanOrEqual(2);
  });
});

describe("beatTypeToBand", () => {
  it("maps kick to bass", () => {
    expect(beatTypeToBand("kick")).toBe("bass");
  });

  it("maps snare to mid", () => {
    expect(beatTypeToBand("snare")).toBe("mid");
  });

  it("maps hihat to treble", () => {
    expect(beatTypeToBand("hihat")).toBe("treble");
  });

  it("maps null to bass (default)", () => {
    expect(beatTypeToBand(null)).toBe("bass");
  });
});

describe("emitBurst color assignment", () => {
  it("assigns bass colors for kick burst", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(100, rng);
    emitBurst(buffers, "kick", DEFAULT_CONFIG);

    const bassColor = BAND_COLORS.bass;
    let bassColoredCount = 0;
    for (let i = 0; i < 100; i++) {
      if (buffers.ages[i] === 0) {
        const i3 = i * 3;
        expect(buffers.colors[i3]).toBeCloseTo(bassColor[0], 5);
        expect(buffers.colors[i3 + 1]).toBeCloseTo(bassColor[1], 5);
        expect(buffers.colors[i3 + 2]).toBeCloseTo(bassColor[2], 5);
        expect(buffers.bands[i]).toBe("bass");
        bassColoredCount++;
      }
    }
    expect(bassColoredCount).toBeGreaterThan(0);
  });

  it("assigns treble colors for hihat burst", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(100, rng);
    emitBurst(buffers, "hihat", DEFAULT_CONFIG);

    const trebleColor = BAND_COLORS.treble;
    for (let i = 0; i < 100; i++) {
      if (buffers.ages[i] === 0) {
        const i3 = i * 3;
        expect(buffers.colors[i3]).toBeCloseTo(trebleColor[0], 5);
        expect(buffers.colors[i3 + 1]).toBeCloseTo(trebleColor[1], 5);
        expect(buffers.colors[i3 + 2]).toBeCloseTo(trebleColor[2], 5);
        expect(buffers.bands[i]).toBe("treble");
      }
    }
  });

  it("assigns mid colors for snare burst", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(100, rng);
    emitBurst(buffers, "snare", DEFAULT_CONFIG);

    const midColor = BAND_COLORS.mid;
    for (let i = 0; i < 100; i++) {
      if (buffers.ages[i] === 0) {
        const i3 = i * 3;
        expect(buffers.colors[i3]).toBeCloseTo(midColor[0], 5);
        expect(buffers.colors[i3 + 1]).toBeCloseTo(midColor[1], 5);
        expect(buffers.colors[i3 + 2]).toBeCloseTo(midColor[2], 5);
        expect(buffers.bands[i]).toBe("mid");
      }
    }
  });
});

describe("computeParticleAttributes", () => {
  it("returns correct buffer sizes including color", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(100, rng);
    const attrs = computeParticleAttributes(buffers, DEFAULT_CONFIG, 0.5, 0.7);
    expect(attrs.aSize).toHaveLength(100);
    expect(attrs.aOpacity).toHaveLength(100);
    expect(attrs.positions).toHaveLength(100 * 3);
    expect(attrs.aColor).toHaveLength(100 * 3);
  });

  it("opacities are in valid range", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(100, rng);
    const attrs = computeParticleAttributes(buffers, DEFAULT_CONFIG, 0.5, 1.0);
    for (let i = 0; i < 100; i++) {
      expect(attrs.aOpacity[i]).toBeGreaterThanOrEqual(0);
      expect(attrs.aOpacity[i]).toBeLessThanOrEqual(1);
    }
  });

  it("sizes are positive", () => {
    const rng = createSeededRandom(42);
    const buffers = initializeParticles(100, rng);
    const attrs = computeParticleAttributes(buffers, DEFAULT_CONFIG, 0.5, 1.0);
    for (let i = 0; i < 100; i++) {
      expect(attrs.aSize[i]).toBeGreaterThan(0);
    }
  });

  it("higher treble increases opacity", () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    const b1 = initializeParticles(50, rng1);
    const b2 = initializeParticles(50, rng2);

    const a1 = computeParticleAttributes(b1, DEFAULT_CONFIG, 0.1, 1.0);
    const a2 = computeParticleAttributes(b2, DEFAULT_CONFIG, 0.9, 1.0);

    let sum1 = 0;
    let sum2 = 0;
    for (let i = 0; i < 50; i++) {
      sum1 += a1.aOpacity[i];
      sum2 += a2.aOpacity[i];
    }
    expect(sum2).toBeGreaterThan(sum1);
  });
});
