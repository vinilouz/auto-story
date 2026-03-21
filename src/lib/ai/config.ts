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

export const ACTIONS: Record<ActionType, ModelConfig[]> = {
  generateText: [{ provider: "louzlabs", model: "gpt-5.3-chat-latest" }],
  generateImage: [{ provider: "louzlabs" }],
  generateAudio: [{ provider: "louzlabs" }],
  generateVideo: [{ provider: "louzlabs", clipDuration: 6 }],
  generateMusic: [{ provider: "louzlabs" }],
  generateTranscription: [{ provider: "louzlabs" }],
};

export function getVideoClipDuration(): number {
  return ACTIONS.generateVideo[0]?.clipDuration ?? 6;
}
