import { generateImage } from "@/lib/ai/providers/custom-client"
import { S3Client } from "@/lib/networking/s3-client"
import fs from 'fs/promises'
import path from 'path'

export interface GenerateImageRequest {
  imagePrompt: string
  referenceImage?: string
  referenceImages?: string[]
  imageConfig?: {
    aspect_ratio?: string
    image_size?: string
  }
  systemPrompt?: string
}

const resolveImageUrl = async (url?: string): Promise<string | undefined> => {
  if (!url) return undefined
  if (url.startsWith('/projects/')) {
    const publicDir = path.join(process.cwd(), 'public')
    const filePath = path.join(publicDir, url)
    const buffer = await fs.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase().replace('.', '')
    const mime = ext === 'jpg' ? 'jpeg' : ext
    const base64 = `data:image/${mime};base64,${buffer.toString('base64')}`
    return S3Client.uploadBase64(base64)
  }
  return url
}

export const generateSingleImage = async (request: GenerateImageRequest): Promise<string> => {
  const cleanedPrompt = request.imagePrompt.replace(/Scene \d{1,3}:\s*/gi, "").trim()

  const systemPrompt = request.systemPrompt || ""
  const finalPrompt = systemPrompt ? `${systemPrompt}\n${cleanedPrompt}` : cleanedPrompt

  const resolvedImageUrls = request.referenceImages && request.referenceImages.length > 0
    ? await Promise.all(request.referenceImages.map(resolveImageUrl)).then(urls => urls.filter((url): url is string => !!url))
    : request.referenceImage
      ? await resolveImageUrl(request.referenceImage).then(url => url ? [url] : undefined)
      : undefined

  return generateImage(
    finalPrompt,
    request.imageConfig,
    resolvedImageUrls
  )
}
