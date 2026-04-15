import type React from "react";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { AudioAnalysisData, AudioVizConfig } from "@/lib/video/types";
import {
  calculateBeatPulse,
  computeLineColors,
  computeWaveformPoints,
  getPositionY,
} from "./smooth-waveform-geometry";

const SUBDIVISIONS = 4;

interface SmoothWaveformProps {
  data: AudioAnalysisData;
  config: AudioVizConfig;
  viewportWidth?: number;
  viewportHeight?: number;
}

export const SmoothWaveform: React.FC<SmoothWaveformProps> = ({
  data,
  config,
  viewportWidth = 13.6,
  viewportHeight = 7.65,
}) => {
  const mainLineRef = useRef<Line2>(null);
  const glowLineRef = useRef<Line2>(null);
  const beatPulseRef = useRef(0);

  const wfConfig = config.smoothWaveform;
  const positionY = useMemo(
    () => getPositionY(wfConfig.position, viewportHeight),
    [wfConfig.position, viewportHeight],
  );

  const spreadWidth = viewportWidth * 0.85;
  const maxHeight = viewportHeight * 0.15;

  beatPulseRef.current = calculateBeatPulse(
    data.beat.isBeat,
    data.beat.intensity,
    beatPulseRef.current,
  );

  const mainPositions = computeWaveformPoints(
    data.smoothedFrequencies,
    spreadWidth,
    positionY,
    maxHeight,
    SUBDIVISIONS,
    wfConfig.splineTension,
    beatPulseRef.current,
  );

  const glowPositions = useMemo(() => {
    const count = mainPositions.length / 3;
    const glow = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      glow[i * 3] = mainPositions[i * 3];
      glow[i * 3 + 1] = mainPositions[i * 3 + 1];
      glow[i * 3 + 2] = 0;
    }
    return glow;
  }, [mainPositions]);

  const pointCount = mainPositions.length / 3;

  const interpolatedAmplitudes = useMemo(() => {
    const amps: number[] = [];
    for (let i = 0; i < pointCount; i++) {
      const y = mainPositions[i * 3 + 1];
      const normalizedY = Math.abs(y - positionY) / maxHeight;
      amps.push(Math.min(1, normalizedY));
    }
    return amps;
  }, [mainPositions, positionY, maxHeight, pointCount]);

  const mainColors = useMemo(
    () =>
      computeLineColors(
        pointCount,
        config.color,
        wfConfig.colorMapping,
        interpolatedAmplitudes,
      ),
    [pointCount, config.color, wfConfig.colorMapping, interpolatedAmplitudes],
  );

  const glowColors = useMemo(() => {
    const colors = new Float32Array(mainColors.length);
    for (let i = 0; i < mainColors.length; i++) {
      colors[i] = mainColors[i] * wfConfig.glowIntensity;
    }
    return colors;
  }, [mainColors, wfConfig.glowIntensity]);

  const mainGeometry = useMemo(() => {
    const geo = new LineGeometry();
    geo.setPositions(mainPositions);
    geo.setColors(mainColors);
    return geo;
  }, [mainPositions, mainColors]);

  const glowGeometry = useMemo(() => {
    const geo = new LineGeometry();
    geo.setPositions(glowPositions);
    geo.setColors(glowColors);
    return geo;
  }, [glowPositions, glowColors]);

  const mainMaterial = useMemo(
    () =>
      new LineMaterial({
        color: 0xffffff,
        linewidth: 3 * wfConfig.thicknessScale,
        vertexColors: true,
        resolution: new THREE.Vector2(
          viewportWidth * 100,
          viewportHeight * 100,
        ),
        worldUnits: false,
        transparent: true,
        opacity: config.opacity,
        depthWrite: false,
      }),
    [wfConfig.thicknessScale, viewportWidth, viewportHeight, config.opacity],
  );

  const glowMaterial = useMemo(
    () =>
      new LineMaterial({
        color: 0xffffff,
        linewidth: 12 * wfConfig.thicknessScale * wfConfig.glowIntensity,
        vertexColors: true,
        resolution: new THREE.Vector2(
          viewportWidth * 100,
          viewportHeight * 100,
        ),
        worldUnits: false,
        transparent: true,
        opacity: config.opacity * 0.3 * wfConfig.glowIntensity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [
      wfConfig.thicknessScale,
      wfConfig.glowIntensity,
      viewportWidth,
      viewportHeight,
      config.opacity,
    ],
  );

  return (
    <group>
      <primitive
        ref={glowLineRef}
        object={new Line2(glowGeometry, glowMaterial)}
      />
      <primitive
        ref={mainLineRef}
        object={new Line2(mainGeometry, mainMaterial)}
      />
    </group>
  );
};
