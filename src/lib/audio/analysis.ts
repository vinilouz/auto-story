export interface FrequencyBands {
  subBass: number;
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  presence: number;
  brilliance: number;
}

export interface BeatResult {
  isBeat: boolean;
  intensity: number;
}

const DEFAULT_SAMPLE_RATE = 44100;

export function applyAWeighting(frequencyHz: number): number {
  if (frequencyHz <= 0) return 0;

  const f2 = frequencyHz * frequencyHz;
  const f4 = f2 * f2;
  const num = 12194 * 12194 * f4;
  const d1 = f2 + 20.6 * 20.6;
  const d2 = f2 + 107.7 * 107.7;
  const d3 = f2 + 737.9 * 737.9;
  const d4 = f2 + 12194 * 12194;
  const ra = num / (d1 * Math.sqrt(d2 * d3) * d4);
  const db = 20 * Math.log10(ra) + 2.0;
  return 10 ** (db / 20);
}

export function mapLogFrequencies(raw: number[], outputBars: number): number[] {
  if (raw.length === 0 || outputBars <= 0) return [];

  const nyquist = DEFAULT_SAMPLE_RATE / 2;
  const minFreq = 20;
  const maxFreq = Math.min(nyquist, 20000);
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);

  const result: number[] = [];
  for (let i = 0; i < outputBars; i++) {
    const logLow = logMin + (logMax - logMin) * (i / outputBars);
    const logHigh = logMin + (logMax - logMin) * ((i + 1) / outputBars);
    const freqLow = 10 ** logLow;
    const freqHigh = 10 ** logHigh;
    const binLow = Math.floor((freqLow / nyquist) * raw.length);
    const binHigh = Math.ceil((freqHigh / nyquist) * raw.length);
    const centerFreq = Math.sqrt(freqLow * freqHigh);
    const weight = applyAWeighting(centerFreq);

    let sum = 0;
    let count = 0;
    for (let b = binLow; b < binHigh && b < raw.length; b++) {
      if (b >= 0) {
        sum += raw[b];
        count++;
      }
    }
    result.push(count > 0 ? (sum / count) * weight : 0);
  }
  return result;
}

export function detectBeat(
  bassEnergy: number,
  threshold: number,
  cooldown: number,
): BeatResult {
  if (cooldown > 0) {
    return { isBeat: false, intensity: 0 };
  }
  if (bassEnergy > threshold) {
    const intensity = (bassEnergy - threshold) / threshold;
    return { isBeat: true, intensity };
  }
  return { isBeat: false, intensity: 0 };
}

export function smoothAttackRelease(
  current: number,
  previous: number,
  attackMs: number,
  releaseMs: number,
  deltaMs: number,
): number {
  if (deltaMs <= 0) return previous;
  const timeConstant = current > previous ? attackMs : releaseMs;
  const alpha = 1 - Math.exp(-deltaMs / timeConstant);
  return previous + alpha * (current - previous);
}

export function extractBands(frequencies: number[]): FrequencyBands {
  if (frequencies.length === 0) {
    return {
      subBass: 0,
      bass: 0,
      lowMid: 0,
      mid: 0,
      highMid: 0,
      presence: 0,
      brilliance: 0,
    };
  }

  const nyquist = DEFAULT_SAMPLE_RATE / 2;
  const binHz = nyquist / frequencies.length;

  const bands: FrequencyBands = {
    subBass: 0,
    bass: 0,
    lowMid: 0,
    mid: 0,
    highMid: 0,
    presence: 0,
    brilliance: 0,
  };

  const ranges: { key: keyof FrequencyBands; low: number; high: number }[] = [
    { key: "subBass", low: 20, high: 60 },
    { key: "bass", low: 60, high: 250 },
    { key: "lowMid", low: 250, high: 500 },
    { key: "mid", low: 500, high: 2000 },
    { key: "highMid", low: 2000, high: 4000 },
    { key: "presence", low: 4000, high: 6000 },
    { key: "brilliance", low: 6000, high: 20000 },
  ];

  for (const range of ranges) {
    const binStart = Math.floor(range.low / binHz);
    const binEnd = Math.min(Math.ceil(range.high / binHz), frequencies.length);
    let sum = 0;
    let count = 0;
    for (let b = Math.max(0, binStart); b < binEnd; b++) {
      sum += frequencies[b];
      count++;
    }
    bands[range.key] = count > 0 ? sum / count : 0;
  }

  return bands;
}
