import { NextRequest, NextResponse } from "next/server"
import { generateAndSaveVideoClip } from "@/lib/ai/processors/video-clip-generator"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, referenceImage, duration, projectId, projectName } = body

    if (!prompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 })

    const videoUrl = await generateAndSaveVideoClip(
      { prompt, referenceImage, duration },
      projectId || 'temp',
      projectName || 'untitled',
    )

    return NextResponse.json({ videoUrl })
  } catch (e: any) {
    console.error("Video clip API Error:", e)
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 })
  }
}