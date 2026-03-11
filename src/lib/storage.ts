import { existsSync, mkdirSync, readdirSync } from "fs";
import fs from "fs/promises";
import path from "path";
import type {
  AudioBatch,
  CommentatorConfig,
  EntityAsset,
  Segment,
  TranscriptionResult,
} from "@/lib/flows/types";
import { createLogger } from "@/lib/logger";
import { getProjectDirName, slugify } from "@/lib/utils";

const log = createLogger("storage");

const PUBLIC_DIR = path.join(process.cwd(), "public");
const DATA_DIR = path.join(PUBLIC_DIR, "projects");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// ── Types ──────────────────────────────────────────────────

export interface ProjectData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  flowType: "simple" | "with-commentator" | "video-story";
  scriptText: string;
  segmentSize?: number;
  language?: string;
  style?: string;
  voice?: string;
  consistency?: boolean;
  segments?: Segment[];
  entities?: EntityAsset[];
  audioUrls?: string[];
  commentator?: CommentatorConfig;
  audioSystemPrompt?: string;
  audioBatches?: AudioBatch[];
  transcriptionResults?: TranscriptionResult[];
  videoModel?: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  flowType?: ProjectData["flowType"];
  commentator?: CommentatorConfig;
  dirName: string;
}

// ── Helpers ────────────────────────────────────────────────

function findExistingDir(projectId: string): string | null {
  if (!existsSync(DATA_DIR)) return null;
  const shortId = projectId.split("-")[0] || projectId.substring(0, 8);
  const dirs = readdirSync(DATA_DIR, { withFileTypes: true });
  for (const d of dirs) {
    if (d.isDirectory() && d.name.endsWith(`-${shortId}`)) return d.name;
  }
  for (const d of dirs) {
    if (d.isDirectory() && d.name.includes(shortId)) return d.name;
  }
  return null;
}

function resolveDir(projectId: string, projectName: string): string {
  return (
    findExistingDir(projectId) || getProjectDirName(projectId, projectName)
  );
}

async function extractBase64(
  base64Url: string,
  imagesDir: string,
  dirName: string,
  prefix: string,
  index: number,
): Promise<string | null> {
  const m = base64Url.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
  if (!m) return null;
  if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true });

  // img-1.jpg, img-2.jpg ... (1-indexed, sem timestamp para nome legível)
  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  const fileName = `${prefix}-${index + 1}.${ext}`;
  await fs.writeFile(
    path.join(imagesDir, fileName),
    Buffer.from(m[2], "base64"),
  );
  return `/projects/${dirName}/images/${fileName}`;
}

// ── Service ────────────────────────────────────────────────

export const StorageService = {
  async saveProject(project: ProjectData): Promise<string> {
    project.updatedAt = new Date().toISOString();

    const dirName = resolveDir(project.id, project.name);
    const projectDir = path.join(DATA_DIR, dirName);
    const imagesDir = path.join(projectDir, "images");

    if (!existsSync(projectDir)) mkdirSync(projectDir, { recursive: true });

    if (project.segments) {
      for (let i = 0; i < project.segments.length; i++) {
        const seg = project.segments[i];
        if (seg.imagePath?.startsWith("data:image/")) {
          // img-1.jpg, img-2.jpg ...
          const saved = await extractBase64(
            seg.imagePath,
            imagesDir,
            dirName,
            "img",
            i,
          );
          if (saved) seg.imagePath = saved;
        }
      }
    }

    if (project.entities) {
      for (let i = 0; i < project.entities.length; i++) {
        const ent = project.entities[i];
        if (ent.imageUrl?.startsWith("data:image/")) {
          const tag = slugify(ent.name).substring(0, 15);
          const saved = await extractBase64(
            ent.imageUrl,
            imagesDir,
            dirName,
            `entity-${tag}`,
            i,
          );
          if (saved) ent.imageUrl = saved;
        }
      }
    }

    const configPath = path.join(projectDir, "config.json");
    await fs.writeFile(configPath, JSON.stringify(project, null, 2));
    log.success(`Saved ${dirName}/config.json`);
    return project.id;
  },

  /**
   * Patch cirúrgico: atualiza apenas o videoClipUrl de um segmento específico no config.json.
   * Chamado imediatamente após salvar o arquivo do clip no disco — sem esperar o cliente.
   * Isso garante que o clip nunca seja perdido mesmo que a conexão SSE caia.
   */
  async patchSegmentClip(
    projectId: string,
    projectName: string,
    segmentIndex: number,
    videoClipUrl: string,
  ): Promise<void> {
    try {
      const dirName = resolveDir(projectId, projectName);
      const configPath = path.join(DATA_DIR, dirName, "config.json");
      if (!existsSync(configPath)) {
        log.warn(
          `patchSegmentClip: config.json não encontrado para ${dirName}`,
        );
        return;
      }

      const project: ProjectData = JSON.parse(
        await fs.readFile(configPath, "utf-8"),
      );
      if (!project.segments?.[segmentIndex]) {
        log.warn(`patchSegmentClip: segmento ${segmentIndex} não existe`);
        return;
      }

      project.segments[segmentIndex].videoClipUrl = videoClipUrl;
      project.updatedAt = new Date().toISOString();

      await fs.writeFile(configPath, JSON.stringify(project, null, 2));
      log.success(
        `Patched config: segment[${segmentIndex}].videoClipUrl = ${videoClipUrl}`,
      );
    } catch (e: any) {
      // Não lança — patch é best-effort, o clip já está no disco
      log.error(
        `patchSegmentClip falhou para segmento ${segmentIndex}`,
        e.message,
      );
    }
  },

  /**
   * Patch cirúrgico: atualiza apenas o imagePath de um segmento específico no config.json.
   * Chamado imediatamente após salvar a imagem no disco.
   */
  async patchSegmentImage(
    projectId: string,
    projectName: string,
    segmentIndex: number,
    imagePath: string,
  ): Promise<void> {
    try {
      const dirName = resolveDir(projectId, projectName);
      const configPath = path.join(DATA_DIR, dirName, "config.json");
      if (!existsSync(configPath)) return;

      const project: ProjectData = JSON.parse(
        await fs.readFile(configPath, "utf-8"),
      );
      if (!project.segments?.[segmentIndex]) return;

      project.segments[segmentIndex].imagePath = imagePath;
      project.updatedAt = new Date().toISOString();

      await fs.writeFile(configPath, JSON.stringify(project, null, 2));
      log.success(
        `Patched config: segment[${segmentIndex}].imagePath = ${imagePath}`,
      );
    } catch (e: any) {
      log.error(
        `patchSegmentImage falhou para segmento ${segmentIndex}`,
        e.message,
      );
    }
  },

  async saveBase64Image(
    projectId: string,
    fileName: string,
    base64Data: string,
    projectName: string,
  ): Promise<string | null> {
    try {
      const dirName = resolveDir(projectId, projectName);
      const imagesDir = path.join(DATA_DIR, dirName, "images");
      if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true });

      await fs.writeFile(
        path.join(imagesDir, fileName),
        Buffer.from(base64Data, "base64"),
      );
      return `/projects/${dirName}/images/${fileName}`;
    } catch (e) {
      log.error("Failed to save base64 image", e);
      return null;
    }
  },

  async getProject(id: string): Promise<ProjectData | null> {
    try {
      const dirName = findExistingDir(id);
      if (!dirName) return null;

      const configPath = path.join(DATA_DIR, dirName, "config.json");
      if (!existsSync(configPath)) return null;

      const project: ProjectData = JSON.parse(
        await fs.readFile(configPath, "utf-8"),
      );
      project.transcriptionResults?.forEach((r) => {
        if (typeof r.data === "string") {
          try {
            r.data = JSON.parse(r.data);
          } catch {}
        }
      });
      return project;
    } catch (e) {
      log.error("Failed to load project", e);
      return null;
    }
  },

  async getAllProjects(): Promise<ProjectSummary[]> {
    if (!existsSync(DATA_DIR)) return [];
    const dirs = readdirSync(DATA_DIR, { withFileTypes: true });
    const summaries: ProjectSummary[] = [];

    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const configPath = path.join(DATA_DIR, d.name, "config.json");
      if (!existsSync(configPath)) continue;
      try {
        const p: ProjectData = JSON.parse(
          await fs.readFile(configPath, "utf-8"),
        );
        summaries.push({
          id: p.id,
          name: p.name,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          flowType: p.flowType,
          commentator: p.commentator,
          dirName: d.name,
        });
      } catch {}
    }

    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async deleteProject(id: string): Promise<boolean> {
    const dirName = findExistingDir(id);
    if (!dirName) return false;
    await fs.rm(path.join(DATA_DIR, dirName), { recursive: true, force: true });
    log.success(`Deleted project: ${dirName}`);
    return true;
  },
};
