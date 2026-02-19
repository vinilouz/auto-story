import { NextRequest, NextResponse } from "next/server"
import { generateSingleImage } from "@/lib/ai/processors/image-generator"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.imagePrompt) {
      return NextResponse.json(
        { error: "Missing required field: imagePrompt" },
        { status: 400 }
      )
    }

    const imageUrl = await generateSingleImage({
      imagePrompt: body.imagePrompt,
      referenceImage: body.referenceImage,
      imageConfig: body.imageConfig,
      systemPrompt: body.systemPrompt
    })

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error("Images API Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
