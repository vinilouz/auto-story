import {
  calculateBarPositions,
  calculateBeatFlash,
  calculateReflectionMatrix,
  computeInstanceTransforms,
  generateBarColor,
  mapFrequencyToHeight,
  parseHexColor,
} from "./pro-spectrum-geometry";

describe("calculateBarPositions", () => {
  it("returns correct number of positions", () => {
    const positions = calculateBarPositions(64, 2, 100);
    expect(positions).toHaveLength(64);
  });

  it("returns empty for zero bar count", () => {
    expect(calculateBarPositions(0, 2, 100)).toEqual([]);
  });

  it("returns empty for negative bar count", () => {
    expect(calculateBarPositions(-5, 2, 100)).toEqual([]);
  });

  it("returns empty for zero maxWidth", () => {
    expect(calculateBarPositions(64, 2, 0)).toEqual([]);
  });

  it("positions span symmetrically around origin", () => {
    const positions = calculateBarPositions(4, 2, 20);
    const firstX = positions[0].x;
    const lastX = positions[positions.length - 1].x;
    expect(Math.abs(firstX + lastX)).toBeCloseTo(0, 5);
  });

  it("bars do not overlap (accounting for width)", () => {
    const positions = calculateBarPositions(10, 3, 50);
    for (let i = 1; i < positions.length; i++) {
      const prevRight = positions[i - 1].x + positions[i - 1].width / 2;
      const currLeft = positions[i].x - positions[i].width / 2;
      expect(currLeft).toBeGreaterThanOrEqual(prevRight - 0.001);
    }
  });

  it("all bars have positive width", () => {
    const positions = calculateBarPositions(64, 2, 100);
    for (const pos of positions) {
      expect(pos.width).toBeGreaterThan(0);
    }
  });

  it("single bar is centered at origin", () => {
    const positions = calculateBarPositions(1, 2, 10);
    expect(positions).toHaveLength(1);
    expect(positions[0].x).toBeCloseTo(0, 5);
  });
});

describe("mapFrequencyToHeight", () => {
  it("returns maxHeight for value 1", () => {
    expect(mapFrequencyToHeight(1, 30)).toBe(30);
  });

  it("returns minHeight for value 0", () => {
    expect(mapFrequencyToHeight(0, 30)).toBeCloseTo(0.05, 5);
  });

  it("returns proportional height for 0.5", () => {
    const result = mapFrequencyToHeight(0.5, 10);
    expect(result).toBeCloseTo(5.025, 3);
  });

  it("clamps values above 1 to maxHeight", () => {
    expect(mapFrequencyToHeight(2, 30)).toBe(30);
  });

  it("clamps negative values to minHeight", () => {
    expect(mapFrequencyToHeight(-0.5, 30)).toBeCloseTo(0.05, 5);
  });

  it("respects custom minHeight", () => {
    expect(mapFrequencyToHeight(0, 30, 0.5)).toBe(0.5);
  });
});

describe("generateBarColor", () => {
  it("returns base color for single bar", () => {
    const base: [number, number, number] = [1, 0.5, 0];
    const result = generateBarColor(0, 1, base);
    expect(result[0]).toBeCloseTo(base[0], 3);
    expect(result[1]).toBeCloseTo(base[1], 3);
    expect(result[2]).toBeCloseTo(base[2], 3);
  });

  it("generates different colors for different indices", () => {
    const base: [number, number, number] = [1, 1, 0];
    const first = generateBarColor(0, 64, base);
    const last = generateBarColor(63, 64, base);
    expect(first[2]).toBeLessThanOrEqual(last[2]);
  });

  it("colors are in valid range [0, 1]", () => {
    const base: [number, number, number] = [1, 0.8, 0.3];
    for (let i = 0; i < 64; i++) {
      const color = generateBarColor(i, 64, base);
      for (const channel of color) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });

  it("middle bars are brighter (sin peak)", () => {
    const base: [number, number, number] = [1, 1, 1];
    const middle = generateBarColor(32, 64, base);
    const edge = generateBarColor(0, 64, base);
    const middleLuminance = middle[0] + middle[1] + middle[2];
    const edgeLuminance = edge[0] + edge[1] + edge[2];
    expect(middleLuminance).toBeGreaterThan(edgeLuminance);
  });
});

describe("parseHexColor", () => {
  it("parses white", () => {
    const [r, g, b] = parseHexColor("#FFFFFF");
    expect(r).toBeCloseTo(1, 5);
    expect(g).toBeCloseTo(1, 5);
    expect(b).toBeCloseTo(1, 5);
  });

  it("parses black", () => {
    const [r, g, b] = parseHexColor("#000000");
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it("parses yellow (#FFE81F)", () => {
    const [r, g, b] = parseHexColor("#FFE81F");
    expect(r).toBeCloseTo(1, 1);
    expect(g).toBeCloseTo(0.91, 1);
    expect(b).toBeCloseTo(0.12, 1);
  });

  it("handles color without hash", () => {
    const [r, g, b] = parseHexColor("FF0000");
    expect(r).toBeCloseTo(1, 5);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });
});

describe("calculateReflectionMatrix", () => {
  it("returns scaleY of -1 for mirror inversion", () => {
    const result = calculateReflectionMatrix(10, 0);
    expect(result.scaleY).toBe(-1);
  });

  it("offsets correctly for reflection position", () => {
    const result = calculateReflectionMatrix(10, 0);
    expect(result.offsetY).toBe(-20);
  });
});

describe("calculateBeatFlash", () => {
  it("returns flash value on beat", () => {
    const result = calculateBeatFlash(true, 0.5, 0);
    expect(result).toBeCloseTo(0.65, 2);
  });

  it("returns max flash on strong beat", () => {
    const result = calculateBeatFlash(true, 2, 0);
    expect(result).toBeCloseTo(1, 2);
  });

  it("decays when no beat", () => {
    const result = calculateBeatFlash(false, 0, 0.5);
    expect(result).toBeCloseTo(0.46, 2);
  });

  it("reaches zero after sustained no-beat", () => {
    let decay = 1;
    for (let i = 0; i < 100; i++) {
      decay = calculateBeatFlash(false, 0, decay);
    }
    expect(decay).toBeCloseTo(0, 2);
  });
});

describe("computeInstanceTransforms", () => {
  const baseColor: [number, number, number] = [1, 0.9, 0.1];

  it("returns arrays of correct size", () => {
    const barPositions = calculateBarPositions(64, 2, 100);
    const frequencies = new Array(64).fill(0.5);
    const result = computeInstanceTransforms(
      frequencies,
      barPositions,
      30,
      -5,
      0,
      baseColor,
    );
    expect(result.matrices).toHaveLength(64 * 16);
    expect(result.colors).toHaveLength(64 * 3);
    expect(result.flashIntensities).toHaveLength(64);
  });

  it("higher frequency produces taller bar", () => {
    const barPositions = calculateBarPositions(2, 2, 10);
    const frequencies = [0.2, 0.8];
    const result = computeInstanceTransforms(
      frequencies,
      barPositions,
      30,
      -5,
      0,
      baseColor,
    );

    const height1 = result.matrices[1 * 16 + 5];
    const height2 = result.matrices[1 * 16 + 5];
    expect(height2).toBeGreaterThan(0);
    expect(height1).toBeGreaterThan(0);
  });

  it("bars at different indices have different X positions", () => {
    const barPositions = calculateBarPositions(10, 2, 50);
    const frequencies = new Array(10).fill(0.5);
    const result = computeInstanceTransforms(
      frequencies,
      barPositions,
      30,
      -5,
      0,
      baseColor,
    );

    const x0 = result.matrices[0 * 16 + 12];
    const x9 = result.matrices[9 * 16 + 12];
    expect(x9).toBeGreaterThan(x0);
  });

  it("beat flash only affects bass bars (first 25%)", () => {
    const barPositions = calculateBarPositions(8, 2, 40);
    const frequencies = new Array(8).fill(0.5);
    const result = computeInstanceTransforms(
      frequencies,
      barPositions,
      30,
      -5,
      0.8,
      baseColor,
    );

    expect(result.flashIntensities[0]).toBeGreaterThan(0);
    expect(result.flashIntensities[1]).toBeGreaterThan(0);
    expect(result.flashIntensities[6]).toBe(0);
    expect(result.flashIntensities[7]).toBe(0);
  });

  it("handles mismatched lengths gracefully", () => {
    const barPositions = calculateBarPositions(4, 2, 20);
    const frequencies = [0.5, 0.8];
    const result = computeInstanceTransforms(
      frequencies,
      barPositions,
      30,
      -5,
      0,
      baseColor,
    );
    expect(result.matrices).toHaveLength(2 * 16);
  });
});
