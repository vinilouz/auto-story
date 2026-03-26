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
import { slugify } from "@/lib/utils";

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
  flowType: "simple" | "with-commentator" | "video-story" | "from-audio";
  scriptText: string;
  segmentSize?: number;
  language?: string;
  style?: string;
  voice?: string;
  consistency?: boolean;
  musicEnabled?: boolean;
  segments?: Segment[];
  entities?: EntityAsset[];
  audioUrls?: string[];
  commentator?: CommentatorConfig;
  audioSystemPrompt?: string;
  audioBatches?: AudioBatch[];
  transcriptionResult?: TranscriptionResult;
  videoModel?: string;
  music?: string;
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

function resolveDir(projectId: string): string {
  return projectId;
}

async function extractBase64(
  base64Url: string,
  imagesDir: string,
  dirName: string,
  fileName: string,
): Promise<string | null> {
  const m = base64Url.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
  if (!m) return null;
  if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true });

  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  const finalName = fileName.includes(".") ? fileName : `${fileName}.${ext}`;
  await fs.writeFile(
    path.join(imagesDir, finalName),
    Buffer.from(m[2], "base64"),
  );
  return `/projects/${dirName}/images/${finalName}`;
}

async function extractSegmentImage(
  base64Url: string,
  imagesDir: string,
  dirName: string,
  index: number,
): Promise<string | null> {
  return extractBase64(base64Url, imagesDir, dirName, `img-${index + 1}`);
}

async function extractEntityImage(
  base64Url: string,
  imagesDir: string,
  dirName: string,
  entityName: string,
): Promise<string | null> {
  const tag = slugify(entityName).substring(0, 15);
  return extractBase64(base64Url, imagesDir, dirName, `entity-${tag}`);
}

// ── Service ────────────────────────────────────────────────

export const StorageService = {
  async saveProject(project: ProjectData): Promise<string> {
    project.updatedAt = new Date().toISOString();

    const dirName = resolveDir(project.id);
    const projectDir = path.join(DATA_DIR, dirName);
    const imagesDir = path.join(projectDir, "images");

    if (!existsSync(projectDir)) mkdirSync(projectDir, { recursive: true });

    if (project.segments) {
      for (let i = 0; i < project.segments.length; i++) {
        const seg = project.segments[i];
        if (seg.imagePath?.startsWith("data:image/")) {
          const saved = await extractSegmentImage(
            seg.imagePath,
            imagesDir,
            dirName,
            i,
          );
          if (saved) seg.imagePath = saved;
        }
      }
    }

    if (project.entities) {
      for (const ent of project.entities) {
        if (ent.imageUrl?.startsWith("data:image/")) {
          const saved = await extractEntityImage(
            ent.imageUrl,
            imagesDir,
            dirName,
            ent.name,
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
    segmentIndex: number,
    videoClipUrl: string,
  ): Promise<void> {
    try {
      const dirName = resolveDir(projectId);
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
    segmentIndex: number,
    imagePath: string,
  ): Promise<void> {
    try {
      const dirName = resolveDir(projectId);
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

  /**
   * Patch cirúrgico: atualiza o imageUrl de uma entidade específica no config.json.
   * Chamado imediatamente após salvar a imagem no disco — garante que a entidade
   * nunca perde seu progresso mesmo que a conexão SSE caia no meio do batch.
   */
  async patchEntityImage(
    projectId: string,
    entityName: string,
    imagePath: string,
  ): Promise<void> {
    try {
      const dirName = resolveDir(projectId);
      const configPath = path.join(DATA_DIR, dirName, "config.json");
      if (!existsSync(configPath)) return;

      const project: ProjectData = JSON.parse(
        await fs.readFile(configPath, "utf-8"),
      );
      if (!project.entities) return;

      const idx = project.entities.findIndex((e) => e.name === entityName);
      if (idx === -1) return;

      project.entities[idx].imageUrl = imagePath;
      project.entities[idx].status = "completed";
      project.updatedAt = new Date().toISOString();

      await fs.writeFile(configPath, JSON.stringify(project, null, 2));
      log.success(
        `Patched config: entities["${entityName}"].imageUrl = ${imagePath}`,
      );
    } catch (e: any) {
      log.error(
        `patchEntityImage falhou para entidade "${entityName}"`,
        e.message,
      );
    }
  },

  async patchMusic(projectId: string, musicUrl: string): Promise<void> {
    try {
      const dirName = resolveDir(projectId);
      const configPath = path.join(DATA_DIR, dirName, "config.json");
      if (!existsSync(configPath)) return;

      const project: ProjectData = JSON.parse(
        await fs.readFile(configPath, "utf-8"),
      );

      project.music = musicUrl;
      project.musicEnabled = true;
      project.updatedAt = new Date().toISOString();

      await fs.writeFile(configPath, JSON.stringify(project, null, 2));
      log.success(`Patched config: music = ${musicUrl}`);
    } catch (e: any) {
      log.error("patchMusic falhou", e.message);
    }
  },

  async saveBase64Image(
    projectId: string,
    fileName: string,
    base64Data: string,
  ): Promise<string | null> {
    try {
      const dirName = resolveDir(projectId);
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
      const configPath = path.join(DATA_DIR, id, "config.json");
      if (!existsSync(configPath)) return null;

      const project: ProjectData = JSON.parse(
        await fs.readFile(configPath, "utf-8"),
      );
      if (project.transcriptionResult) {
        if (typeof project.transcriptionResult.data === "string") {
          try {
            project.transcriptionResult.data = JSON.parse(
              project.transcriptionResult.data,
            );
          } catch {}
        }
      }
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
    const projectDir = path.join(DATA_DIR, id);
    if (!existsSync(projectDir)) return false;
    await fs.rm(projectDir, { recursive: true, force: true });
    log.success(`Deleted project: ${id}`);
    return true;
  },
};
