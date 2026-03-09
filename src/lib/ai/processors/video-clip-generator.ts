import fs from 'fs'
import path from 'path'
import { execute } from '@/lib/ai/providers'

export interface VideoClipRequest {
  prompt: string
  referenceImage?: string
  duration?: number
  index?: number
}

export async function generateVideoClip(req: VideoClipRequest): Promise<string> {
  const { videoUrl } = await execute('generateVideo', {
    prompt: req.prompt,
    referenceImage: req.referenceImage,
    duration: req.duration,
  })
  return videoUrl
}

function projectDir(projectId: string, projectName: string): string {
  const slug = projectName.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-')
    .substring(0, 10) || 'untitled'
  return `${slug}-${projectId.split('-')[0] || projectId.substring(0, 8)}`
}

export async function generateAndSaveVideoClip(
  req: VideoClipRequest,
  projectId: string,
  projectName: string,
): Promise<string> {
  const videoUrl = await generateVideoClip(req)

  const dir = projectDir(projectId, projectName)
  const pubDir = path.join(process.cwd(), 'public', 'projects', dir, 'clips')
  if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true })

  const filename = req.index !== undefined ? `clip_${req.index + 1}.mp4` : `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp4`
  const filepath = path.join(pubDir, filename)

  if (videoUrl.startsWith('data:')) {
    const [, base64Data] = videoUrl.split(',');
    fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
  } else {
    const res = await fetch(videoUrl);
    if (!res.ok) throw new Error(`Failed to download video clip: ${res.status}`);
    const buf = await res.arrayBuffer();
    fs.writeFileSync(filepath, Buffer.from(buf));
  }

  return `/projects/${dir}/clips/${filename}`
}