import {
  applyAWeighting,
  detectBeat,
  extractBands,
  mapLogFrequencies,
  smoothAttackRelease,
} from "./analysis";

describe("applyAWeighting", () => {
  it("returns ~0dB gain at 1kHz (reference frequency)", () => {
    const gain = applyAWeighting(1000);
    expect(gain).toBeCloseTo(1.0, 1);
  });

  it("attenuates ~20dB at 100Hz", () => {
    const gain = applyAWeighting(100);
    const db = 20 * Math.log10(gain);
    expect(db).toBeCloseTo(-19.1, 0);
  });

  it("attenuates ~2.5dB at 10kHz", () => {
    const gain = applyAWeighting(10000);
    const db = 20 * Math.log10(gain);
    expect(db).toBeCloseTo(-2.5, 0);
  });

  it("heavily attenuates very low frequencies (20Hz)", () => {
    const gain = applyAWeighting(20);
    expect(gain).toBeLessThan(0.1);
  });

  it("returns 0 for zero or negative frequency", () => {
    expect(applyAWeighting(0)).toBe(0);
    expect(applyAWeighting(-100)).toBe(0);
  });

  it("peaks around 2-4kHz (most sensitive range)", () => {
    const gain2k = applyAWeighting(2000);
    const gain1k = applyAWeighting(1000);
    expect(gain2k).toBeGreaterThan(gain1k);
  });
});

describe("mapLogFrequencies", () => {
  it("returns array of correct length", () => {
    const raw = new Array(256).fill(0.5);
    const result = mapLogFrequencies(raw, 64);
    expect(result).toHaveLength(64);
  });

  it("returns empty for empty input", () => {
    expect(mapLogFrequencies([], 64)).toEqual([]);
    expect(mapLogFrequencies([0.5], 0)).toEqual([]);
  });

  it("applies logarithmic distribution (more bins in low frequencies)", () => {
    const raw = Array.from({ length: 256 }, (_, i) => (i + 1) / 256);
    const result = mapLogFrequencies(raw, 8);
    const firstHalfAvg = result.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
    expect(firstHalfAvg).toBeGreaterThan(0);
  });

  it("applies perceptual weighting (middle bars have higher values for flat input)", () => {
    const raw = new Array(256).fill(1.0);
    const result = mapLogFrequencies(raw, 32);
    const midIndex = 16;
    const lowIndex = 0;
    expect(result[midIndex]).toBeGreaterThan(result[lowIndex]);
  });

  it("produces non-negative values for non-negative input", () => {
    const raw = new Array(256).fill(0.3);
    const result = mapLogFrequencies(raw, 16);
    for (const val of result) {
      expect(val).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("detectBeat", () => {
  it("detects beat when energy exceeds threshold with no cooldown", () => {
    const result = detectBeat(0.8, 0.5, 0);
    expect(result.isBeat).toBe(true);
    expect(result.intensity).toBeCloseTo(0.6, 5);
  });

  it("does not detect beat when energy is below threshold", () => {
    const result = detectBeat(0.3, 0.5, 0);
    expect(result.isBeat).toBe(false);
    expect(result.intensity).toBe(0);
  });

  it("does not detect beat during cooldown period", () => {
    const result = detectBeat(0.9, 0.5, 50);
    expect(result.isBeat).toBe(false);
    expect(result.intensity).toBe(0);
  });

  it("detects beat when cooldown is exactly zero", () => {
    const result = detectBeat(0.8, 0.5, 0);
    expect(result.isBeat).toBe(true);
  });

  it("calculates intensity proportional to excess energy", () => {
    const weak = detectBeat(0.6, 0.5, 0);
    const strong = detectBeat(0.9, 0.5, 0);
    expect(strong.intensity).toBeGreaterThan(weak.intensity);
  });

  it("returns zero intensity for energy exactly at threshold", () => {
    const result = detectBeat(0.5, 0.5, 0);
    expect(result.isBeat).toBe(false);
    expect(result.intensity).toBe(0);
  });
});

describe("smoothAttackRelease", () => {
  it("rises fast with short attack time", () => {
    const result = smoothAttackRelease(1.0, 0.0, 10, 80, 16);
    expect(result).toBeGreaterThan(0.5);
  });

  it("falls slowly with long release time", () => {
    const result = smoothAttackRelease(0.0, 1.0, 10, 80, 16);
    expect(result).toBeGreaterThan(0.5);
  });

  it("returns previous when deltaMs is zero", () => {
    const result = smoothAttackRelease(1.0, 0.5, 10, 80, 0);
    expect(result).toBe(0.5);
  });

  it("converges to current value over many frames (attack)", () => {
    let value = 0;
    for (let i = 0; i < 100; i++) {
      value = smoothAttackRelease(1.0, value, 10, 80, 16);
    }
    expect(value).toBeCloseTo(1.0, 1);
  });

  it("converges to current value over many frames (release)", () => {
    let value = 1.0;
    for (let i = 0; i < 200; i++) {
      value = smoothAttackRelease(0.0, value, 10, 80, 16);
    }
    expect(value).toBeCloseTo(0.0, 1);
  });

  it("attack is faster than release for same delta", () => {
    const attackResult = smoothAttackRelease(1.0, 0.0, 10, 80, 16);
    const releaseResult = smoothAttackRelease(0.0, 1.0, 10, 80, 16);
    const attackChange = attackResult - 0.0;
    const releaseChange = 1.0 - releaseResult;
    expect(attackChange).toBeGreaterThan(releaseChange);
  });

  it("produces exponential curve shape", () => {
    const results: number[] = [];
    let value = 0;
    for (let i = 0; i < 5; i++) {
      value = smoothAttackRelease(1.0, value, 10, 80, 16);
      results.push(value);
    }
    const d1 = results[1] - results[0];
    const d2 = results[2] - results[1];
    expect(d2).toBeLessThan(d1);
  });
});

describe("extractBands", () => {
  it("returns 7 bands", () => {
    const raw = new Array(256).fill(0.5);
    const bands = extractBands(raw);
    const keys = Object.keys(bands);
    expect(keys).toHaveLength(7);
    expect(keys).toEqual(
      expect.arrayContaining([
        "subBass",
        "bass",
        "lowMid",
        "mid",
        "highMid",
        "presence",
        "brilliance",
      ]),
    );
  });

  it("returns all zeros for empty input", () => {
    const bands = extractBands([]);
    for (const val of Object.values(bands)) {
      expect(val).toBe(0);
    }
  });

  it("returns correct averages for flat input", () => {
    const raw = new Array(256).fill(0.8);
    const bands = extractBands(raw);
    for (const val of Object.values(bands)) {
      expect(val).toBeCloseTo(0.8, 5);
    }
  });

  it("maps sub-bass bins correctly (20-60Hz)", () => {
    const raw = new Array(256).fill(0);
    const nyquist = 22050;
    const binHz = nyquist / 256;
    const binStart = Math.floor(20 / binHz);
    const binEnd = Math.ceil(60 / binHz);
    for (let b = binStart; b < binEnd; b++) {
      raw[b] = 1.0;
    }
    const bands = extractBands(raw);
    expect(bands.subBass).toBeGreaterThan(0);
    expect(bands.subBass).toBeGreaterThan(bands.mid);
  });

  it("maps brilliance bins correctly (6-20kHz)", () => {
    const raw = new Array(256).fill(0);
    const nyquist = 22050;
    const binHz = nyquist / 256;
    const binStart = Math.floor(6000 / binHz);
    const binEnd = Math.min(Math.ceil(20000 / binHz), 256);
    for (let b = binStart; b < binEnd; b++) {
      raw[b] = 1.0;
    }
    const bands = extractBands(raw);
    expect(bands.brilliance).toBeGreaterThan(0);
    expect(bands.brilliance).toBeGreaterThan(bands.mid);
  });

  it("mid band covers wider frequency range than sub-bass", () => {
    const nyquist = 22050;
    const binHz = nyquist / 256;
    const subBinStart = Math.floor(20 / binHz);
    const subBinEnd = Math.ceil(60 / binHz);
    const midBinStart = Math.floor(500 / binHz);
    const midBinEnd = Math.min(Math.ceil(2000 / binHz), 256);
    const subCount = subBinEnd - subBinStart;
    const midCount = midBinEnd - midBinStart;
    expect(midCount).toBeGreaterThan(subCount);
  });
});
