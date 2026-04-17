import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import type React from "react";
import type { AudioAnalysisData, AudioVizConfig } from "@/lib/video/types";

interface PostProcessingStackProps {
  data: AudioAnalysisData;
  config: AudioVizConfig;
}

export const PostProcessingStack: React.FC<PostProcessingStackProps> = ({
  data,
  config,
}) => {
  const cfg = config.postProcessing;
  const bassEnergy = Math.min(2, (data.bands.subBass + data.bands.bass) / 2);

  const bloomIntensity = Math.min(
    3,
    cfg.bloomIntensity + bassEnergy * cfg.bloomIntensity * 1.5,
  );

  const chromaticMult = data.beat.isBeat
    ? Math.min(4, 1 + data.beat.intensity * 3)
    : 0;

  const vignetteDarkness = Math.min(
    1.5,
    cfg.vignetteDarkness + bassEnergy * cfg.vignetteDarkness * 0.8,
  );

  return (
    <EffectComposer>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={cfg.bloomThreshold}
        luminanceSmoothing={0.025}
        kernelSize={KernelSize.LARGE}
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={[
          cfg.chromaticOffset * chromaticMult,
          cfg.chromaticOffset * 0.5 * chromaticMult,
        ]}
      />
      <Vignette
        offset={0.5}
        darkness={vignetteDarkness}
        eskil={false}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
};
