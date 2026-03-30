import { MUSIC_PROMPT_GENERATOR } from "@/lib/ai/prompts/prompts";
import { execute } from "@/lib/ai/providers";
import { createLogger } from "@/lib/logger";

const log = createLogger("music-prompt-gen");

export interface MusicPromptRequest {
  segments: Array<{ text: string }>;
  language?: string;
}

export async function generateMusicPrompt(data: MusicPromptRequest) {
  if (!data.segments?.length) throw new Error("No segments");

  const language = data.language || "English";

  const input = data.segments.map((s, i) => ({
    id: String(i + 1),
    scriptText: s.text.trim(),
  }));

  log.info(`Generating music prompt from ${input.length} segments`);

  const prompt = MUSIC_PROMPT_GENERATOR(input, language);

  const { text: raw } = await execute("generateText", { prompt });

  const musicPrompt = raw.trim();

  if (!musicPrompt) throw new Error("Empty music prompt response");

  log.success(`Music prompt generated: ${musicPrompt.slice(0, 80)}...`);

  return { musicPrompt };
}
