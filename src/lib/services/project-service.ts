import type { ProjectData } from "@/lib/storage";
import { generateProjectId } from "@/lib/utils";

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
  transcriptionResult?: ProjectData["transcriptionResult"];
  videoModel?: string;
}

function extractSlugFromId(id: string): string {
  const parts = id.split("-");
  return parts.length > 1 ? parts.slice(0, -1).join("-") : id;
}

export function createProject(input: CreateProjectInput): ProjectData {
  const { id, slug } = input.id
    ? { id: input.id, slug: extractSlugFromId(input.id) }
    : generateProjectId(input.name);

  return {
    id,
    name: input.name || slug,
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
    transcriptionResult: input.transcriptionResult,
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
