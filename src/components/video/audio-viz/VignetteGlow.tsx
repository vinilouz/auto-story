import type React from "react";
import { AbsoluteFill, interpolate, useVideoConfig } from "remotion";
import type { AudioFrequencyData, AudioVizConfig } from "@/lib/video/types";

interface VignetteGlowProps {
  data: AudioFrequencyData;
  config: AudioVizConfig;
}

export const VignetteGlow: React.FC<VignetteGlowProps> = ({ data, config }) => {
  const { width, height } = useVideoConfig();
  const cfg = config.vignetteGlow;
  const color = config.color;
  const bassIntensity = interpolate(data.bass, [0, 0.25], [
    cfg.minOpacity / 100,
    cfg.maxOpacity / 100,
  ]);
  const alpha = Math.round(bassIntensity * config.opacity * 255)
    .toString(16)
    .padStart(2, "0");

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse ${width * (cfg.spread / 100)}px ${height * (cfg.spread / 100)}px at center, transparent 40%, ${color}${alpha} 100%)`,
      }}
    />
  );
};
