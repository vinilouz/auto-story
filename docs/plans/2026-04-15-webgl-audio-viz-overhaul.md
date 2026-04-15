# WebGL Audio Visualizer Overhaul

## Overview

Replace all 4 current audio visualization effects (SpectrumBars, AudioParticles, WaveformRibbon, VignetteGlow) with professional-grade WebGL implementations. The current effects are basic div/SVG primitives with minimal audio intelligence — no beat detection, no perceptual weighting, no post-processing.

The new system will:
- Use a unified WebGL/Three.js rendering pipeline with shared post-processing (bloom, chromatic aberration)
- Implement real spectral analysis: A-weighted perceptual loudness, beat detection with attack/release envelopes, frequency-aware decay
- Deliver 4 effects: Pro Spectrum Bars, Audio-Reactive Particles, Smooth Waveform, and a Post-Processing Stack
- All effects share one Three.js `<Canvas>` with layered `<Layer>` components

## Context

**Files being replaced:**
- `src/components/video/audio-viz/SpectrumBars.tsx` — div-based bars, no spectral intelligence
- `src/components/video/audio-viz/AudioParticles.tsx` — 100 generic particles, not music-reactive
- `src/components/video/audio-viz/WaveformRibbon.tsx` — jagged SVG polyline
- `src/components/video/audio-viz/VignetteGlow.tsx` — trivial CSS gradient
- `src/components/video/audio-viz/AudioVizOverlay.tsx` — orchestrator, will be rewritten

**Files being modified:**
- `src/lib/video/types.ts` — `AudioVizConfig`, effect types, frequency data interfaces
- `src/components/video/RemotionVideo.tsx` — integration point (minimal changes expected)

**Dependencies already installed:**
- `three`, `@types/three`, `@remotion/three`, `@react-three/fiber`, `@react-three/drei`
- `@remotion/media-utils` (provides `useWindowedAudioData`, `visualizeAudio`)

**New dependencies needed:**
- `postprocessing` — Three.js post-processing library (bloom, chromatic aberration, etc.)

**Related patterns:**
- Current `AudioVizOverlay` processes FFT data with `useWindowedAudioData` + `visualizeAudio`
- Logarithmic frequency mapping already exists but needs perceptual weighting
- Smoothing is primitive linear interpolation — needs exponential attack/release

## Development Approach

- **Testing approach**: TDD — write tests first, then implement
- Each task includes tests before moving on
- Small, focused changes per task
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**

## Testing Strategy

- **Unit tests**: Audio analysis functions (beat detection, perceptual weighting, frequency mapping) — pure functions, no mocks
- **Integration tests**: Effect rendering with sample frequency data — verify output doesn't crash, verify config application
- Post-processing and WebGL shaders are visual — tested via snapshot/snapshot-free approach (verify props passed correctly, verify no render errors)

## Progress Tracking

- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Audio analysis engine — beat detection and perceptual weighting

Build the core audio analysis module that all effects will consume. This replaces the primitive smoothing in `AudioVizOverlay` with professional-grade spectral analysis.

- [x] create `src/lib/audio/analysis.ts` with pure analysis functions:
  - `applyAWeighting(frequencyHz: number): number` — A-weighted perceptual loudness curve
  - `mapLogFrequencies(raw: number[], outputBars: number): number[]` — logarithmic mapping with perceptual weighting
  - `detectBeat(bassEnergy: number, threshold: number, cooldown: number): { isBeat: boolean; intensity: number }` — simple energy-based beat detection with cooldown
  - `smoothAttackRelease(current: number, previous: number, attackMs: number, releaseMs: number, deltaMs: number): number` — exponential smoothing with separate attack/release times
  - `extractBands(frequencies: number[]): { subBass: number; bass: number; lowMid: number; mid: number; highMid: number; presence: number; brilliance: number }` — 7-band extraction matching audio engineering standards (sub-bass 20-60Hz, bass 60-250Hz, low-mid 250-500Hz, mid 500-2kHz, high-mid 2-4kHz, presence 4-6kHz, brilliance 6-20kHz)
- [x] write unit tests for `applyAWeighting` — verify known frequency responses (1kHz = 0dB, 100Hz ≈ -20dB, 10kHz ≈ -2.5dB)
- [x] write unit tests for `mapLogFrequencies` — verify output length, verify logarithmic distribution, verify perceptual weighting applied
- [x] write unit tests for `detectBeat` — verify beat triggers on energy spike, verify cooldown prevents double-triggers, verify intensity calculation
- [x] write unit tests for `smoothAttackRelease` — verify fast attack, slow release, verify exponential curve shape
- [x] write unit tests for `extractBands` — verify 7 bands extracted, verify correct frequency ranges mapped
- [x] run tests — must pass before task 2

### Task 2: Update types for new audio analysis data structures

Update `src/lib/video/types.ts` to reflect the new analysis capabilities and effect types.

- [x] replace `AudioFrequencyData` with new `AudioAnalysisData` interface containing: 7-band extraction, beat detection state, smoothed frequency array, raw RMS energy
- [x] update `AudioVizEffectType` union: remove old effect names, add `"pro-spectrum"`, `"audio-particles"`, `"smooth-waveform"`, `"post-processing"`
- [x] update config interfaces: replace `SpectrumBarsConfig`, `VignetteGlowConfig`, `AudioParticlesConfig`, `WaveformConfig` with new pro configs (`ProSpectrumConfig`, `AudioParticlesConfig` rewritten, `SmoothWaveformConfig`, `PostProcessingConfig`)
- [x] update `AudioVizConfig` to use new configs, keep `enabled`, `opacity`, `color` for backward compat
- [x] update `DEFAULT_AUDIO_VIZ_CONFIG` with sensible professional defaults
- [x] write unit tests verifying `DEFAULT_AUDIO_VIZ_CONFIG` has all required fields with correct types
- [x] run tests — must pass before task 3

### Task 3: Rewrite AudioVizOverlay with new analysis pipeline

Replace the orchestrator to use the new analysis engine and render all effects inside a single Three.js canvas.

- [x] rewrite `src/components/video/audio-viz/AudioVizOverlay.tsx`:
  - Use `useWindowedAudioData` + `visualizeAudio` for raw FFT (keep existing Remotion integration)
  - Apply new `mapLogFrequencies` with perceptual weighting
  - Apply `smoothAttackRelease` per frequency bin with fast attack (10ms) / slow release (80ms)
  - Run `extractBands` and `detectBeat` each frame
  - Produce `AudioAnalysisData` object consumed by all effects
- [x] install `postprocessing` package for post-processing stack
- [x] set up single `<Canvas>` from `@react-three/fiber` with `<EffectComposer>` from `postprocessing`
- [x] render effect layers inside canvas based on `config.effects` array
- [x] write unit tests for the analysis pipeline (test that correct analysis data is produced from mock FFT input)
- [x] write integration test verifying AudioVizOverlay renders without errors given valid props
- [x] run tests — must pass before task 4

### Task 4: Pro Spectrum Bars effect

Professional frequency spectrum visualization with real spectral understanding.

- [x] create `src/components/video/audio-viz/ProSpectrum.tsx` — WebGL spectrum bars using Three.js instanced meshes:
  - Instanced `BoxGeometry` for bars — one instance per frequency bin (64 bars)
  - Per-instance attributes: height (from smoothed frequency data), color (gradient mapped to frequency band)
  - Mirror reflection below bars (inverted, faded copies)
  - Beat detection triggers subtle flash/pulse on bass bars
  - Configurable: bar count, corner radius (via shader), gap, max height, reflection opacity, glow intensity
- [x] write vertex/fragment shaders for the bars:
  - Rounded top corners via SDF in fragment shader
  - Vertical gradient fill (base color → lighter at top)
  - Glow effect via alpha falloff around bar edges
- [x] write unit tests for bar geometry calculations (height mapping, position calculations)
- [x] write unit tests verifying component renders with sample AudioAnalysisData
- [x] run tests — must pass before task 5

### Task 5: Audio-Reactive Particles effect

Musical particle system that responds to beats and frequency bands — not generic floating dots.

- [x] rewrite `src/components/video/audio-viz/AudioParticles.tsx` — music-reactive particle system:
  - 500-1000 particles with GPU-driven position/size/opacity via buffer attributes
  - Beat detection triggers burst emissions (kick → large burst, snare → medium scatter, hihat → fine sparkle)
  - Particles flow in 3D Perlin noise field (use simplex noise implementation) — organic, non-random motion
  - Bass modulates noise turbulence intensity (more bass → more chaotic flow)
  - Mid frequencies modulate particle size
  - Treble modulates particle brightness
  - Particle trails via alpha fade (configurable trail length)
  - Additive blending for glowing appearance
- [x] write custom shaders:
  - Vertex: noise-field displacement, size modulation from audio
  - Fragment: soft circle with configurable glow, color tint per frequency band
- [x] write unit tests for particle initialization (verify positions, velocities, age ranges)
- [x] write unit tests for noise-field calculations (deterministic given seed)
- [x] run tests — must pass before task 6

### Task 6: Smooth Waveform effect

Smooth, organic waveform visualization with proper curve interpolation.

- [x] create `src/components/video/audio-viz/SmoothWaveform.tsx` — Three.js line rendering with:
  - Catmull-Rom spline interpolation through frequency data points — smooth curves, not jagged lines
  - Line thickness modulated by frequency amplitude (louder = thicker)
  - Gradient color mapped to frequency position (bass = warm, treble = cool)
  - Glow trail behind the waveform (duplicate line with wider stroke + additive blending + low opacity)
  - Beat detection triggers pulse animation (waveform expands outward briefly)
  - Configurable: position, spline tension, glow intensity, thickness scale, color mapping mode
- [x] use `THREE.Line2` / `LineGeometry` from `three/examples/jsm` for variable-width lines
- [x] write unit tests for Catmull-Rom interpolation (verify smooth output at known points)
- [x] write unit tests for color gradient generation (verify correct color stops)
- [x] run tests — must pass before task 7

### Task 7: Post-Processing Stack

GPU-accelerated visual polish applied to all effects.

- [x] create `src/components/video/audio-viz/PostProcessingStack.tsx` — wraps effects with post-processing:
  - **Bloom**: Bass-reactive bloom intensity (more bass = more bloom). Threshold configurable.
  - **Chromatic Aberration**: Beat-triggered chromatic shift (subtle RGB split on kick drums)
  - **Vignette**: Replaces old VignetteGlow — bass-reactive edge darkening
  - All effects configurable: bloom intensity/threshold, chromatic offset, vignette darkness
- [x] integrate `postprocessing` library's `EffectComposer`, `BloomEffect`, `ChromaticAberrationEffect`, `VignetteEffect`
- [x] write unit tests verifying effect parameter calculations (bloom intensity from bass, chromatic offset from beat)
- [x] write integration test verifying post-processing stack renders without WebGL errors
- [x] run tests — must pass before task 8

### Task 8: Integration with RemotionVideo and cleanup

Wire everything together and remove old code.

- [x] update `src/components/video/RemotionVideo.tsx` to use new `AudioVizOverlay` (should be minimal if overlay interface is preserved)
- [x] remove old effect files: delete `SpectrumBars.tsx`, `VignetteGlow.tsx`, `WaveformRibbon.tsx` (keep only new files)
- [x] verify `Scene.tsx` still works with scene-modulation (it reads `audioAmplitude` — ensure that's still passed)
- [x] update any config defaults in `useStoryFlowState.ts` or wherever `AudioVizConfig` is initialized
- [x] run full test suite — all tests must pass
- [x] run `npm run lint` — all issues must be fixed
- [x] manual dev server test at `/test` page — verify effects render without console errors (skipped - requires manual visual verification)

### Task 9: Update documentation

- [x] update `CLAUDE.md` Architecture section to reflect new audio-viz structure
- [x] update `src/lib/video/types.ts` JSDoc comments for new interfaces

## Technical Details

### Audio Analysis Pipeline

```
Raw FFT (512 bins from Remotion)
  → mapLogFrequencies (log mapping + A-weighting)
  → smoothAttackRelease per bin (10ms attack / 80ms release)
  → extractBands (7-band: sub-bass through brilliance)
  → detectBeat (energy threshold + cooldown)
  → AudioAnalysisData consumed by all effects
```

### Frequency Bands (Audio Engineering Standard)

| Band | Range | Use |
|------|-------|-----|
| Sub-bass | 20-60 Hz | Kick drum thump, bass drops |
| Bass | 60-250 Hz | Bass guitar, kick body |
| Low-mid | 250-500 Hz | Warmth, vocals fundamental |
| Mid | 500-2000 Hz | Main vocal presence |
| High-mid | 2-4 kHz | Clarity, snare crack |
| Presence | 4-6 kHz | Sibilance, consonants |
| Brilliance | 6-20 kHz | Air, shimmer, cymbals |

### WebGL Rendering Architecture

```
<Canvas> (single context)
  ├── <ProSpectrum /> (instanced mesh bars)
  ├── <AudioParticles /> (point sprites with noise field)
  ├── <SmoothWaveform /> (Line2 variable-width)
  └── <EffectComposer> (post-processing)
       ├── BloomEffect (bass-reactive)
       ├── ChromaticAberrationEffect (beat-triggered)
       └── VignetteEffect (bass-reactive)
```

### A-Weighting Formula

The A-weighting curve approximates human hearing sensitivity:

```
RA(f) = 12194² × f⁴ / ((f² + 20.6²) × √((f² + 107.7²) × (f² + 737.9²)) × (f² + 12194²))
A(f) = 20 × log10(RA(f)) + 2.0  (dB)
```

Applied as linear gain: `gain = 10^(A(f)/20)`

### Beat Detection Algorithm

Energy-based with adaptive threshold:
1. Calculate bass band energy (sub-bass + bass)
2. Compare against running average of last ~43ms (1 frame at 24fps)
3. If energy > threshold × average → beat detected
4. Cooldown prevents re-triggering within 100ms window
5. Intensity = (energy - threshold × average) / (threshold × average)

### Perlin Noise Field

Simplex 3D noise for particle flow fields. Implementation from `three/examples/jsm/math/SimplexNoise` or a lightweight inline implementation. Particles sample noise at their position to get flow direction — creates organic, non-random motion that responds to audio energy.

## Post-Completion

**Manual verification:**
- Visual test at `/test` page — all 4 effects should render with sample audio
- Test with different music genres (electronic, acoustic, vocal) to verify spectral analysis responds correctly
- Performance check — effects should run at target fps (24/30) without frame drops in Remotion preview
- Test with no audio — effects should gracefully show idle state

**External verification:**
- Verify `postprocessing` npm package is compatible with installed Three.js version
- Verify `@react-three/fiber` and `@react-three/drei` versions support `<EffectComposer>` from `postprocessing`
