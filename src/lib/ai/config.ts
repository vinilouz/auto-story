export type ActionType =
  | "generateText"
  | "generateImage"
  | "generateAudio"
  | "generateVideo"
  | "generateMusic"
  | "generateTranscription";

export interface ModelConfig {
  provider: string;
  model?: string;
  clipDuration?: number;
}

export const DEFAULT_CLIP_DURATION = 8;
export const DEFAULT_CONCURRENCY = 50;
export const DEFAULT_MAX_RETRIES = 4;

export const ACTIONS: Record<ActionType, ModelConfig[]> = {
  generateText: [
    { provider: "louzlabs", model: "deepseek-v4-flash" },
  ],
  generateImage: [{ provider: "louzlabs" }],
  generateAudio: [{ provider: "louzlabs" }],
  generateVideo: [
    {
      provider: "louzlabs",
      model: "veo-3.1-fast",
      clipDuration: DEFAULT_CLIP_DURATION,
    },
  ],
  generateMusic: [{ provider: "louzlabs" }],
  generateTranscription: [{ provider: "louzlabs" }],
};

export function getVideoClipDuration(): number {
  return ACTIONS.generateVideo[0]?.clipDuration ?? DEFAULT_CLIP_DURATION;
}
