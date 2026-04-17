import type React from "react";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { AudioAnalysisData, AudioVizConfig } from "@/lib/video/types";

const vertexShader = `
attribute float aSize;
attribute float aOpacity;
varying float vOpacity;

void main() {
  vOpacity = aOpacity;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = aSize * (200.0 / -mvPos.z);
  gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);
}
`;

const fragmentShader = `
uniform vec3 uColor;
varying float vOpacity;

void main() {
  float dist = length(gl_PointCoord - 0.5);
  if (dist > 0.5) discard;
  float alpha = smoothstep(0.5, 0.1, dist) * vOpacity;
  gl_FragColor = vec4(uColor, alpha);
}
`;

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface AudioParticlesProps {
  data: AudioAnalysisData;
  config: AudioVizConfig;
}

export const AudioParticles: React.FC<AudioParticlesProps> = ({
  data,
  config,
}) => {
  const cfg = config.audioParticles;
  const count = cfg.count;

  const particlesRef = useRef<Particle[]>([]);
  const initialized = useRef(false);

  const positionArray = useRef(new Float32Array(count * 3));
  const sizeArray = useRef(new Float32Array(count));
  const opacityArray = useRef(new Float32Array(count));

  const positionAttr = useMemo(
    () => new THREE.BufferAttribute(positionArray.current, 3),
    [],
  );
  const sizeAttr = useMemo(
    () => new THREE.BufferAttribute(sizeArray.current, 1),
    [],
  );
  const opacityAttr = useMemo(
    () => new THREE.BufferAttribute(opacityArray.current, 1),
    [],
  );

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", positionAttr);
    geo.setAttribute("aSize", sizeAttr);
    geo.setAttribute("aOpacity", opacityAttr);
    return geo;
  }, [positionAttr, sizeAttr, opacityAttr]);

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(config.color) },
    }),
    [config.color],
  );

  if (!initialized.current) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.random() * 4;
      particlesRef.current.push({
        x: Math.cos(angle) * spread,
        y: (Math.random() - 0.5) * 4,
        z: (Math.random() - 0.5) * 2,
        vx: (Math.random() - 0.5) * 0.02,
        vy: (Math.random() - 0.5) * 0.02,
        vz: (Math.random() - 0.5) * 0.01,
        life: Math.random(),
        maxLife: 2 + Math.random() * 3,
      });
    }
    initialized.current = true;
  }

  const bassEnergy = (data.bands.subBass + data.bands.bass) / 2;
  const midEnergy = (data.bands.lowMid + data.bands.mid) / 3;
  const overallEnergy =
    data.smoothedFrequencies.reduce((s, v) => s + v, 0) /
    data.smoothedFrequencies.length;
  const speed = 0.3 + bassEnergy * 2;
  const sizeMod = 1 + midEnergy * 3;

  for (let i = 0; i < count; i++) {
    const p = particlesRef.current[i];
    p.life += 0.016;

    if (p.life >= p.maxLife || Math.abs(p.x) > 8 || Math.abs(p.y) > 5) {
      const angle = Math.random() * Math.PI * 2;
      const burst = data.beat.isBeat ? 0.1 + data.beat.intensity * 0.05 : 0.02;
      p.x = (Math.random() - 0.5) * 2;
      p.y = (Math.random() - 0.5) * 2;
      p.z = Math.random() - 0.5;
      p.vx = Math.cos(angle) * burst;
      p.vy = Math.sin(angle) * burst;
      p.vz = (Math.random() - 0.5) * burst;
      p.life = 0;
      p.maxLife = 2 + Math.random() * 3;
    }

    p.x += p.vx * speed;
    p.y += p.vy * speed;
    p.z += p.vz * speed;

    p.vx += (Math.random() - 0.5) * 0.002 * speed;
    p.vy += (Math.random() - 0.5) * 0.002 * speed;

    const lifeRatio = p.life / p.maxLife;
    const fadeIn = Math.min(lifeRatio * 5, 1);
    const fadeOut = 1 - lifeRatio * lifeRatio;

    positionArray.current[i * 3] = p.x;
    positionArray.current[i * 3 + 1] = p.y;
    positionArray.current[i * 3 + 2] = p.z;
    sizeArray.current[i] =
      (cfg.baseSize + overallEnergy * cfg.maxSize) * sizeMod * fadeIn;
    opacityArray.current[i] = fadeIn * fadeOut * config.opacity;
  }

  positionAttr.needsUpdate = true;
  sizeAttr.needsUpdate = true;
  opacityAttr.needsUpdate = true;

  return (
    <points>
      <primitive object={geometry} attach="geometry" />
      <shaderMaterial
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
