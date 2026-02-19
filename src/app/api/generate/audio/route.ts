import { NextRequest, NextResponse } from "next/server"
import { generateAudio } from "@/lib/ai/processors/audio-generator"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, voice, model, systemPrompt, targetBatchIndices } = body

    if (!text) {
      return NextResponse.json(
        { error: "Missing required field: text" },
        { status: 400 }
      )
    }

    const result = await generateAudio({
      text,
      voice,
      model,
      systemPrompt,
      targetBatchIndices
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Audio API Error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
