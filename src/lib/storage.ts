import fs from 'fs/promises'
import path from 'path'
import { existsSync, mkdirSync, readdirSync } from 'fs'
import { slugify, getProjectDirName } from '@/lib/utils'
import { createLogger } from '@/lib/logger'
import type {
  Segment, EntityAsset, CommentatorConfig,
  AudioBatch, TranscriptionResult,
} from '@/lib/flows/types'

const log = createLogger('storage')

const PUBLIC_DIR = path.join(process.cwd(), 'public')
const DATA_DIR = path.join(PUBLIC_DIR, 'projects')

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

// ── Types ──────────────────────────────────────────────────

export interface ProjectData {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  flowType: 'simple' | 'with-commentator' | 'video-story'
  scriptText: string
  segmentSize?: number
  language?: string
  style?: string
  voice?: string
  consistency?: boolean
  segments?: Segment[]
  entities?: EntityAsset[]
  audioUrls?: string[]
  commentator?: CommentatorConfig
  audioSystemPrompt?: string
  audioBatches?: AudioBatch[]
  transcriptionResults?: TranscriptionResult[]
  videoModel?: string
}

export interface ProjectSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  flowType?: ProjectData['flowType']
  commentator?: CommentatorConfig
  dirName: string
}

// ── Helpers ────────────────────────────────────────────────

/**
 * Find existing project directory by short ID suffix.
 */
function findExistingDir(projectId: string): string | null {
  if (!existsSync(DATA_DIR)) return null
  const shortId = projectId.split('-')[0] || projectId.substring(0, 8)
  const dirs = readdirSync(DATA_DIR, { withFileTypes: true })

  for (const d of dirs) {
    if (d.isDirectory() && d.name.endsWith(`-${shortId}`)) return d.name
  }
  // Fallback: contains shortId (backwards compat with existing projects)
  for (const d of dirs) {
    if (d.isDirectory() && d.name.includes(shortId)) return d.name
  }
  return null
}

function resolveDir(projectId: string, projectName: string): string {
  return findExistingDir(projectId) || getProjectDirName(projectId, projectName)
}

async function extractBase64(
  base64Url: string, imagesDir: string, dirName: string, prefix: string, index: number,
): Promise<string | null> {
  const m = base64Url.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/)
  if (!m) return null
  if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true })

  const ext = m[1] === 'jpeg' ? 'jpg' : m[1]
  const fileName = `${prefix}-${index}-${Date.now()}.${ext}`
  await fs.writeFile(path.join(imagesDir, fileName), Buffer.from(m[2], 'base64'))
  return `/projects/${dirName}/images/${fileName}`
}

// ── Service ────────────────────────────────────────────────

export const StorageService = {
  async saveProject(project: ProjectData): Promise<string> {
    project.updatedAt = new Date().toISOString()

    const dirName = resolveDir(project.id, project.name)
    const projectDir = path.join(DATA_DIR, dirName)
    const imagesDir = path.join(projectDir, 'images')

    if (!existsSync(projectDir)) mkdirSync(projectDir, { recursive: true })

    // Extract base64 from segments
    if (project.segments) {
      for (let i = 0; i < project.segments.length; i++) {
        const seg = project.segments[i]
        if (seg.imagePath?.startsWith('data:image/')) {
          const saved = await extractBase64(seg.imagePath, imagesDir, dirName, 'scene', i)
          if (saved) seg.imagePath = saved
        }
      }
    }

    // Extract base64 from entities
    if (project.entities) {
      for (let i = 0; i < project.entities.length; i++) {
        const ent = project.entities[i]
        if (ent.imageUrl?.startsWith('data:image/')) {
          const tag = slugify(ent.name).substring(0, 15)
          const saved = await extractBase64(ent.imageUrl, imagesDir, dirName, `entity-${tag}`, i)
          if (saved) ent.imageUrl = saved
        }
      }
    }

    const configPath = path.join(projectDir, 'config.json')
    await fs.writeFile(configPath, JSON.stringify(project, null, 2))
    log.success(`Saved ${dirName}/config.json`)
    return project.id
  },

  async saveBase64Image(
    projectId: string, fileName: string, base64Data: string, projectName: string,
  ): Promise<string | null> {
    try {
      const dirName = resolveDir(projectId, projectName)
      const imagesDir = path.join(DATA_DIR, dirName, 'images')
      if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true })

      await fs.writeFile(path.join(imagesDir, fileName), Buffer.from(base64Data, 'base64'))
      return `/projects/${dirName}/images/${fileName}`
    } catch (e) {
      log.error('Failed to save base64 image', e)
      return null
    }
  },

  async getProject(id: string): Promise<ProjectData | null> {
    try {
      const dirName = findExistingDir(id)
      if (!dirName) return null

      const configPath = path.join(DATA_DIR, dirName, 'config.json')
      if (!existsSync(configPath)) return null

      const project: ProjectData = JSON.parse(await fs.readFile(configPath, 'utf-8'))
      project.transcriptionResults ??= []

      // Auto-discover transcription sidecar files
      for (const b of project.audioBatches || []) {
        if (b.status !== 'completed' || !b.url) continue
        if (project.transcriptionResults.some(r => r.url === b.url)) continue

        const jsonPath = path.join(PUBLIC_DIR, b.url.replace(/^\//, '')) + '.elevenlabs.json'
        const content = await fs.readFile(jsonPath, 'utf-8').catch(() => null)
        if (content) {
          project.transcriptionResults.push({
            url: b.url, status: 'completed',
            transcriptionUrl: `${b.url}.elevenlabs.json`,
            data: JSON.parse(content),
          })
        }
      }

      return project
    } catch (e) {
      log.error(`Error loading project ${id}`, e)
      return null
    }
  },

  async getAllProjects(): Promise<ProjectSummary[]> {
    if (!existsSync(DATA_DIR)) return []
    try {
      const dirents = await fs.readdir(DATA_DIR, { withFileTypes: true })
      const summaries: ProjectSummary[] = []

      for (const d of dirents) {
        if (!d.isDirectory()) continue
        try {
          const cfgPath = path.join(DATA_DIR, d.name, 'config.json')
          if (!existsSync(cfgPath)) continue
          const p = JSON.parse(await fs.readFile(cfgPath, 'utf-8'))
          summaries.push({
            id: p.id, name: p.name, createdAt: p.createdAt,
            updatedAt: p.updatedAt, flowType: p.flowType,
            commentator: p.commentator, dirName: d.name,
          })
        } catch { }
      }

      // Deduplicate by ID, keep latest
      const deduped = new Map<string, ProjectSummary>()
      for (const p of summaries) {
        const existing = deduped.get(p.id)
        if (!existing || new Date(p.updatedAt) > new Date(existing.updatedAt)) {
          deduped.set(p.id, p)
        }
      }

      return Array.from(deduped.values())
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    } catch (e) {
      log.error('Error reading projects', e)
      return []
    }
  },

  async deleteProject(id: string): Promise<void> {
    const dirName = findExistingDir(id)
    if (!dirName) return
    await fs.rm(path.join(DATA_DIR, dirName), { recursive: true, force: true })
    log.info(`Deleted project dir: ${dirName}`)
  },
}