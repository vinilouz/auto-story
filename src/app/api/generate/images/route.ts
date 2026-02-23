import { NextRequest, NextResponse } from "next/server"
import { generateSingleImage } from "@/lib/ai/processors/image-generator"
import { StorageService } from "@/lib/storage"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.imagePrompt) {
      return NextResponse.json(
        { error: "Missing required field: imagePrompt" },
        { status: 400 }
      )
    }

    let imageUrl = await generateSingleImage({
      imagePrompt: body.imagePrompt,
      referenceImage: body.referenceImage,
      referenceImages: body.referenceImages,
      imageConfig: body.imageConfig,
      systemPrompt: body.systemPrompt
    })

    if (body.projectId && body.projectName && imageUrl.startsWith('data:image/')) {
      const matches = imageUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/)
      if (matches && matches.length === 3) {
        const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1]
        const base64Data = matches[2]
        const fileName = `generated-${Date.now()}.${extension}`

        const localUrl = await StorageService.saveBase64Image(body.projectId, fileName, base64Data, body.projectName)
        if (localUrl) {
          imageUrl = localUrl
        }
      }
    }

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error("Images API Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
