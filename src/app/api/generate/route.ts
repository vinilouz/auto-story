import { NextRequest, NextResponse } from "next/server"
import { splitText } from "@/lib/text-segmentation"
import { generateSceneDescriptions } from "@/lib/ai/processors/scene-visualizer"
import { generateSingleImage } from "@/lib/ai/processors/image-generator"
import { pipe } from "@/lib/pipeline"

interface GenerateRequest {
  text: string
  segmentLength: number
}

interface GenerateResponse {
  segments: string[]
  visualDescriptions?: Array<{ imagePrompt: string; imageUrl?: string; status: 'pending' | 'generating' | 'completed' | 'error' }>
}

interface ProcessedSegments {
  segments: string[]
}

interface ProcessedVisuals extends ProcessedSegments {
  visualDescriptions?: Array<{ imagePrompt: string }>
}

const validateRequest = (data: GenerateRequest): GenerateRequest => {
  if (!data.text || !data.segmentLength) {
    throw new Error('Missing required fields: text, segmentLength')
  }
  if (typeof data.segmentLength !== 'number' || data.segmentLength <= 0) {
    throw new Error('segmentLength must be a positive number')
  }
  return data
}

const generateSegments = (data: GenerateRequest): ProcessedSegments => {
  const segments = splitText(data.text, data.segmentLength)
  return { segments }
}

const processVisualDescriptions = async (data: ProcessedSegments): Promise<ProcessedVisuals> => {
  const visualResult = await generateSceneDescriptions({ segments: data.segments }) as any
  return {
    ...data,
    visualDescriptions: visualResult.visualDescriptions
  }
}

const processImageGeneration = async (data: ProcessedVisuals): Promise<ProcessedVisuals> => {
  if (!data.visualDescriptions) {
    return data
  }

  console.log('Starting image generation for', data.visualDescriptions.length, 'descriptions')

  const updatedDescriptions = await Promise.all(data.visualDescriptions.map(async (desc: any) => {
    try {
      const imageUrl = await generateSingleImage({ imagePrompt: desc.imagePrompt })
      return { ...desc, imageUrl, status: 'completed' }
    } catch (e) {
      console.error("Image gen error:", e)
      return { ...desc, status: 'error' }
    }
  }))

  return {
    ...data,
    visualDescriptions: updatedDescriptions
  }
}

const formatResponse = (data: ProcessedVisuals): GenerateResponse => {
  const response: GenerateResponse = { segments: data.segments }
  if (data.visualDescriptions) {
    response.visualDescriptions = data.visualDescriptions.map((desc: any) => ({
      ...desc,
      status: desc.status || 'pending'
    }))
  }
  return response
}

const processGenerate = pipe(
  validateRequest,
  generateSegments,
  processVisualDescriptions,
  processImageGeneration,
  formatResponse
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Request body:', body)

    const result = await processGenerate(body)
    console.log('Pipeline result:', result)

    return NextResponse.json(result)
  } catch (error) {
    console.error('API Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    })

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}