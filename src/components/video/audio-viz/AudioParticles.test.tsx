import { render } from "@testing-library/react";
import type { AudioAnalysisData, AudioVizConfig } from "@/lib/video/types";
import { DEFAULT_AUDIO_VIZ_CONFIG } from "@/lib/video/types";
import { AudioParticles } from "./AudioParticles";

jest.mock("three", () => {
  const actual = jest.requireActual("three");
  return {
    ...actual,
    BufferGeometry: jest.fn().mockImplementation(() => ({
      setAttribute: jest.fn(),
    })),
    BufferAttribute: jest.fn().mockImplementation((array, itemSize) => ({
      array,
      itemSize,
      needsUpdate: false,
    })),
    AdditiveBlending: 2,
  };
});

jest.mock("@react-three/fiber", () => ({
  useFrame: jest.fn((cb) => cb()),
  useThree: jest.fn(() => ({
    viewport: { width: 13.6, height: 7.65 },
    gl: {
      domElement: document.createElement("canvas"),
      getPixelRatio: () => 1,
    },
  })),
}));

jest.mock("three/examples/jsm/math/SimplexNoise.js", () => {
  return {
    SimplexNoise: jest.fn().mockImplementation(() => ({
      noise3d: () => 0.1,
      noise: () => 0.1,
    })),
  };
});

const SAMPLE_DATA: AudioAnalysisData = {
  bands: {
    subBass: 0.6,
    bass: 0.5,
    lowMid: 0.4,
    mid: 0.3,
    highMid: 0.2,
    presence: 0.15,
    brilliance: 0.1,
  },
  beat: { isBeat: false, intensity: 0 },
  smoothedFrequencies: new Array(64).fill(0.4),
  rmsEnergy: 0.35,
};

const BEAT_DATA: AudioAnalysisData = {
  bands: {
    subBass: 0.9,
    bass: 0.85,
    lowMid: 0.5,
    mid: 0.3,
    highMid: 0.2,
    presence: 0.15,
    brilliance: 0.1,
  },
  beat: { isBeat: true, intensity: 0.6 },
  smoothedFrequencies: new Array(64)
    .fill(0.4)
    .map((v, i) => (i < 16 ? 0.9 : v)),
  rmsEnergy: 0.6,
};

describe("AudioParticles", () => {
  it("renders without errors with default config", () => {
    const { container } = render(
      <AudioParticles data={SAMPLE_DATA} config={DEFAULT_AUDIO_VIZ_CONFIG} />,
    );
    expect(container).toBeTruthy();
  });

  it("renders with beat data", () => {
    const { container } = render(
      <AudioParticles data={BEAT_DATA} config={DEFAULT_AUDIO_VIZ_CONFIG} />,
    );
    expect(container).toBeTruthy();
  });

  it("renders with custom config", () => {
    const customConfig: AudioVizConfig = {
      ...DEFAULT_AUDIO_VIZ_CONFIG,
      audioParticles: {
        count: 500,
        noiseScale: 2.0,
        trailLength: 0.8,
        turbulence: 2.0,
        baseSize: 3,
        maxSize: 10,
      },
    };
    const { container } = render(
      <AudioParticles data={SAMPLE_DATA} config={customConfig} />,
    );
    expect(container).toBeTruthy();
  });

  it("renders with custom color", () => {
    const config: AudioVizConfig = {
      ...DEFAULT_AUDIO_VIZ_CONFIG,
      color: "#00FF88",
    };
    const { container } = render(
      <AudioParticles data={SAMPLE_DATA} config={config} />,
    );
    expect(container).toBeTruthy();
  });

  it("handles high energy across all bands", () => {
    const highEnergyData: AudioAnalysisData = {
      bands: {
        subBass: 0.95,
        bass: 0.95,
        lowMid: 0.9,
        mid: 0.9,
        highMid: 0.85,
        presence: 0.8,
        brilliance: 0.8,
      },
      beat: { isBeat: true, intensity: 0.9 },
      smoothedFrequencies: new Array(64).fill(0.9),
      rmsEnergy: 0.9,
    };
    const { container } = render(
      <AudioParticles
        data={highEnergyData}
        config={DEFAULT_AUDIO_VIZ_CONFIG}
      />,
    );
    expect(container).toBeTruthy();
  });

  it("handles silence (all zeros)", () => {
    const silentData: AudioAnalysisData = {
      bands: {
        subBass: 0,
        bass: 0,
        lowMid: 0,
        mid: 0,
        highMid: 0,
        presence: 0,
        brilliance: 0,
      },
      beat: { isBeat: false, intensity: 0 },
      smoothedFrequencies: new Array(64).fill(0),
      rmsEnergy: 0,
    };
    const { container } = render(
      <AudioParticles data={silentData} config={DEFAULT_AUDIO_VIZ_CONFIG} />,
    );
    expect(container).toBeTruthy();
  });

  it("renders with low opacity", () => {
    const config: AudioVizConfig = {
      ...DEFAULT_AUDIO_VIZ_CONFIG,
      opacity: 0.1,
    };
    const { container } = render(
      <AudioParticles data={SAMPLE_DATA} config={config} />,
    );
    expect(container).toBeTruthy();
  });
});
