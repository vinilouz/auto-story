import type { FrequencyBands } from "@/lib/audio/analysis";
import type { PostProcessingConfig } from "@/lib/video/types";
import { computePostProcessingParams } from "./post-processing-params";

const DEFAULT_CONFIG: PostProcessingConfig = {
  bloomIntensity: 0.5,
  bloomThreshold: 0.6,
  chromaticOffset: 0.002,
  vignetteDarkness: 0.4,
};

const QUIET_BANDS: FrequencyBands = {
  subBass: 0.1,
  bass: 0.1,
  lowMid: 0.1,
  mid: 0.1,
  highMid: 0.1,
  presence: 0.1,
  brilliance: 0.1,
};

const LOUD_BANDS: FrequencyBands = {
  subBass: 0.9,
  bass: 0.85,
  lowMid: 0.5,
  mid: 0.3,
  highMid: 0.2,
  presence: 0.15,
  brilliance: 0.1,
};

describe("computePostProcessingParams", () => {
  it("returns base bloom intensity when bass is quiet", () => {
    const result = computePostProcessingParams(
      QUIET_BANDS,
      false,
      0,
      DEFAULT_CONFIG,
    );
    expect(result.bloomIntensity).toBeCloseTo(0.5 + 0.1 * 0.5 * 1.5, 5);
  });

  it("increases bloom intensity when bass is loud", () => {
    const result = computePostProcessingParams(
      LOUD_BANDS,
      false,
      0,
      DEFAULT_CONFIG,
    );
    const bassEnergy = (0.9 + 0.85) / 2;
    expect(result.bloomIntensity).toBeCloseTo(0.5 + bassEnergy * 0.5 * 1.5, 5);
    expect(result.bloomIntensity).toBeGreaterThan(0.5 + 0.1 * 0.5 * 1.5);
  });

  it("passes bloom threshold from config unchanged", () => {
    const result = computePostProcessingParams(
      QUIET_BANDS,
      false,
      0,
      DEFAULT_CONFIG,
    );
    expect(result.bloomThreshold).toBe(0.6);
  });

  it("returns zero chromatic offset when no beat detected", () => {
    const result = computePostProcessingParams(
      LOUD_BANDS,
      false,
      0.5,
      DEFAULT_CONFIG,
    );
    expect(result.chromaticOffsetX).toBe(0);
    expect(result.chromaticOffsetY).toBe(0);
  });

  it("increases chromatic offset when beat detected", () => {
    const result = computePostProcessingParams(
      QUIET_BANDS,
      true,
      0.6,
      DEFAULT_CONFIG,
    );
    const expectedMultiplier = 1 + 0.6 * 3;
    expect(result.chromaticOffsetX).toBeCloseTo(0.002 * expectedMultiplier, 6);
    expect(result.chromaticOffsetY).toBeCloseTo(
      0.002 * 0.5 * expectedMultiplier,
      6,
    );
  });

  it("scales chromatic offset with beat intensity", () => {
    const low = computePostProcessingParams(
      QUIET_BANDS,
      true,
      0.2,
      DEFAULT_CONFIG,
    );
    const high = computePostProcessingParams(
      QUIET_BANDS,
      true,
      0.8,
      DEFAULT_CONFIG,
    );
    expect(high.chromaticOffsetX).toBeGreaterThan(low.chromaticOffsetX);
  });

  it("increases vignette darkness when bass is loud", () => {
    const quiet = computePostProcessingParams(
      QUIET_BANDS,
      false,
      0,
      DEFAULT_CONFIG,
    );
    const loud = computePostProcessingParams(
      LOUD_BANDS,
      false,
      0,
      DEFAULT_CONFIG,
    );
    expect(loud.vignetteDarkness).toBeGreaterThan(quiet.vignetteDarkness);
  });

  it("returns base vignette darkness for zero bass", () => {
    const zeroBass: FrequencyBands = {
      ...QUIET_BANDS,
      subBass: 0,
      bass: 0,
    };
    const result = computePostProcessingParams(
      zeroBass,
      false,
      0,
      DEFAULT_CONFIG,
    );
    expect(result.vignetteDarkness).toBe(0.4);
  });

  it("works with different config values", () => {
    const customConfig: PostProcessingConfig = {
      bloomIntensity: 1.0,
      bloomThreshold: 0.8,
      chromaticOffset: 0.005,
      vignetteDarkness: 0.6,
    };
    const result = computePostProcessingParams(
      LOUD_BANDS,
      true,
      0.5,
      customConfig,
    );
    const bassEnergy = (0.9 + 0.85) / 2;
    expect(result.bloomIntensity).toBeCloseTo(1.0 + bassEnergy * 1.0 * 1.5, 5);
    expect(result.bloomThreshold).toBe(0.8);
    expect(result.chromaticOffsetX).toBeCloseTo(0.005 * (1 + 0.5 * 3), 6);
    expect(result.vignetteDarkness).toBeCloseTo(
      0.6 + bassEnergy * 0.6 * 0.8,
      5,
    );
  });
});
