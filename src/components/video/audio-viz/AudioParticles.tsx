import { useFrame } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import type React from "react";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ShaderMaterial,
} from "three";
import { useVideoConfig } from "remotion";
import type { AudioFrequencyData, AudioVizConfig } from "@/lib/video/types";

interface AudioParticlesProps {
  data: AudioFrequencyData;
  config: AudioVizConfig;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

const vertexShader = /* glsl */ `
  attribute float aOpacity;
  attribute float aScale;
  varying float vOpacity;

  void main() {
    vOpacity = aOpacity;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aScale * 300.0 / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vOpacity;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float alpha = 1.0 - smoothstep(0.2, 0.5, dist);
    gl_FragColor = vec4(uColor, alpha * vOpacity);
  }
`;

function randomDirection(): [number, number, number] {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return [
    Math.sin(phi) * Math.cos(theta),
    Math.sin(phi) * Math.sin(theta),
    Math.cos(phi),
  ];
}

interface ParticleState {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  age: number;
  maxAge: number;
}

function initParticle(cfg: AudioVizConfig["particles"]): ParticleState {
  const [dx, dy, dz] = randomDirection();
  return {
    x: 0,
    y: 0,
    z: 0,
    dx,
    dy,
    dz,
    age: Math.random() * (3 + cfg.scale * 0.3),
    maxAge: 3 + cfg.scale * 0.3,
  };
}

function ParticleField({
  data,
  config,
}: {
  data: AudioFrequencyData;
  config: AudioVizConfig;
}) {
  const cfg = config.particles;
  const count = cfg.count;
  const color = useMemo(() => new Color(config.color), [config.color]);
  const rgb = useMemo(() => hexToRgb(config.color), [config.color]);

  const particles = useRef<ParticleState[]>(
    Array.from({ length: count }, () => initParticle(cfg)),
  );

  const positions = useRef(new Float32Array(count * 3));
  const opacities = useRef(new Float32Array(count));
  const scales = useRef(new Float32Array(count));

  const materialRef = useRef<ShaderMaterial>(null);

  useFrame((_, delta) => {
    const audioSpeed = cfg.speed * (0.3 + data.overall * 3);
    const audioSize = cfg.size * (1 + data.bass * 2);
    const maxDist = cfg.scale * 0.5;

    for (let i = 0; i < count; i++) {
      const p = particles.current[i];
      p.age += delta;

      if (p.age >= p.maxAge) {
        const [dx, dy, dz] = randomDirection();
        p.x = 0;
        p.y = 0;
        p.z = 0;
        p.dx = dx;
        p.dy = dy;
        p.dz = dz;
        p.age = 0;
        p.maxAge = 3 + cfg.scale * 0.3;
      }

      p.x += p.dx * audioSpeed * delta;
      p.y += p.dy * audioSpeed * delta;
      p.z += p.dz * audioSpeed * delta;

      const progress = p.age / p.maxAge;
      const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);

      positions.current[i * 3] = p.x;
      positions.current[i * 3 + 1] = p.y;
      positions.current[i * 3 + 2] = p.z;

      const fadeIn = Math.min(progress * 4, 1);
      const fadeOut = 1 - Math.pow(progress, 2);
      opacities.current[i] = fadeIn * fadeOut * config.opacity;

      const growScale = 1 + progress * 3;
      scales.current[i] = audioSize * growScale;
    }

    if (initAttrs) {
      const posAttr = initAttrs.getAttribute("position");
      const opAttr = initAttrs.getAttribute("aOpacity");
      const scAttr = initAttrs.getAttribute("aScale");
      if (posAttr) {
        (posAttr as BufferAttribute).set(positions.current);
        posAttr.needsUpdate = true;
      }
      if (opAttr) {
        (opAttr as BufferAttribute).set(opacities.current);
        opAttr.needsUpdate = true;
      }
      if (scAttr) {
        (scAttr as BufferAttribute).set(scales.current);
        scAttr.needsUpdate = true;
      }
    }

    if (materialRef.current) {
      materialRef.current.uniforms.uColor.value.setRGB(
        rgb[0] / 255,
        rgb[1] / 255,
        rgb[2] / 255,
      );
    }
  });

  const initAttrs = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const op = new Float32Array(count);
    const sc = new Float32Array(count);
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(pos, 3));
    geo.setAttribute("aOpacity", new BufferAttribute(op, 1));
    geo.setAttribute("aScale", new BufferAttribute(sc, 1));
    return geo;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uColor: { value: color },
    }),
    [color],
  );

  return (
    <points geometry={initAttrs}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthTest={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

export const AudioParticles: React.FC<AudioParticlesProps> = ({
  data,
  config,
}) => {
  const { width, height } = useVideoConfig();

  return (
    <ThreeCanvas
      width={width}
      height={height}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
      camera={{ position: [0, 0, 5], fov: 75 }}
      gl={{ alpha: true }}
    >
      <ParticleField data={data} config={config} />
    </ThreeCanvas>
  );
};
