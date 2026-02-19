import fs from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data', 'projects');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

export interface CommentatorConfig {
  id: string;
  name: string;
  personality: string;
  appearance: {
    type: 'upload' | 'generated';
    imageUrl?: string;
    imagePrompt?: string;
  };
}

export interface ProjectData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  flowType: 'simple' | 'with-commentator';
  scriptText: string;
  segmentSize?: number;
  language?: string;
  style?: string;
  // Simple flow fields
  segments?: string[];
  visualDescriptions?: Array<{ imagePrompt: string; imageUrl?: string; status: string }>;
  audioUrls?: string[];
  // Commentator flow fields
  commentator?: CommentatorConfig;
  segmentsWithComments?: Array<{ type: 'scene_text' | 'comment'; content: string }>;
  audioSystemPrompt?: string;
  audioBatches?: Array<{
    index: number;
    text: string;
    status: 'pending' | 'generating' | 'completed' | 'error';
    url?: string;
    error?: string;
  }>;
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  flowType?: 'simple' | 'with-commentator';
  commentator?: CommentatorConfig;
}

export const StorageService = {
  async saveProject(project: ProjectData): Promise<string> {
    const filePath = path.join(DATA_DIR, `${project.id}.json`);
    project.updatedAt = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(project, null, 2));
    return project.id;
  },

  async getProject(id: string): Promise<ProjectData | null> {
    const filePath = path.join(DATA_DIR, `${id}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  },

  async getAllProjects(): Promise<ProjectSummary[]> {
    try {
      const files = await fs.readdir(DATA_DIR);
      const summaries: ProjectSummary[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(DATA_DIR, file);
          try {
            const data = await fs.readFile(filePath, 'utf-8');
            const project = JSON.parse(data);
            summaries.push({
              id: project.id,
              name: project.name,
              createdAt: project.createdAt,
              updatedAt: project.updatedAt,
              flowType: project.flowType,
              commentator: project.commentator,
            });
          } catch (e) {
            console.error(`Failed to read project file ${file}:`, e);
          }
        }
      }

      return summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (error) {
      return [];
    }
  },

  async deleteProject(id: string): Promise<void> {
    const filePath = path.join(DATA_DIR, `${id}.json`);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }
};
