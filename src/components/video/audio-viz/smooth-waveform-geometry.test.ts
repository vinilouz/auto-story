import {
  calculateBeatPulse,
  catmullRomPoint,
  computeLineColors,
  computeWaveformPoints,
  generateFrequencyGradient,
  getPositionY,
  interpolateCatmullRom,
} from "./smooth-waveform-geometry";

describe("catmullRomPoint", () => {
  it("returns p1 at t=0", () => {
    const result = catmullRomPoint(0, 1, 3, 6, 0, 0.5);
    expect(result).toBeCloseTo(1, 5);
  });

  it("returns p2 at t=1", () => {
    const result = catmullRomPoint(0, 1, 3, 6, 1, 0.5);
    expect(result).toBeCloseTo(3, 5);
  });

  it("produces smooth intermediate values", () => {
    const result = catmullRomPoint(0, 1, 3, 6, 0.5, 0.5);
    expect(result).toBeGreaterThan(1);
    expect(result).toBeLessThan(3);
  });

  it("tension=1 produces linear interpolation (no tangents)", () => {
    const result = catmullRomPoint(0, 10, 20, 30, 0.5, 1);
    expect(result).toBeCloseTo(15, 5);
  });

  it("tension=0 with linear data gives linear result", () => {
    const result = catmullRomPoint(0, 10, 20, 30, 0.5, 0);
    expect(result).toBeCloseTo(15, 3);
  });

  it("at midpoint of symmetric control points returns zero", () => {
    const result = catmullRomPoint(-1, -1, 1, 1, 0.5, 0.5);
    expect(result).toBeCloseTo(0, 3);
  });
});

describe("interpolateCatmullRom", () => {
  it("returns input for fewer than 2 points", () => {
    expect(interpolateCatmullRom([5], 4, 0.5)).toEqual([5]);
  });

  it("returns input for zero subdivisions", () => {
    expect(interpolateCatmullRom([1, 2, 3], 0, 0.5)).toEqual([1, 2, 3]);
  });

  it("produces correct output length", () => {
    const points = [0, 1, 2, 3];
    const result = interpolateCatmullRom(points, 4, 0.5);
    const expectedLength = (points.length - 1) * 4 + 1;
    expect(result).toHaveLength(expectedLength);
  });

  it("starts at first point", () => {
    const result = interpolateCatmullRom([0, 5, 10], 3, 0.5);
    expect(result[0]).toBeCloseTo(0, 5);
  });

  it("ends at last point", () => {
    const result = interpolateCatmullRom([0, 5, 10], 3, 0.5);
    expect(result[result.length - 1]).toBeCloseTo(10, 5);
  });

  it("produces monotonic output for monotonic input", () => {
    const result = interpolateCatmullRom([0, 2, 5, 9], 8, 0.5);
    for (let i = 1; i < result.length; i++) {
      expect(result[i]).toBeGreaterThanOrEqual(result[i - 1] - 0.01);
    }
  });

  it("preserves constant input", () => {
    const result = interpolateCatmullRom([3, 3, 3], 4, 0.5);
    for (const v of result) {
      expect(v).toBeCloseTo(3, 3);
    }
  });

  it("handles 2 points", () => {
    const result = interpolateCatmullRom([0, 10], 5, 0.5);
    expect(result).toHaveLength(6);
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[5]).toBeCloseTo(10, 5);
  });
});

describe("generateFrequencyGradient", () => {
  it("returns correct array length", () => {
    const colors = generateFrequencyGradient(10, [1, 0, 0], "fixed");
    expect(colors).toHaveLength(30);
  });

  it("returns fixed color for all points in fixed mode", () => {
    const colors = generateFrequencyGradient(5, [0.5, 0.3, 0.1], "fixed");
    for (let i = 0; i < 5; i++) {
      expect(colors[i * 3]).toBeCloseTo(0.5, 3);
      expect(colors[i * 3 + 1]).toBeCloseTo(0.3, 3);
      expect(colors[i * 3 + 2]).toBeCloseTo(0.1, 3);
    }
  });

  it("darkens low amplitude in amplitude mode", () => {
    const base: [number, number, number] = [1, 1, 1];
    const amps = [0, 1];
    const colors = generateFrequencyGradient(2, base, "amplitude", amps);
    const lowBrightness = colors[0] + colors[1] + colors[2];
    const highBrightness = colors[3] + colors[4] + colors[5];
    expect(highBrightness).toBeGreaterThan(lowBrightness);
  });

  it("shifts from warm to cool in frequency mode", () => {
    const base: [number, number, number] = [1, 0, 0];
    const colors = generateFrequencyGradient(10, base, "frequency");
    const firstR = colors[0];
    const lastB = colors[10 * 3 - 1];
    expect(lastB).toBeGreaterThan(firstR * 0.1);
  });

  it("clamps all values to [0, 1]", () => {
    const colors = generateFrequencyGradient(64, [1, 0.8, 0.5], "frequency");
    for (let i = 0; i < colors.length; i++) {
      expect(colors[i]).toBeGreaterThanOrEqual(0);
      expect(colors[i]).toBeLessThanOrEqual(1);
    }
  });

  it("handles single point", () => {
    const colors = generateFrequencyGradient(1, [1, 0, 0], "fixed");
    expect(colors).toHaveLength(3);
    expect(colors[0]).toBeCloseTo(1, 3);
  });
});

describe("computeWaveformPoints", () => {
  it("returns empty for empty input", () => {
    const result = computeWaveformPoints([], 10, 0, 2, 4, 0.5, 0);
    expect(result).toHaveLength(0);
  });

  it("returns 3D positions (x, y, z per point)", () => {
    const result = computeWaveformPoints([0.5, 0.3, 0.7], 10, 0, 2, 4, 0.5, 0);
    expect(result.length % 3).toBe(0);
  });

  it("positions span the full width", () => {
    const result = computeWaveformPoints([0.5, 0.5], 10, 0, 2, 1, 0.5, 0);
    const pointCount = result.length / 3;
    const firstX = result[0];
    const lastX = result[(pointCount - 1) * 3];
    expect(firstX).toBeCloseTo(-5, 3);
    expect(lastX).toBeCloseTo(5, 3);
  });

  it("higher frequency produces higher Y position", () => {
    const lowFreq = computeWaveformPoints([0.2], 10, 0, 5, 1, 0.5, 0);
    const highFreq = computeWaveformPoints([0.8], 10, 0, 5, 1, 0.5, 0);
    expect(highFreq[1]).toBeGreaterThan(lowFreq[1]);
  });

  it("beat pulse increases height", () => {
    const noBeat = computeWaveformPoints([0.5], 10, 0, 5, 1, 0.5, 0);
    const withBeat = computeWaveformPoints([0.5], 10, 0, 5, 1, 0.5, 1);
    expect(withBeat[1]).toBeGreaterThan(noBeat[1]);
  });

  it("all Z coordinates are 0", () => {
    const result = computeWaveformPoints(
      [0.3, 0.6, 0.2, 0.8],
      10,
      0,
      2,
      2,
      0.5,
      0,
    );
    const pointCount = result.length / 3;
    for (let i = 0; i < pointCount; i++) {
      expect(result[i * 3 + 2]).toBe(0);
    }
  });
});

describe("calculateBeatPulse", () => {
  it("returns pulse on beat", () => {
    const result = calculateBeatPulse(true, 0.5, 0);
    expect(result).toBeCloseTo(0.7, 2);
  });

  it("caps pulse at 1", () => {
    const result = calculateBeatPulse(true, 2, 0);
    expect(result).toBeCloseTo(1, 2);
  });

  it("decays when no beat", () => {
    const result = calculateBeatPulse(false, 0, 0.5);
    expect(result).toBeCloseTo(0.45, 2);
  });

  it("reaches zero after sustained no-beat", () => {
    let pulse = 1;
    for (let i = 0; i < 100; i++) {
      pulse = calculateBeatPulse(false, 0, pulse);
    }
    expect(pulse).toBeCloseTo(0, 2);
  });
});

describe("getPositionY", () => {
  it("returns 0 for center", () => {
    expect(getPositionY("center", 7.65)).toBe(0);
  });

  it("returns negative for bottom", () => {
    expect(getPositionY("bottom", 7.65)).toBeLessThan(0);
  });

  it("returns positive for top", () => {
    expect(getPositionY("top", 7.65)).toBeGreaterThan(0);
  });
});

describe("computeLineColors", () => {
  it("parses hex color and produces gradient", () => {
    const colors = computeLineColors(10, "#FF0000", "fixed", []);
    expect(colors).toHaveLength(30);
    expect(colors[0]).toBeCloseTo(1, 3);
    expect(colors[1]).toBeCloseTo(0, 3);
    expect(colors[2]).toBeCloseTo(0, 3);
  });

  it("handles frequency mapping", () => {
    const colors = computeLineColors(10, "#FFE81F", "frequency", []);
    expect(colors).toHaveLength(30);
    for (let i = 0; i < colors.length; i++) {
      expect(colors[i]).toBeGreaterThanOrEqual(0);
      expect(colors[i]).toBeLessThanOrEqual(1);
    }
  });

  it("handles amplitude mapping", () => {
    const amps = new Array(10).fill(0.5);
    const colors = computeLineColors(10, "#FFFFFF", "amplitude", amps);
    expect(colors).toHaveLength(30);
    for (let i = 0; i < 10; i++) {
      const brightness = colors[i * 3] + colors[i * 3 + 1] + colors[i * 3 + 2];
      expect(brightness).toBeGreaterThan(0);
    }
  });
});
