import type React from "react";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { AudioAnalysisData, AudioVizConfig } from "@/lib/video/types";
import {
  calculateBarPositions,
  calculateBeatFlash,
  computeInstanceTransforms,
  parseHexColor,
} from "./pro-spectrum-geometry";

const vertexShader = `
precision highp float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

attribute mat4 instanceMatrix;
attribute vec3 aInstanceColor;

attribute vec3 position;
attribute vec2 uv;

varying vec2 vUv;
varying vec3 vColor;

void main() {
  vUv = uv;
  vColor = aInstanceColor;
  vec4 worldPos = instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * worldPos;
}
`;

const fragmentShader = `
precision highp float;

uniform float uBeatFlash;
uniform float uGlowIntensity;
uniform float uCornerRadius;
uniform float uOpacity;
uniform bool uIsReflection;
uniform float uReflectionOpacity;

varying vec2 vUv;
varying vec3 vColor;

void main() {
  vec2 uv = vUv;

  // Rounded top corners via SDF
  float alpha = 1.0;
  float cr = uCornerRadius;
  if (uv.y > 1.0 - cr && cr > 0.001) {
    float dx = max(0.0, abs(uv.x - 0.5) - (0.5 - cr));
    float dy = uv.y - (1.0 - cr);
    float dist = length(vec2(dx, dy));
    alpha = smoothstep(cr, cr - 0.03, dist);
  }

  // Vertical gradient (darker base, lighter top)
  vec3 lighter = vColor * 1.4;
  vec3 gradientColor = mix(vColor * 0.8, lighter, uv.y);

  // Glow at edges — softer alpha near bar boundaries
  float edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float glow = smoothstep(0.0, 0.08 * uGlowIntensity, edgeDist);
  alpha *= mix(0.6, 1.0, glow);

  // Beat flash on bass bars
  gradientColor += vec3(uBeatFlash * 0.2);

  // Reflection: fade from top (near bars) to bottom
  if (uIsReflection) {
    alpha *= uReflectionOpacity * (1.0 - uv.y);
  }

  alpha *= uOpacity;

  if (alpha < 0.01) discard;

  gl_FragColor = vec4(gradientColor, alpha);
}
`;

interface ProSpectrumProps {
  data: AudioAnalysisData;
  config: AudioVizConfig;
  viewportWidth?: number;
  viewportHeight?: number;
}

function getPositionY(
  position: "bottom" | "top" | "center",
  viewportHeight: number,
): number {
  const halfH = viewportHeight / 2;
  switch (position) {
    case "bottom":
      return -halfH + 0.5;
    case "top":
      return halfH - 0.5;
    case "center":
      return 0;
  }
}

export const ProSpectrum: React.FC<ProSpectrumProps> = ({
  data,
  config,
  viewportWidth = 13.6,
  viewportHeight = 7.65,
}) => {
  const mainRef = useRef<THREE.InstancedMesh>(null);
  const reflectionRef = useRef<THREE.InstancedMesh>(null);
  const beatFlashRef = useRef(0);
  const colorArrayRef = useRef<Float32Array | null>(null);

  const barCount = config.proSpectrum.barCount;
  const baseColor = useMemo(() => parseHexColor(config.color), [config.color]);
  const spreadWidth = viewportWidth * 0.8;

  const barPositions = useMemo(
    () =>
      calculateBarPositions(barCount, config.proSpectrum.gap / 50, spreadWidth),
    [barCount, config.proSpectrum.gap, spreadWidth],
  );

  const positionY = useMemo(
    () => getPositionY(config.proSpectrum.position, viewportHeight),
    [config.proSpectrum.position, viewportHeight],
  );

  const scaledMaxHeight = config.proSpectrum.maxHeight / 10;

  const mainUniforms = useMemo(
    () => ({
      uBeatFlash: { value: 0 },
      uGlowIntensity: { value: config.proSpectrum.glowIntensity },
      uCornerRadius: { value: config.proSpectrum.cornerRadius },
      uOpacity: { value: config.opacity },
      uIsReflection: { value: false },
      uReflectionOpacity: { value: config.proSpectrum.reflectionOpacity },
    }),
    [
      config.proSpectrum.glowIntensity,
      config.proSpectrum.cornerRadius,
      config.opacity,
      config.proSpectrum.reflectionOpacity,
    ],
  );

  const reflectionUniforms = useMemo(
    () => ({
      uBeatFlash: { value: 0 },
      uGlowIntensity: { value: config.proSpectrum.glowIntensity },
      uCornerRadius: { value: config.proSpectrum.cornerRadius },
      uOpacity: { value: config.opacity },
      uIsReflection: { value: true },
      uReflectionOpacity: { value: config.proSpectrum.reflectionOpacity },
    }),
    [
      config.proSpectrum.glowIntensity,
      config.proSpectrum.cornerRadius,
      config.opacity,
      config.proSpectrum.reflectionOpacity,
    ],
  );

  const colorAttribute = useMemo(() => {
    const arr = new Float32Array(barCount * 3);
    colorArrayRef.current = arr;
    return new THREE.InstancedBufferAttribute(arr, 3);
  }, [barCount]);

  const reflectionColorAttribute = useMemo(
    () => new THREE.InstancedBufferAttribute(new Float32Array(barCount * 3), 3),
    [barCount],
  );

  const reusableMatrix = useRef(new THREE.Matrix4());
  const reusableReflection = useRef(new THREE.Matrix4());
  const reusablePos = useRef(new THREE.Vector3());
  const reusableQuat = useRef(new THREE.Quaternion());
  const reusableScale = useRef(new THREE.Vector3());
  const reusableReflectionPos = useRef(new THREE.Vector3());
  const reusableReflectionScale = useRef(new THREE.Vector3());

  const updateInstances = () => {
    if (!mainRef.current || !reflectionRef.current) return;

    beatFlashRef.current = calculateBeatFlash(
      data.beat.isBeat,
      data.beat.intensity,
      beatFlashRef.current,
    );

    const { matrices, colors } = computeInstanceTransforms(
      data.smoothedFrequencies,
      barPositions,
      scaledMaxHeight,
      positionY,
      beatFlashRef.current,
      baseColor,
    );

    const matrix = reusableMatrix.current;
    const reflectionMatrix = reusableReflection.current;
    const pos = reusablePos.current;
    const quat = reusableQuat.current;
    const scale = reusableScale.current;
    const reflectionPos = reusableReflectionPos.current;
    const reflectionScale = reusableReflectionScale.current;

    for (let i = 0; i < barCount; i++) {
      matrix.fromArray(matrices.subarray(i * 16, (i + 1) * 16));
      mainRef.current.setMatrixAt(i, matrix);

      if (colorArrayRef.current) {
        colorArrayRef.current[i * 3] = colors[i * 3];
        colorArrayRef.current[i * 3 + 1] = colors[i * 3 + 1];
        colorArrayRef.current[i * 3 + 2] = colors[i * 3 + 2];
      }

      matrix.decompose(pos, quat, scale);
      reflectionPos.set(pos.x, positionY - (pos.y - positionY), pos.z);
      reflectionScale.set(scale.x, -scale.y, scale.z);
      reflectionMatrix.compose(reflectionPos, quat, reflectionScale);
      reflectionRef.current.setMatrixAt(i, reflectionMatrix);

      const rArr = reflectionColorAttribute.array as Float32Array;
      rArr[i * 3] = colors[i * 3];
      rArr[i * 3 + 1] = colors[i * 3 + 1];
      rArr[i * 3 + 2] = colors[i * 3 + 2];
    }

    mainRef.current.instanceMatrix.needsUpdate = true;
    colorAttribute.needsUpdate = true;
    mainUniforms.uBeatFlash.value = beatFlashRef.current;

    reflectionRef.current.instanceMatrix.needsUpdate = true;
    reflectionColorAttribute.needsUpdate = true;
    reflectionUniforms.uBeatFlash.value = beatFlashRef.current;
  };

  updateInstances();

  const geometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 0.3);
    geo.setAttribute("aInstanceColor", colorAttribute);
    return geo;
  }, [colorAttribute]);

  const reflectionGeometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 0.3);
    geo.setAttribute("aInstanceColor", reflectionColorAttribute);
    return geo;
  }, [reflectionColorAttribute]);

  return (
    <group>
      <instancedMesh
        ref={mainRef}
        args={[geometry, undefined, barCount]}
        frustumCulled={false}
      >
        <rawShaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={mainUniforms}
          transparent
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={reflectionRef}
        args={[reflectionGeometry, undefined, barCount]}
        frustumCulled={false}
      >
        <rawShaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={reflectionUniforms}
          transparent
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
};
