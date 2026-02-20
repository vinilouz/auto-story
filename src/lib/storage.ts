import fs from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

// Change storage location to public/ so images can be served natively
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'projects');

// Ensure base projects directory exists
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
  segments?: string[];
  visualDescriptions?: Array<{ imagePrompt: string; imageUrl?: string; status: string }>;
  audioUrls?: string[];
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
  dirName: string;
}

// Utility to create safe folder names
function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD') // split an accented letter in the base letter and the accent
    .replace(/[\u0300-\u036f]/g, '') // remove all previously split accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, '') // remove all chars not letters, numbers and spaces (to be replaced)
    .replace(/\s+/g, '-') // separator
    .substring(0, 40); // cap length to avoid path too long errors
}

function getProjectDirName(project: Pick<ProjectData, "id" | "name">): string {
  const shortId = project.id.split('-')[0] || project.id.substring(0, 8);
  const slug = slugify(project.name) || 'untitled';
  return `${slug}-${shortId}`;
}

export const StorageService = {
  async saveProject(project: ProjectData): Promise<string> {
    project.updatedAt = new Date().toISOString();

    const dirName = getProjectDirName(project);
    const projectDir = path.join(DATA_DIR, dirName);
    const imagesDir = path.join(projectDir, 'images');

    if (!existsSync(projectDir)) {
      mkdirSync(projectDir, { recursive: true });
    }

    // Extract base64 images to files
    if (project.visualDescriptions && project.visualDescriptions.length > 0) {
      if (!existsSync(imagesDir)) {
        mkdirSync(imagesDir, { recursive: true });
      }

      for (let i = 0; i < project.visualDescriptions.length; i++) {
        const desc = project.visualDescriptions[i];
        if (desc.imageUrl && desc.imageUrl.startsWith('data:image/')) {
          // It's a base64 string
          const matches = desc.imageUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
            const base64Data = matches[2];
            const fileName = `scene-${i}-${Date.now()}.${extension}`;
            const filePath = path.join(imagesDir, fileName);

            // Write payload to disk
            await fs.writeFile(filePath, Buffer.from(base64Data, 'base64'));

            // Update the JSON to point to the saved file via URL
            desc.imageUrl = `/projects/${dirName}/images/${fileName}`;
          }
        }
      }
    }

    const configPath = path.join(projectDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(project, null, 2));

    return project.id;
  },

  async getProjectByDirName(dirName: string): Promise<ProjectData | null> {
    const configPath = path.join(DATA_DIR, dirName, 'config.json');
    try {
      const data = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  },

  async getProject(id: string): Promise<ProjectData | null> {
    try {
      if (!existsSync(DATA_DIR)) return null;
      const dirs = await fs.readdir(DATA_DIR, { withFileTypes: true });
      for (const dirent of dirs) {
        if (dirent.isDirectory() && dirent.name.includes(id.split('-')[0] || id)) {
          return await this.getProjectByDirName(dirent.name);
        }
      }
    } catch (error) {
      console.error("Error finding block by ID:", error);
    }
    return null;
  },

  async getAllProjects(): Promise<ProjectSummary[]> {
    try {
      if (!existsSync(DATA_DIR)) return [];
      const dirents = await fs.readdir(DATA_DIR, { withFileTypes: true });
      const summaries: ProjectSummary[] = [];

      for (const dirent of dirents) {
        if (dirent.isDirectory()) {
          const configPath = path.join(DATA_DIR, dirent.name, 'config.json');
          try {
            if (existsSync(configPath)) {
              const data = await fs.readFile(configPath, 'utf-8');
              const project = JSON.parse(data);
              summaries.push({
                id: project.id,
                name: project.name,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt,
                flowType: project.flowType,
                commentator: project.commentator,
                dirName: dirent.name
              });
            }
          } catch (e) {
            console.error(`Failed to read project config ${dirent.name}:`, e);
          }
        }
      }

      return summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (error) {
      console.error("Error reading all projects:", error);
      return [];
    }
  },

  async deleteProject(id: string): Promise<void> {
    try {
      if (!existsSync(DATA_DIR)) return;
      const dirs = await fs.readdir(DATA_DIR, { withFileTypes: true });
      for (const dirent of dirs) {
        if (dirent.isDirectory() && dirent.name.includes(id.split('-')[0] || id)) {
          const dirPath = path.join(DATA_DIR, dirent.name);
          await fs.rm(dirPath, { recursive: true, force: true });
          return;
        }
      }
    } catch (error) {
      console.error(`Failed to delete project ${id}:`, error);
    }
  }
};
