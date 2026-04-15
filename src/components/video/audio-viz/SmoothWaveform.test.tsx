import { render } from "@testing-library/react";
import type { AudioAnalysisData, AudioVizConfig } from "@/lib/video/types";
import { DEFAULT_AUDIO_VIZ_CONFIG } from "@/lib/video/types";
import { SmoothWaveform } from "./SmoothWaveform";

jest.mock("three", () => {
  const actual = jest.requireActual("three");
  return {
    ...actual,
    AdditiveBlending: 2,
    Vector2: actual.Vector2,
    Color: actual.Color,
  };
});

jest.mock("three/examples/jsm/lines/Line2.js", () => ({
  Line2: jest.fn().mockImplementation(() => ({
    computeLineDistances: jest.fn(),
  })),
}));

jest.mock("three/examples/jsm/lines/LineGeometry.js", () => ({
  LineGeometry: jest.fn().mockImplementation(() => ({
    setPositions: jest.fn(),
    setColors: jest.fn(),
  })),
}));

jest.mock("three/examples/jsm/lines/LineMaterial.js", () => ({
  LineMaterial: jest
    .fn()
    .mockImplementation((opts: Record<string, unknown>) => opts),
}));

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

describe("SmoothWaveform", () => {
  it("renders without errors with default config", () => {
    const { container } = render(
      <SmoothWaveform data={SAMPLE_DATA} config={DEFAULT_AUDIO_VIZ_CONFIG} />,
    );
    expect(container).toBeTruthy();
  });

  it("renders with beat data", () => {
    const { container } = render(
      <SmoothWaveform data={BEAT_DATA} config={DEFAULT_AUDIO_VIZ_CONFIG} />,
    );
    expect(container).toBeTruthy();
  });

  it("renders with custom config", () => {
    const customConfig: AudioVizConfig = {
      ...DEFAULT_AUDIO_VIZ_CONFIG,
      smoothWaveform: {
        position: "bottom",
        splineTension: 0.8,
        glowIntensity: 0.7,
        thicknessScale: 2.0,
        colorMapping: "amplitude",
      },
    };
    const { container } = render(
      <SmoothWaveform data={SAMPLE_DATA} config={customConfig} />,
    );
    expect(container).toBeTruthy();
  });

  it("renders with fixed color mapping", () => {
    const config: AudioVizConfig = {
      ...DEFAULT_AUDIO_VIZ_CONFIG,
      smoothWaveform: {
        ...DEFAULT_AUDIO_VIZ_CONFIG.smoothWaveform,
        colorMapping: "fixed",
      },
    };
    const { container } = render(
      <SmoothWaveform data={SAMPLE_DATA} config={config} />,
    );
    expect(container).toBeTruthy();
  });

  it("renders with top position", () => {
    const config: AudioVizConfig = {
      ...DEFAULT_AUDIO_VIZ_CONFIG,
      smoothWaveform: {
        ...DEFAULT_AUDIO_VIZ_CONFIG.smoothWaveform,
        position: "top",
      },
    };
    const { container } = render(
      <SmoothWaveform data={SAMPLE_DATA} config={config} />,
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
      <SmoothWaveform data={silentData} config={DEFAULT_AUDIO_VIZ_CONFIG} />,
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
      <SmoothWaveform
        data={highEnergyData}
        config={DEFAULT_AUDIO_VIZ_CONFIG}
      />,
    );
    expect(container).toBeTruthy();
  });

  it("renders with custom viewport dimensions", () => {
    const { container } = render(
      <SmoothWaveform
        data={SAMPLE_DATA}
        config={DEFAULT_AUDIO_VIZ_CONFIG}
        viewportWidth={19.2}
        viewportHeight={10.8}
      />,
    );
    expect(container).toBeTruthy();
  });
});
