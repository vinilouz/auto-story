import type React from "react";
import { useEffect, useRef } from "react";
import type { AudioAnalysisData, AudioVizConfig } from "@/lib/video/types";

interface WaveformCanvasProps {
  data: AudioAnalysisData;
  config: AudioVizConfig;
  width: number;
  height: number;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  data,
  config,
  width,
  height,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const cfg = config.smoothWaveform;
  const centerY =
    cfg.position === "top"
      ? height * 0.25
      : cfg.position === "bottom"
        ? height * 0.75
        : height * 0.5;
  const maxDisplacement = height * 0.12;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const frequencies = data.smoothedFrequencies;
    if (frequencies.length === 0) return;

    const pointCount = frequencies.length;
    const stepX = width / (pointCount - 1);

    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < pointCount; i++) {
      const amplitude = frequencies[i] ?? 0;
      points.push({
        x: i * stepX,
        y: centerY - amplitude * maxDisplacement,
      });
    }

    const gradient = ctx.createLinearGradient(
      0,
      centerY - maxDisplacement,
      0,
      centerY + maxDisplacement,
    );
    gradient.addColorStop(0, config.color);
    gradient.addColorStop(0.5, config.color);
    gradient.addColorStop(1, "transparent");

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
      const cpx = (points[i].x + points[i + 1].x) / 2;
      const cpy = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, cpx, cpy);
    }

    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2 * cfg.thicknessScale;
    ctx.shadowColor = config.color;
    ctx.shadowBlur = 8 * cfg.glowIntensity;
    ctx.globalAlpha = config.opacity;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }, [
    data,
    config,
    width,
    height,
    centerY,
    maxDisplacement,
    cfg.glowIntensity,
    cfg.thicknessScale,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
    />
  );
};
