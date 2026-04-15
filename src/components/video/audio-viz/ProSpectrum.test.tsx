import { render } from "@testing-library/react";
import type { AudioAnalysisData, AudioVizConfig } from "@/lib/video/types";
import { DEFAULT_AUDIO_VIZ_CONFIG } from "@/lib/video/types";
import { ProSpectrum } from "./ProSpectrum";

jest.mock("three", () => {
  const actual = jest.requireActual("three");
  return {
    ...actual,
    InstancedBufferAttribute: jest
      .fn()
      .mockImplementation((array, itemSize) => ({
        array,
        itemSize,
        needsUpdate: false,
      })),
    BoxGeometry: jest.fn().mockImplementation(() => ({
      setAttribute: jest.fn(),
    })),
    Matrix4: actual.Matrix4,
    Vector3: actual.Vector3,
    Quaternion: actual.Quaternion,
  };
});

jest.mock("@react-three/fiber", () => ({
  useFrame: jest.fn((cb) => cb()),
  useThree: jest.fn(() => ({
    viewport: { width: 13.6, height: 7.65 },
    gl: { domElement: document.createElement("canvas") },
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
};

describe("ProSpectrum", () => {
  it("renders without errors with default config", () => {
    const { container } = render(
      <ProSpectrum data={SAMPLE_DATA} config={DEFAULT_AUDIO_VIZ_CONFIG} />,
    );
    expect(container).toBeTruthy();
  });

  it("renders with beat data", () => {
    const { container } = render(
      <ProSpectrum data={BEAT_DATA} config={DEFAULT_AUDIO_VIZ_CONFIG} />,
    );
    expect(container).toBeTruthy();
  });

  it("renders with custom config", () => {
    const customConfig: AudioVizConfig = {
      ...DEFAULT_AUDIO_VIZ_CONFIG,
      proSpectrum: {
        barCount: 32,
        cornerRadius: 0.2,
        gap: 4,
        maxHeight: 50,
        reflectionOpacity: 0.5,
        glowIntensity: 0.8,
        position: "center",
      },
    };

    const { container } = render(
      <ProSpectrum data={SAMPLE_DATA} config={customConfig} />,
    );
    expect(container).toBeTruthy();
  });

  it("renders with different positions", () => {
    for (const position of ["bottom", "top", "center"] as const) {
      const config: AudioVizConfig = {
        ...DEFAULT_AUDIO_VIZ_CONFIG,
        proSpectrum: {
          ...DEFAULT_AUDIO_VIZ_CONFIG.proSpectrum,
          position,
        },
      };
      const { container } = render(
        <ProSpectrum data={SAMPLE_DATA} config={config} />,
      );
      expect(container).toBeTruthy();
    }
  });

  it("renders with custom viewport dimensions", () => {
    const { container } = render(
      <ProSpectrum
        data={SAMPLE_DATA}
        config={DEFAULT_AUDIO_VIZ_CONFIG}
        viewportWidth={20}
        viewportHeight={12}
      />,
    );
    expect(container).toBeTruthy();
  });

  it("handles empty frequency data", () => {
    const emptyData: AudioAnalysisData = {
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
      smoothedFrequencies: [],
    };

    const { container } = render(
      <ProSpectrum data={emptyData} config={DEFAULT_AUDIO_VIZ_CONFIG} />,
    );
    expect(container).toBeTruthy();
  });

  it("renders with custom color", () => {
    const config: AudioVizConfig = {
      ...DEFAULT_AUDIO_VIZ_CONFIG,
      color: "#00FF88",
    };

    const { container } = render(
      <ProSpectrum data={SAMPLE_DATA} config={config} />,
    );
    expect(container).toBeTruthy();
  });
});
