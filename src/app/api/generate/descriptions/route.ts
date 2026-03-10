import { NextRequest, NextResponse } from "next/server"
import { generateSceneDescriptions } from "@/lib/ai/processors/scene-visualizer"
import { createLogger } from "@/lib/logger"

const log = createLogger('api/descriptions')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.segments?.length) {
      return NextResponse.json({ error: "Missing segments" }, { status: 400 })
    }

    log.info(`Description request: ${body.segments.length} segments`)
    const result = await generateSceneDescriptions(body)
    log.success(`Descriptions done: ${result.segments.length} segments`)

    return NextResponse.json(result)
  } catch (e: any) {
    log.error('Description generation failed', e)
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 })
  }
}