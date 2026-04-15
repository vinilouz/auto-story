import {
  type AudioAnalysisData,
  type AudioParticlesConfig,
  type AudioVizConfig,
  type AudioVizEffectType,
  DEFAULT_AUDIO_VIZ_CONFIG,
  type PostProcessingConfig,
  type ProSpectrumConfig,
  type SceneModulationConfig,
  type SmoothWaveformConfig,
} from "./types";

describe("DEFAULT_AUDIO_VIZ_CONFIG", () => {
  it("has enabled flag", () => {
    expect(DEFAULT_AUDIO_VIZ_CONFIG.enabled).toBe(true);
  });

  it("has valid effects array with only known effect types", () => {
    const validEffects: AudioVizEffectType[] = [
      "pro-spectrum",
      "audio-particles",
      "smooth-waveform",
      "post-processing",
      "scene-modulation",
    ];
    for (const effect of DEFAULT_AUDIO_VIZ_CONFIG.effects) {
      expect(validEffects).toContain(effect);
    }
  });

  it("has opacity between 0 and 1", () => {
    expect(DEFAULT_AUDIO_VIZ_CONFIG.opacity).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_AUDIO_VIZ_CONFIG.opacity).toBeLessThanOrEqual(1);
  });

  it("has valid hex color", () => {
    expect(DEFAULT_AUDIO_VIZ_CONFIG.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("has proSpectrum config with all required fields", () => {
    const cfg: ProSpectrumConfig = DEFAULT_AUDIO_VIZ_CONFIG.proSpectrum;
    expect(typeof cfg.barCount).toBe("number");
    expect(typeof cfg.cornerRadius).toBe("number");
    expect(typeof cfg.gap).toBe("number");
    expect(typeof cfg.maxHeight).toBe("number");
    expect(typeof cfg.reflectionOpacity).toBe("number");
    expect(typeof cfg.glowIntensity).toBe("number");
    expect(["bottom", "top", "center"]).toContain(cfg.position);
  });

  it("proSpectrum has sensible numeric ranges", () => {
    const cfg = DEFAULT_AUDIO_VIZ_CONFIG.proSpectrum;
    expect(cfg.barCount).toBeGreaterThan(0);
    expect(cfg.cornerRadius).toBeGreaterThanOrEqual(0);
    expect(cfg.gap).toBeGreaterThanOrEqual(0);
    expect(cfg.maxHeight).toBeGreaterThan(0);
    expect(cfg.reflectionOpacity).toBeGreaterThanOrEqual(0);
    expect(cfg.reflectionOpacity).toBeLessThanOrEqual(1);
    expect(cfg.glowIntensity).toBeGreaterThanOrEqual(0);
    expect(cfg.glowIntensity).toBeLessThanOrEqual(1);
  });

  it("has audioParticles config with all required fields", () => {
    const cfg: AudioParticlesConfig = DEFAULT_AUDIO_VIZ_CONFIG.audioParticles;
    expect(typeof cfg.count).toBe("number");
    expect(typeof cfg.noiseScale).toBe("number");
    expect(typeof cfg.trailLength).toBe("number");
    expect(typeof cfg.turbulence).toBe("number");
    expect(typeof cfg.baseSize).toBe("number");
    expect(typeof cfg.maxSize).toBe("number");
  });

  it("audioParticles has sensible numeric ranges", () => {
    const cfg = DEFAULT_AUDIO_VIZ_CONFIG.audioParticles;
    expect(cfg.count).toBeGreaterThan(0);
    expect(cfg.noiseScale).toBeGreaterThan(0);
    expect(cfg.trailLength).toBeGreaterThanOrEqual(0);
    expect(cfg.trailLength).toBeLessThanOrEqual(1);
    expect(cfg.turbulence).toBeGreaterThan(0);
    expect(cfg.baseSize).toBeGreaterThan(0);
    expect(cfg.maxSize).toBeGreaterThan(cfg.baseSize);
  });

  it("has smoothWaveform config with all required fields", () => {
    const cfg: SmoothWaveformConfig = DEFAULT_AUDIO_VIZ_CONFIG.smoothWaveform;
    expect(["center", "bottom", "top"]).toContain(cfg.position);
    expect(typeof cfg.splineTension).toBe("number");
    expect(typeof cfg.glowIntensity).toBe("number");
    expect(typeof cfg.thicknessScale).toBe("number");
    expect(["frequency", "amplitude", "fixed"]).toContain(cfg.colorMapping);
  });

  it("smoothWaveform has sensible numeric ranges", () => {
    const cfg = DEFAULT_AUDIO_VIZ_CONFIG.smoothWaveform;
    expect(cfg.splineTension).toBeGreaterThanOrEqual(0);
    expect(cfg.splineTension).toBeLessThanOrEqual(1);
    expect(cfg.glowIntensity).toBeGreaterThanOrEqual(0);
    expect(cfg.glowIntensity).toBeLessThanOrEqual(1);
    expect(cfg.thicknessScale).toBeGreaterThan(0);
  });

  it("has postProcessing config with all required fields", () => {
    const cfg: PostProcessingConfig = DEFAULT_AUDIO_VIZ_CONFIG.postProcessing;
    expect(typeof cfg.bloomIntensity).toBe("number");
    expect(typeof cfg.bloomThreshold).toBe("number");
    expect(typeof cfg.chromaticOffset).toBe("number");
    expect(typeof cfg.vignetteDarkness).toBe("number");
  });

  it("postProcessing has sensible numeric ranges", () => {
    const cfg = DEFAULT_AUDIO_VIZ_CONFIG.postProcessing;
    expect(cfg.bloomIntensity).toBeGreaterThanOrEqual(0);
    expect(cfg.bloomIntensity).toBeLessThanOrEqual(1);
    expect(cfg.bloomThreshold).toBeGreaterThanOrEqual(0);
    expect(cfg.bloomThreshold).toBeLessThanOrEqual(1);
    expect(cfg.chromaticOffset).toBeGreaterThanOrEqual(0);
    expect(cfg.chromaticOffset).toBeLessThanOrEqual(0.1);
    expect(cfg.vignetteDarkness).toBeGreaterThanOrEqual(0);
    expect(cfg.vignetteDarkness).toBeLessThanOrEqual(1);
  });

  it("has sceneModulation config with all required fields", () => {
    const cfg: SceneModulationConfig = DEFAULT_AUDIO_VIZ_CONFIG.sceneModulation;
    expect(typeof cfg.zoomIntensity).toBe("number");
    expect(typeof cfg.panIntensity).toBe("number");
    expect(cfg.zoomIntensity).toBeGreaterThan(0);
    expect(cfg.panIntensity).toBeGreaterThan(0);
  });
});

describe("AudioAnalysisData interface", () => {
  it("accepts valid data matching the interface shape", () => {
    const data: AudioAnalysisData = {
      bands: {
        subBass: 0.5,
        bass: 0.6,
        lowMid: 0.4,
        mid: 0.3,
        highMid: 0.2,
        presence: 0.15,
        brilliance: 0.1,
      },
      beat: { isBeat: true, intensity: 0.8 },
      smoothedFrequencies: new Array(64).fill(0.3),
      rmsEnergy: 0.45,
    };
    expect(data.bands.subBass).toBe(0.5);
    expect(data.beat.isBeat).toBe(true);
    expect(data.smoothedFrequencies).toHaveLength(64);
    expect(data.rmsEnergy).toBe(0.45);
  });
});

describe("AudioVizConfig type compatibility", () => {
  it("DEFAULT_AUDIO_VIZ_CONFIG satisfies AudioVizConfig interface", () => {
    const config: AudioVizConfig = DEFAULT_AUDIO_VIZ_CONFIG;
    expect(config.enabled).toBeDefined();
    expect(config.effects).toBeDefined();
    expect(config.opacity).toBeDefined();
    expect(config.color).toBeDefined();
    expect(config.proSpectrum).toBeDefined();
    expect(config.audioParticles).toBeDefined();
    expect(config.smoothWaveform).toBeDefined();
    expect(config.postProcessing).toBeDefined();
    expect(config.sceneModulation).toBeDefined();
  });
});
