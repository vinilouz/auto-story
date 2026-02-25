import { NextRequest, NextResponse } from "next/server"
import { splitText } from "@/lib/text-segmentation"
import { generateSceneDescriptions } from "@/lib/ai/processors/scene-visualizer"
import { generateSingleImage } from "@/lib/ai/processors/image-generator"
import { pipe } from "@/lib/pipeline"
import { Segment } from "@/lib/flows/types"

interface GenerateRequest {
  text: string
  segmentLength: number
}

interface ProcessedSegments {
  segments: Segment[]
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
  const rawSegments = splitText(data.text, data.segmentLength)
  return { segments: rawSegments.map(text => ({ text })) }
}

const processVisualDescriptions = async (data: ProcessedSegments): Promise<ProcessedSegments> => {
  const visualResult = await generateSceneDescriptions({ segments: data.segments }) as { segments: Segment[] }
  return { segments: visualResult.segments }
}

const processImageGeneration = async (data: ProcessedSegments): Promise<ProcessedSegments> => {
  const updatedSegments = await Promise.all(data.segments.map(async (seg) => {
    if (!seg.imagePrompt) return seg
    try {
      const imageUrl = await generateSingleImage({ imagePrompt: seg.imagePrompt })
      return { ...seg, imagePath: imageUrl }
    } catch (e) {
      console.error("Image gen error:", e)
      return seg
    }
  }))

  return { segments: updatedSegments }
}

const processGenerate = pipe(
  validateRequest,
  generateSegments,
  processVisualDescriptions,
  processImageGeneration
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await processGenerate(body)
    return NextResponse.json(result)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}