import type React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import type { AudioFrequencyData, AudioVizConfig } from "@/lib/video/types";

interface SpectrumBarsProps {
  data: AudioFrequencyData;
  config: AudioVizConfig;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export const SpectrumBars: React.FC<SpectrumBarsProps> = ({ data, config }) => {
  const { width, height } = useVideoConfig();
  const cfg = config.spectrumBars;
  const barCount = data.frequencies.length;
  const color = config.color;
  const rgb = hexToRgb(color);
  const pos = cfg.position;

  const isVertical = pos === "left" || pos === "right";

  if (isVertical) {
    const barHeight = height / barCount;
    const maxBarWidth = width * (cfg.maxHeight / 100);
    const alignRight = pos === "right";

    return (
      <AbsoluteFill
        style={{
          flexDirection: "column",
          opacity: config.opacity,
        }}
      >
        {data.frequencies.map((amplitude, i) => {
          const barWidth = amplitude * maxBarWidth;
          const t = i / barCount;

          return (
            <div
              key={`bar-${i}`}
              style={{
                height: barHeight - cfg.barGap,
                width: Math.max(2, barWidth),
                background: `linear-gradient(to ${alignRight ? "left" : "right"}, ${color}, rgba(${rgb.r},${rgb.g},${rgb.b},0.3))`,
                borderRadius: cfg.borderRadius,
                marginTop: cfg.barGap / 2,
                marginBottom: cfg.barGap / 2,
                boxShadow:
                  cfg.glow && amplitude > 0.3
                    ? `0 0 ${amplitude * 16}px rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`
                    : "none",
              }}
            />
          );
        })}
      </AbsoluteFill>
    );
  }

  const barWidth = width / barCount;
  const maxBarHeight = height * (cfg.maxHeight / 100);
  const growUp = pos !== "top";

  const alignItems: React.CSSProperties["alignItems"] =
    pos === "top"
      ? "flex-start"
      : pos === "center"
        ? "center"
        : "flex-end";

  return (
    <AbsoluteFill
      style={{
        flexDirection: "row",
        alignItems,
        justifyContent: "center",
        opacity: config.opacity,
      }}
    >
      {data.frequencies.map((amplitude, i) => {
        const barHeight = amplitude * maxBarHeight;
        const t = i / barCount;

        return (
          <div
            key={`bar-${i}`}
            style={{
              flexShrink: 0,
              width: barWidth - cfg.barGap,
              height: Math.max(2, barHeight),
              background: pos === "top"
                ? `linear-gradient(to bottom, ${color}, rgba(${rgb.r},${rgb.g},${rgb.b},0.3))`
                : `linear-gradient(to top, ${color}, rgba(${rgb.r},${rgb.g},${rgb.b},0.3))`,
              borderRadius: cfg.borderRadius,
              marginLeft: cfg.barGap / 2,
              marginRight: cfg.barGap / 2,
              boxShadow:
                cfg.glow && amplitude > 0.3
                  ? `0 0 ${amplitude * 16}px rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`
                  : "none",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
