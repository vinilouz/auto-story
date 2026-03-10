import fs from 'fs'
import path from 'path'
import { execute } from '@/lib/ai/providers'
import { getProjectDirName } from '@/lib/utils'
import { createLogger } from '@/lib/logger'

const log = createLogger('video-clip')

export interface VideoClipRequest {
  prompt: string
  referenceImage?: string
  duration?: number
}

export async function generateVideoClip(req: VideoClipRequest): Promise<string> {
  const { videoUrl } = await execute('generateVideo', {
    prompt: req.prompt,
    referenceImage: req.referenceImage,
    duration: req.duration,
  })
  return videoUrl
}

export async function generateAndSaveVideoClip(
  req: VideoClipRequest, projectId: string, projectName: string,
): Promise<string> {
  const videoUrl = await generateVideoClip(req)

  const dir = getProjectDirName(projectId, projectName)
  const pubDir = path.join(process.cwd(), 'public', 'projects', dir, 'clips')
  if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true })

  const filename = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp4`
  const filepath = path.join(pubDir, filename)

  if (videoUrl.startsWith('data:')) {
    const [, base64Data] = videoUrl.split(',')
    fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'))
  } else {
    const res = await fetch(videoUrl)
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`)
    fs.writeFileSync(filepath, Buffer.from(await res.arrayBuffer()))
  }

  const publicPath = `/projects/${dir}/clips/${filename}`
  log.success(`Saved clip: ${publicPath}`)
  return publicPath
}