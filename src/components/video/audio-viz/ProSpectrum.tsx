import type React from "react";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { AudioAnalysisData, AudioVizConfig } from "@/lib/video/types";

interface ProSpectrumProps {
  data: AudioAnalysisData;
  config: AudioVizConfig;
}

function hexToRgb(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

export const ProSpectrum: React.FC<ProSpectrumProps> = ({ data, config }) => {
  const beatFlashRef = useRef(0);
  const prevBeatRef = useRef(false);

  const cfg = config.proSpectrum;
  const barCount = cfg.barCount;
  const baseColor = useMemo(() => hexToRgb(config.color), [config.color]);

  const spreadX = 10;
  const maxHeight = 2.5;
  const barWidth = spreadX / barCount - cfg.gap * 0.02;
  const positionY =
    cfg.position === "bottom" ? -3.3 : cfg.position === "top" ? 3.3 : 0;

  const frequencies = data.smoothedFrequencies;
  const displayCount = Math.min(barCount, frequencies.length);

  if (data.beat.isBeat && !prevBeatRef.current) {
    beatFlashRef.current = 1;
  }
  prevBeatRef.current = data.beat.isBeat;
  beatFlashRef.current *= 0.85;

  const bars: React.ReactElement[] = [];
  const reflections: React.ReactElement[] = [];

  for (let i = 0; i < displayCount; i++) {
    const amplitude = frequencies[i] ?? 0;
    const barHeight = Math.max(0.05, amplitude * maxHeight);
    const x = (i / displayCount - 0.5) * spreadX;

    const t = i / displayCount;
    const barColor = baseColor.clone().lerp(new THREE.Color(1, 1, 1), t * 0.3);

    if (t < 0.25) {
      barColor.lerp(new THREE.Color(1, 0.6, 0.1), beatFlashRef.current * 0.4);
    }

    const geometry = new THREE.BoxGeometry(barWidth, barHeight, 0.1);

    bars.push(
      <mesh
        key={`bar-${i}`}
        position={[x, positionY + barHeight / 2, 0]}
        geometry={geometry}
      >
        <meshStandardMaterial
          color={barColor}
          emissive={barColor}
          emissiveIntensity={0.3 + amplitude * 0.5}
          transparent
          opacity={config.opacity}
        />
      </mesh>,
    );

    if (cfg.reflectionOpacity > 0) {
      reflections.push(
        <mesh
          key={`ref-${i}`}
          position={[x, positionY - barHeight / 2, 0]}
          geometry={geometry}
          scale={[1, -1, 1]}
        >
          <meshStandardMaterial
            color={barColor}
            emissive={barColor}
            emissiveIntensity={0.1}
            transparent
            opacity={cfg.reflectionOpacity * config.opacity * 0.5}
          />
        </mesh>,
      );
    }
  }

  return (
    <group>
      {bars}
      {reflections}
    </group>
  );
};
