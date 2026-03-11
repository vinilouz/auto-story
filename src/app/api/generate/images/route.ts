import { NextRequest, NextResponse } from "next/server"
import { executeBatch, BatchResult } from "@/lib/ai/queue"
import { ImageRequest, ImageResponse } from "@/lib/ai/registry"
import { StorageService } from "@/lib/storage"
import { createLogger } from "@/lib/logger"

const log = createLogger('api/images')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (Array.isArray(body.requests)) {
      return handleBatch(body.requests, body.projectId, body.projectName)
    }

    if (!body.imagePrompt) {
      return NextResponse.json({ error: "Missing imagePrompt" }, { status: 400 })
    }

    // Single request — index pode ser passado para nomear o arquivo corretamente
    const segmentIndex: number = body.index ?? 0

    const singleReq: ImageRequest = {
      prompt: body.imagePrompt,
      referenceImages: body.referenceImages || (body.referenceImage ? [body.referenceImage] : undefined),
      config: body.imageConfig,
    }
    const results = await executeBatch('generateImage', [singleReq])
    const result = results[0]

    if (result.status === 'error') {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    let imageUrl = result.data!.imageUrl

    if (body.projectId && body.projectName && imageUrl.startsWith('data:image/')) {
      const m = imageUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/)
      if (m) {
        const ext = m[1] === 'jpeg' ? 'jpg' : m[1]
        // img-1.jpg, img-2.jpg ... (1-indexed)
        const fileName = `img-${segmentIndex + 1}.${ext}`
        const local = await StorageService.saveBase64Image(body.projectId, fileName, m[2], body.projectName)
        if (local) {
          imageUrl = local
          // Patch imediato no config
          await StorageService.patchSegmentImage(body.projectId, body.projectName, segmentIndex, imageUrl)
        }
      }
    }

    return NextResponse.json({ imageUrl, id: result.id })
  } catch (e: any) {
    log.error('Image generation failed', e)
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}

async function handleBatch(
  requests: any[],
  projectId?: string,
  projectName?: string,
) {
  // Cada request deve incluir `index` (índice do segmento) para nomear o arquivo
  const batchRequests: ImageRequest[] = requests.map(r => ({
    prompt: r.imagePrompt,
    referenceImages: r.referenceImages || (r.referenceImage ? [r.referenceImage] : undefined),
    config: r.imageConfig,
  }))

  const results = await executeBatch('generateImage', batchRequests)

  const processed = await Promise.all(
    results.map(async (r, i) => {
      if (r.status === 'error') return r

      const segmentIndex: number = requests[i]?.index ?? i
      const imgRes = r.data as ImageResponse
      let imageUrl = imgRes.imageUrl

      if (projectId && projectName && imageUrl.startsWith('data:image/')) {
        const m = imageUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/)
        if (m) {
          const ext = m[1] === 'jpeg' ? 'jpg' : m[1]
          // img-1.jpg, img-2.jpg ... usa o índice real do segmento
          const fileName = `img-${segmentIndex + 1}.${ext}`
          const local = await StorageService.saveBase64Image(projectId, fileName, m[2], projectName)
          if (local) {
            imageUrl = local
            // Patch imediato no config — não espera o cliente salvar
            await StorageService.patchSegmentImage(projectId, projectName, segmentIndex, imageUrl)
          }
        }
      }

      return { ...r, data: { imageUrl } }
    })
  )

  return NextResponse.json({ results: processed })
}