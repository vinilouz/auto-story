import type React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { VideoScene } from "@/lib/video/types";

export const Scene: React.FC<{
  scene: VideoScene;
  videoVolume?: number;
  audioAmplitude?: number;
  modulationConfig?: { zoomIntensity: number; panIntensity: number };
}> = ({ scene, videoVolume, audioAmplitude, modulationConfig }) => {
  const frame = useCurrentFrame();
  const { width, durationInFrames } = useVideoConfig();

  // Video clip — muted by default (narration is a separate audio track)
  if (scene.videoClipUrl) {
    return (
      <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "black" }}>
        <OffthreadVideo
          src={scene.videoClipUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          volume={videoVolume ?? 0}
        />
      </AbsoluteFill>
    );
  }

  // Static image with Ken Burns effect
  const amp = audioAmplitude ?? 0;
  const zoomFactor = (modulationConfig?.zoomIntensity ?? 20) / 100;
  const panFactor = (modulationConfig?.panIntensity ?? 150) / 100;
  const isZoom = scene.effect === "zoom-in" || scene.effect === "zoom-out";
  const isPan = scene.effect === "pan-left" || scene.effect === "pan-right";

  const zoomBoost = isZoom ? 1 + amp * zoomFactor : 1;
  const panBoost = isPan ? 1 + amp * panFactor : 1;

  const scale = interpolate(
    frame,
    [0, durationInFrames],
    scene.effect === "zoom-in"
      ? [1, 1.15 * zoomBoost]
      : scene.effect === "zoom-out"
        ? [1.15 * zoomBoost, 1]
        : [1.1, 1.1],
    { extrapolateRight: "clamp" },
  );

  const translateX = interpolate(
    frame,
    [0, durationInFrames],
    scene.effect === "pan-left"
      ? [0, -width * 0.05 * panBoost]
      : scene.effect === "pan-right"
        ? [-width * 0.05 * panBoost, 0]
        : [0, 0],
    { extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "black" }}>
      <Img
        src={scene.imageUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transformOrigin: "center center",
          transform: `scale(${scale}) translateX(${translateX}px)`,
        }}
      />
    </AbsoluteFill>
  );
};
