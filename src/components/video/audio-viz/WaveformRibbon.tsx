import type React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import type { AudioFrequencyData, AudioVizConfig } from "@/lib/video/types";

interface WaveformRibbonProps {
  data: AudioFrequencyData;
  config: AudioVizConfig;
}

export const WaveformRibbon: React.FC<WaveformRibbonProps> = ({
  data,
  config,
}) => {
  const { width, height } = useVideoConfig();
  const cfg = config.waveformRibbon;
  const color = config.color;

  const cx = width / 2;
  let cy: number;
  if (cfg.position === "top") cy = height * 0.3;
  else if (cfg.position === "bottom") cy = height * 0.7;
  else cy = height / 2;

  const baseRadius = (cfg.radius / 100) * height;
  const points = 64;
  const freq = data.frequencies;
  const freqLen = freq.length;

  const coords: string[] = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2 - Math.PI / 2;
    const freqIdx = Math.floor((i / points) * freqLen) % freqLen;
    const amp = freq[freqIdx] ?? 0;
    const r = baseRadius + amp * cfg.displacement;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    coords.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const pathD = `M${coords[0]} ${coords
    .slice(1)
    .map((c) => `L${c}`)
    .join(" ")}Z`;

  return (
    <AbsoluteFill>
      <svg
        width={width}
        height={height}
        role="presentation"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          opacity: config.opacity,
        }}
      >
        {cfg.glow && (
          <defs>
            <filter id="waveform-glow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={cfg.thickness}
          strokeLinejoin="round"
          filter={cfg.glow ? "url(#waveform-glow)" : undefined}
        />
      </svg>
    </AbsoluteFill>
  );
};
