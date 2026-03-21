import type { ProjectData } from "@/lib/storage";

export interface CreateProjectInput {
  id?: string;
  name?: string;
  flowType?: ProjectData["flowType"];
  scriptText: string;
  segmentSize?: number;
  language?: string;
  style?: string;
  voice?: string;
  consistency?: boolean;
  musicEnabled?: boolean;
  music?: string;
  segments?: ProjectData["segments"];
  entities?: ProjectData["entities"];
  audioUrls?: string[];
  commentator?: ProjectData["commentator"];
  audioSystemPrompt?: string;
  audioBatches?: ProjectData["audioBatches"];
  transcriptionResults?: ProjectData["transcriptionResults"];
  videoModel?: string;
}

export function createProject(input: CreateProjectInput): ProjectData {
  return {
    id: input.id || crypto.randomUUID(),
    name: input.name || `Project ${new Date().toLocaleString()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    flowType: input.flowType || "simple",
    scriptText: input.scriptText,
    segmentSize: input.segmentSize,
    language: input.language,
    style: input.style,
    voice: input.voice,
    consistency: input.consistency,
    musicEnabled: input.musicEnabled,
    music: input.music,
    segments: input.segments || [],
    entities: input.entities,
    audioUrls: input.audioUrls,
    commentator: input.commentator,
    audioSystemPrompt: input.audioSystemPrompt,
    audioBatches: input.audioBatches,
    transcriptionResults: input.transcriptionResults,
    videoModel: input.videoModel,
  };
}

export function updateProject(
  existing: ProjectData,
  updates: Partial<ProjectData>,
): ProjectData {
  return {
    ...existing,
    ...updates,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
}
