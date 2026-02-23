import { NextRequest, NextResponse } from "next/server"
import { generateSceneDescriptions } from "@/lib/ai/processors/scene-visualizer"

interface DescriptionsRequest {
  segments: string[]
  context?: 'story' | 'commentator'
  commentatorImage?: string
  commentatorName?: string
  commentatorPersonality?: string
  language?: string
  style?: string
  consistency?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body: DescriptionsRequest = await request.json()

    if (!body.segments || !Array.isArray(body.segments) || body.segments.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: segments (array)" },
        { status: 400 }
      )
    }

    const result = await generateSceneDescriptions({
      segments: body.segments,
      context: body.context || 'story',
      commentatorImage: body.commentatorImage,
      commentatorName: body.commentatorName,
      commentatorPersonality: body.commentatorPersonality,
      language: body.language,
      style: body.style,
      consistency: body.consistency
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Descriptions API Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
