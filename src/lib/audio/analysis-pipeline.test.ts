import { computeAudioAnalysis } from "./analysis";

function generateMockFFT(
  length: number,
  options?: { bassBias?: number; silence?: boolean },
): number[] {
  if (options?.silence) return new Array(length).fill(0);

  const data: number[] = [];
  for (let i = 0; i < length; i++) {
    const t = i / length;
    const bassBias = options?.bassBias ?? 1;
    const bassRegion = t < 0.1 ? bassBias * 2 : 1;
    data.push((Math.random() * 0.5 + 0.1) * bassRegion);
  }
  return data;
}

function highBassFFT(length: number, amplitude: number): number[] {
  const raw = new Array(length).fill(0.01);
  for (let i = 0; i < 20; i++) raw[i] = amplitude;
  return raw;
}

describe("computeAudioAnalysis", () => {
  const OUTPUT_BARS = 64;
  const FPS = 30;

  it("returns correctly shaped result from mock FFT input", () => {
    const raw = generateMockFFT(256);
    const previous = new Array(OUTPUT_BARS).fill(0);

    const result = computeAudioAnalysis(raw, OUTPUT_BARS, previous, 0, FPS);

    expect(result.bands).toHaveProperty("subBass");
    expect(result.bands).toHaveProperty("bass");
    expect(result.bands).toHaveProperty("lowMid");
    expect(result.bands).toHaveProperty("mid");
    expect(result.bands).toHaveProperty("highMid");
    expect(result.bands).toHaveProperty("presence");
    expect(result.bands).toHaveProperty("brilliance");
    expect(result.beat).toHaveProperty("isBeat");
    expect(result.beat).toHaveProperty("intensity");
    expect(result.smoothedFrequencies).toHaveLength(OUTPUT_BARS);
    expect(result.newSmoothed).toHaveLength(OUTPUT_BARS);
    expect(typeof result.rmsEnergy).toBe("number");
    expect(typeof result.newCooldown).toBe("number");
  });

  it("produces smoothed frequencies matching outputBars count", () => {
    const raw = generateMockFFT(512);
    const previous = new Array(OUTPUT_BARS).fill(0);

    const result = computeAudioAnalysis(raw, OUTPUT_BARS, previous, 0, FPS);

    expect(result.smoothedFrequencies).toHaveLength(OUTPUT_BARS);
    expect(result.newSmoothed).toHaveLength(OUTPUT_BARS);
  });

  it("smoothing converges toward input over multiple frames", () => {
    const raw = generateMockFFT(256, { bassBias: 3 });
    const previous = new Array(OUTPUT_BARS).fill(0);

    const frame1 = computeAudioAnalysis(raw, OUTPUT_BARS, previous, 0, FPS);
    const frame2 = computeAudioAnalysis(
      raw,
      OUTPUT_BARS,
      frame1.newSmoothed,
      frame1.newCooldown,
      FPS,
    );
    const frame3 = computeAudioAnalysis(
      raw,
      OUTPUT_BARS,
      frame2.newSmoothed,
      frame2.newCooldown,
      FPS,
    );

    const avgFrame1 =
      frame1.smoothedFrequencies.reduce((s, v) => s + v, 0) / OUTPUT_BARS;
    const avgFrame3 =
      frame3.smoothedFrequencies.reduce((s, v) => s + v, 0) / OUTPUT_BARS;

    expect(avgFrame3).toBeGreaterThan(avgFrame1);
  });

  it("attack is faster than release", () => {
    const rising = new Array(512).fill(0);
    for (let i = 0; i < 256; i++) rising[i] = 1.0;
    const falling = new Array(512).fill(0);

    const prev = new Array(OUTPUT_BARS).fill(0);

    const riseResult = computeAudioAnalysis(rising, OUTPUT_BARS, prev, 0, FPS);
    const fallResult = computeAudioAnalysis(
      falling,
      OUTPUT_BARS,
      riseResult.newSmoothed.map((v) => v * 2),
      0,
      FPS,
    );

    const riseDelta = riseResult.smoothedFrequencies.reduce((s, v) => s + v, 0);
    const fallStartAvg =
      riseResult.newSmoothed.reduce((s, v) => s + v * 2, 0) / OUTPUT_BARS;
    const fallEndAvg =
      fallResult.smoothedFrequencies.reduce((s, v) => s + v, 0) / OUTPUT_BARS;
    const fallDelta = fallStartAvg - fallEndAvg;

    expect(riseDelta).toBeGreaterThan(fallDelta);
  });

  it("detects beat on very high bass energy", () => {
    const raw = highBassFFT(512, 500);
    const previous = new Array(OUTPUT_BARS).fill(0);

    const result = computeAudioAnalysis(raw, OUTPUT_BARS, previous, 0, FPS);

    expect(result.beat.isBeat).toBe(true);
    expect(result.beat.intensity).toBeGreaterThan(0);
  });

  it("does not detect beat during cooldown", () => {
    const raw = highBassFFT(512, 500);
    const previous = new Array(OUTPUT_BARS).fill(0);

    const result = computeAudioAnalysis(raw, OUTPUT_BARS, previous, 100, FPS);

    expect(result.beat.isBeat).toBe(false);
    expect(result.beat.intensity).toBe(0);
  });

  it("cooldown decreases each frame when no beat", () => {
    const raw = new Array(512).fill(0);
    const previous = new Array(OUTPUT_BARS).fill(0);

    const result = computeAudioAnalysis(raw, OUTPUT_BARS, previous, 50, FPS);

    expect(result.newCooldown).toBeLessThan(50);
  });

  it("cooldown resets to 100ms on beat", () => {
    const raw = highBassFFT(512, 500);
    const previous = new Array(OUTPUT_BARS).fill(0);

    const result = computeAudioAnalysis(raw, OUTPUT_BARS, previous, 0, FPS);

    if (result.beat.isBeat) {
      expect(result.newCooldown).toBe(100);
    }
  });

  it("returns zero energy for silent input", () => {
    const raw = generateMockFFT(256, { silence: true });
    const previous = new Array(OUTPUT_BARS).fill(0);

    const result = computeAudioAnalysis(raw, OUTPUT_BARS, previous, 0, FPS);

    expect(result.rmsEnergy).toBe(0);
    expect(result.beat.isBeat).toBe(false);
    for (const band of Object.values(result.bands)) {
      expect(band).toBe(0);
    }
  });

  it("rms energy is non-negative", () => {
    const raw = generateMockFFT(512);
    const previous = new Array(OUTPUT_BARS).fill(0);

    const result = computeAudioAnalysis(raw, OUTPUT_BARS, previous, 0, FPS);

    expect(result.rmsEnergy).toBeGreaterThanOrEqual(0);
  });

  it("handles empty FFT input gracefully", () => {
    const previous = new Array(OUTPUT_BARS).fill(0);

    const result = computeAudioAnalysis([], OUTPUT_BARS, previous, 0, FPS);

    expect(result.smoothedFrequencies).toHaveLength(0);
    expect(result.rmsEnergy).toBe(0);
    expect(result.beat.isBeat).toBe(false);
  });

  it("applies different output bar counts", () => {
    const raw = generateMockFFT(512);
    const prev32 = new Array(32).fill(0);
    const prev128 = new Array(128).fill(0);

    const result32 = computeAudioAnalysis(raw, 32, prev32, 0, FPS);
    const result128 = computeAudioAnalysis(raw, 128, prev128, 0, FPS);

    expect(result32.smoothedFrequencies).toHaveLength(32);
    expect(result128.smoothedFrequencies).toHaveLength(128);
  });

  it("maintains state across sequential frames (ref simulation)", () => {
    const fps = 24;
    let smoothed = new Array(OUTPUT_BARS).fill(0);
    let cooldown = 0;
    const beatFrames: number[] = [];

    for (let frame = 0; frame < 100; frame++) {
      const raw =
        frame % 24 === 0 ? highBassFFT(512, 500) : new Array(512).fill(0.01);

      const result = computeAudioAnalysis(
        raw,
        OUTPUT_BARS,
        smoothed,
        cooldown,
        fps,
      );
      smoothed = result.newSmoothed;
      cooldown = result.newCooldown;

      if (result.beat.isBeat) {
        beatFrames.push(frame);
      }
    }

    expect(beatFrames.length).toBeGreaterThan(0);
    for (let i = 1; i < beatFrames.length; i++) {
      const gap = beatFrames[i] - beatFrames[i - 1];
      const gapMs = (gap / fps) * 1000;
      expect(gapMs).toBeGreaterThanOrEqual(95);
    }
  });
});
