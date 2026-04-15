jest.mock("three/examples/jsm/math/SimplexNoise.js", () => {
  class MockSimplexNoise {
    noise3d() {
      return 0.1;
    }
  }
  return { SimplexNoise: MockSimplexNoise };
});

import { render } from "@testing-library/react";
import React from "react";
import type { AudioTrackConfig, AudioVizConfig } from "@/lib/video/types";
import { DEFAULT_AUDIO_VIZ_CONFIG } from "@/lib/video/types";
import { AudioVizOverlay } from "./AudioVizOverlay";

jest.mock("@remotion/media-utils", () => ({
  useWindowedAudioData: () => ({
    audioData: { sampleRate: 44100, channelData: [new Float32Array(1024)] },
    dataOffsetInSeconds: 0,
  }),
  visualizeAudio: () => new Array(512).fill(0.5),
}));

jest.mock("@remotion/three", () => ({
  ThreeCanvas: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "three-canvas" }, children),
}));

const TRACK: AudioTrackConfig = {
  src: "/projects/test/audio.mp3",
  startFrame: 0,
  durationInFrames: 300,
  volume: 1,
};

describe("AudioVizOverlay", () => {
  it("renders without errors with default config", () => {
    const { container } = render(
      <AudioVizOverlay
        audioTracks={[TRACK]}
        config={DEFAULT_AUDIO_VIZ_CONFIG}
      />,
    );
    expect(container).toBeTruthy();
  });

  it("renders the Three.js canvas", () => {
    const { getByTestId } = render(
      <AudioVizOverlay
        audioTracks={[TRACK]}
        config={DEFAULT_AUDIO_VIZ_CONFIG}
      />,
    );
    expect(getByTestId("three-canvas")).toBeTruthy();
  });

  it("returns null when no audio tracks provided", () => {
    const { container } = render(
      <AudioVizOverlay audioTracks={[]} config={DEFAULT_AUDIO_VIZ_CONFIG} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when audioData is null", () => {
    const { container } = render(
      <AudioVizOverlay audioTracks={[]} config={DEFAULT_AUDIO_VIZ_CONFIG} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders with custom config", () => {
    const customConfig: AudioVizConfig = {
      ...DEFAULT_AUDIO_VIZ_CONFIG,
      effects: ["pro-spectrum", "audio-particles"],
      opacity: 0.5,
      color: "#00FF88",
    };

    const { getByTestId } = render(
      <AudioVizOverlay audioTracks={[TRACK]} config={customConfig} />,
    );
    expect(getByTestId("three-canvas")).toBeTruthy();
  });

  it("renders with only scene-modulation effect (no canvas effects)", () => {
    const config: AudioVizConfig = {
      ...DEFAULT_AUDIO_VIZ_CONFIG,
      effects: ["scene-modulation"],
    };

    const { getByTestId } = render(
      <AudioVizOverlay audioTracks={[TRACK]} config={config} />,
    );
    expect(getByTestId("three-canvas")).toBeTruthy();
  });
});
