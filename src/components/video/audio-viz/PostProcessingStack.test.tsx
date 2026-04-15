import { render } from "@testing-library/react";
import type { AudioAnalysisData, AudioVizConfig } from "@/lib/video/types";
import { DEFAULT_AUDIO_VIZ_CONFIG } from "@/lib/video/types";
import { PostProcessingStack } from "./PostProcessingStack";

jest.mock("@react-three/postprocessing", () => ({
  EffectComposer: jest.fn(({ children }) => (
    <div data-testid="effect-composer">{children}</div>
  )),
  Bloom: jest.fn(({ intensity, luminanceThreshold }) => (
    <div
      data-testid="bloom"
      data-intensity={intensity}
      data-threshold={luminanceThreshold}
    />
  )),
  ChromaticAberration: jest.fn(({ offset }) => (
    <div
      data-testid="chromatic-aberration"
      data-offset-x={offset?.[0]}
      data-offset-y={offset?.[1]}
    />
  )),
  Vignette: jest.fn(({ darkness }) => (
    <div data-testid="vignette" data-darkness={darkness} />
  )),
}));

jest.mock("postprocessing", () => ({
  BlendFunction: { NORMAL: 0 },
  KernelSize: { LARGE: 3 },
}));

const SAMPLE_DATA: AudioAnalysisData = {
  bands: {
    subBass: 0.5,
    bass: 0.4,
    lowMid: 0.3,
    mid: 0.2,
    highMid: 0.15,
    presence: 0.1,
    brilliance: 0.05,
  },
  beat: { isBeat: false, intensity: 0 },
  smoothedFrequencies: new Array(64).fill(0.3),
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
  beat: { isBeat: true, intensity: 0.7 },
  smoothedFrequencies: new Array(64).fill(0.5),
};

describe("PostProcessingStack", () => {
  it("renders without errors with default config", () => {
    const { container } = render(
      <PostProcessingStack
        data={SAMPLE_DATA}
        config={DEFAULT_AUDIO_VIZ_CONFIG}
      />,
    );
    expect(container).toBeTruthy();
    expect(
      container.querySelector('[data-testid="effect-composer"]'),
    ).toBeTruthy();
  });

  it("renders all three effects", () => {
    const { container } = render(
      <PostProcessingStack
        data={SAMPLE_DATA}
        config={DEFAULT_AUDIO_VIZ_CONFIG}
      />,
    );
    expect(container.querySelector('[data-testid="bloom"]')).toBeTruthy();
    expect(
      container.querySelector('[data-testid="chromatic-aberration"]'),
    ).toBeTruthy();
    expect(container.querySelector('[data-testid="vignette"]')).toBeTruthy();
  });

  it("renders with beat data", () => {
    const { container } = render(
      <PostProcessingStack
        data={BEAT_DATA}
        config={DEFAULT_AUDIO_VIZ_CONFIG}
      />,
    );
    expect(container).toBeTruthy();
  });

  it("renders with custom post-processing config", () => {
    const customConfig: AudioVizConfig = {
      ...DEFAULT_AUDIO_VIZ_CONFIG,
      postProcessing: {
        bloomIntensity: 1.0,
        bloomThreshold: 0.8,
        chromaticOffset: 0.005,
        vignetteDarkness: 0.7,
      },
    };
    const { container } = render(
      <PostProcessingStack data={SAMPLE_DATA} config={customConfig} />,
    );
    expect(container).toBeTruthy();
  });

  it("renders with zero energy data", () => {
    const zeroData: AudioAnalysisData = {
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
      <PostProcessingStack data={zeroData} config={DEFAULT_AUDIO_VIZ_CONFIG} />,
    );
    expect(container).toBeTruthy();
  });
});
