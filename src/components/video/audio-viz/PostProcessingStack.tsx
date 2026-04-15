import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import type React from "react";
import { useMemo } from "react";
import type { AudioAnalysisData, AudioVizConfig } from "@/lib/video/types";
import { computePostProcessingParams } from "./post-processing-params";

interface PostProcessingStackProps {
  data: AudioAnalysisData;
  config: AudioVizConfig;
}

export const PostProcessingStack: React.FC<PostProcessingStackProps> = ({
  data,
  config,
}) => {
  const params = useMemo(
    () =>
      computePostProcessingParams(
        data.bands,
        data.beat.isBeat,
        data.beat.intensity,
        config.postProcessing,
      ),
    [data.bands, data.beat.isBeat, data.beat.intensity, config.postProcessing],
  );

  return (
    <EffectComposer>
      <Bloom
        intensity={params.bloomIntensity}
        luminanceThreshold={params.bloomThreshold}
        luminanceSmoothing={0.025}
        kernelSize={KernelSize.LARGE}
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={[params.chromaticOffsetX, params.chromaticOffsetY]}
      />
      <Vignette
        offset={0.5}
        darkness={params.vignetteDarkness}
        eskil={false}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
};
