import { NextRequest, NextResponse } from "next/server"
import { generateSingleImage } from "@/lib/ai/processors/image-generator"
import { StorageService } from "@/lib/storage"
import { createLogger } from "@/lib/logger"

const log = createLogger('api/images')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.imagePrompt) {
      return NextResponse.json({ error: "Missing imagePrompt" }, { status: 400 })
    }

    let imageUrl = await generateSingleImage(body)

    if (body.projectId && body.projectName && imageUrl.startsWith("data:image/")) {
      const m = imageUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/)
      if (m) {
        const ext = m[1] === "jpeg" ? "jpg" : m[1]
        const local = await StorageService.saveBase64Image(
          body.projectId,
          `gen-${Date.now()}.${ext}`,
          m[2],
          body.projectName,
        )
        if (local) imageUrl = local
      }
    }

    return NextResponse.json({ imageUrl })
  } catch (e: any) {
    log.error('Image generation failed', e)
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 })
  }
}