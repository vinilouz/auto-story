import type { FrequencyBands } from "@/lib/audio/analysis";
import type { PostProcessingConfig } from "@/lib/video/types";

interface PostProcessingParams {
  bloomIntensity: number;
  bloomThreshold: number;
  chromaticOffsetX: number;
  chromaticOffsetY: number;
  vignetteDarkness: number;
}

export function computePostProcessingParams(
  bands: FrequencyBands,
  isBeat: boolean,
  beatIntensity: number,
  config: PostProcessingConfig,
): PostProcessingParams {
  const bassEnergy = (bands.subBass + bands.bass) / 2;

  const bloomIntensity =
    config.bloomIntensity + bassEnergy * config.bloomIntensity * 1.5;

  const chromaticMultiplier = isBeat ? 1 + beatIntensity * 3 : 0;
  const chromaticOffsetX = config.chromaticOffset * chromaticMultiplier;
  const chromaticOffsetY = config.chromaticOffset * 0.5 * chromaticMultiplier;

  const vignetteDarkness =
    config.vignetteDarkness + bassEnergy * config.vignetteDarkness * 0.8;

  return {
    bloomIntensity,
    bloomThreshold: config.bloomThreshold,
    chromaticOffsetX,
    chromaticOffsetY,
    vignetteDarkness,
  };
}
