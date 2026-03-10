import { NextRequest, NextResponse } from "next/server"
import { splitText } from "@/lib/text-segmentation"
import { createLogger } from "@/lib/logger"

const log = createLogger('api/split')

export async function POST(request: NextRequest) {
  try {
    const { text, segmentLength } = await request.json()

    if (!text || !segmentLength) {
      return NextResponse.json({ error: "Missing text or segmentLength" }, { status: 400 })
    }

    const segments = splitText(text, segmentLength)
    log.success(`Split ${text.length} chars → ${segments.length} segments (max ${segmentLength})`)

    return NextResponse.json({ segments })
  } catch (e: any) {
    log.error('Split failed', e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}