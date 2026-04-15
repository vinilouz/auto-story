import type React from "react";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { AudioAnalysisData, AudioVizConfig } from "@/lib/video/types";
import {
  classifyBeat,
  computeParticleAttributes,
  emitBurst,
  initializeParticles,
  updateParticles,
} from "./audio-particles-geometry";
import { createNoiseField } from "./audio-particles-noise";

const vertexShader = `
precision highp float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

attribute vec3 position;
attribute float aSize;
attribute float aOpacity;
attribute vec3 aColor;

uniform float uPixelRatio;

varying float vOpacity;
varying vec3 vColor;

void main() {
  vOpacity = aOpacity;
  vColor = aColor;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = aSize * uPixelRatio * (300.0 / -mvPos.z);
  gl_PointSize = clamp(gl_PointSize, 1.0, 128.0);
}
`;

const fragmentShader = `
precision highp float;

uniform vec3 uColor;
uniform float uGlowRadius;

varying float vOpacity;
varying vec3 vColor;

void main() {
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  if (dist > 0.5) discard;

  float softEdge = smoothstep(0.5, 0.5 - uGlowRadius, dist);
  float core = smoothstep(0.3, 0.0, dist);
  float alpha = (softEdge * 0.6 + core * 0.4) * vOpacity;

  vec3 color = uColor * vColor + core * 0.3;

  gl_FragColor = vec4(color, alpha);
}
`;

interface AudioParticlesProps {
  data: AudioAnalysisData;
  config: AudioVizConfig;
}

export const AudioParticles: React.FC<AudioParticlesProps> = ({
  data,
  config,
}) => {
  const particlesConfig = config.audioParticles;
  const count = particlesConfig.count;

  const noiseRef = useRef(createNoiseField(42));
  const timeRef = useRef(0);

  const buffers = useMemo(() => {
    const seededRng = (() => {
      let s = 42;
      return () => {
        s = ((s * 1664525 + 1013904223) | 0) >>> 0;
        return s / 4294967296;
      };
    })();
    return initializeParticles(count, seededRng);
  }, [count]);

  const prevBeatRef = useRef(false);

  const positionAttribute = useMemo(
    () => new THREE.BufferAttribute(buffers.positions, 3),
    [buffers.positions],
  );

  const sizeAttribute = useMemo(
    () => new THREE.BufferAttribute(new Float32Array(count), 1),
    [count],
  );

  const opacityAttribute = useMemo(
    () => new THREE.BufferAttribute(new Float32Array(count), 1),
    [count],
  );

  const colorAttribute = useMemo(
    () => new THREE.BufferAttribute(buffers.colors, 3),
    [buffers.colors],
  );

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", positionAttribute);
    geo.setAttribute("aSize", sizeAttribute);
    geo.setAttribute("aOpacity", opacityAttribute);
    geo.setAttribute("aColor", colorAttribute);
    return geo;
  }, [positionAttribute, sizeAttribute, opacityAttribute, colorAttribute]);

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(config.color) },
      uPixelRatio: { value: 1 },
      uGlowRadius: { value: 0.15 },
    }),
    [config.color],
  );

  const { bands, beat } = data;
  const bassEnergy = (bands.subBass + bands.bass) / 2;
  const midEnergy = (bands.lowMid + bands.mid + bands.highMid) / 3;
  const trebleEnergy = (bands.presence + bands.brilliance) / 2;

  timeRef.current += 1 / 30;

  updateParticles(
    buffers,
    noiseRef.current,
    timeRef.current,
    1 / 30,
    particlesConfig,
    bassEnergy,
    midEnergy,
    trebleEnergy,
  );

  const beatType = classifyBeat(bands, beat.isBeat);
  if (beat.isBeat && !prevBeatRef.current) {
    emitBurst(buffers, beatType, particlesConfig);
  }
  prevBeatRef.current = beat.isBeat;

  const attrs = computeParticleAttributes(
    buffers,
    particlesConfig,
    trebleEnergy,
    config.opacity,
  );

  sizeAttribute.array.set(attrs.aSize);
  sizeAttribute.needsUpdate = true;
  opacityAttribute.array.set(attrs.aOpacity);
  opacityAttribute.needsUpdate = true;
  colorAttribute.needsUpdate = true;
  positionAttribute.needsUpdate = true;

  return (
    <points>
      <primitive object={geometry} attach="geometry" />
      <rawShaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
