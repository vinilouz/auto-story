import { generateImage } from "@/lib/ai/providers/custom-client"

export interface GenerateImageRequest {
  imagePrompt: string
  referenceImage?: string
  imageConfig?: {
    aspect_ratio?: string
    image_size?: string
  }
  systemPrompt?: string
}

import { DEFAULT_IMAGE_SYSTEM_PROMPT } from "@/lib/ai/prompts/image-prompts"

export const generateSingleImage = async (request: GenerateImageRequest): Promise<string> => {
  const cleanedPrompt = request.imagePrompt.replace(/Scene \d{1,3}:\s*/gi, "").trim()

  const systemPrompt = request.systemPrompt || DEFAULT_IMAGE_SYSTEM_PROMPT
  const finalPrompt = `${systemPrompt}
${cleanedPrompt}`

  return generateImage(
    finalPrompt,
    request.imageConfig,
    request.referenceImage
  )
}