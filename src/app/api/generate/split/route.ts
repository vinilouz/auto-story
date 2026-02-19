import { NextRequest, NextResponse } from "next/server"
import { splitText } from "@/lib/text-segmentation"

interface SplitRequest {
  text: string
  segmentLength: number
}

export async function POST(request: NextRequest) {
  try {
    const body: SplitRequest = await request.json()
    
    if (!body.text || !body.segmentLength) {
      return NextResponse.json(
        { error: "Missing required fields: text, segmentLength" },
        { status: 400 }
      )
    }

    const segments = splitText(body.text, body.segmentLength)
    
    return NextResponse.json({ segments })
  } catch (error) {
    console.error("Split API Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
