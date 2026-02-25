import { NextRequest, NextResponse } from "next/server"
import JSZip from "jszip"
import { Segment } from "@/lib/flows/types"

interface ZipRequest {
  segments: Segment[]
  audioUrls?: string[]
  transcriptionResults?: Array<{
    url: string
    status: 'completed' | 'error'
    transcriptionUrl?: string
  }>
}

export async function POST(request: NextRequest) {
  try {
    const body: ZipRequest = await request.json()

    if (!body.segments || !Array.isArray(body.segments)) {
      return NextResponse.json(
        { error: "Missing required fields: segments (array)" },
        { status: 400 }
      )
    }

    const zip = new JSZip()
    let downloadedCount = 0
    const errors: string[] = []

    for (let i = 0; i < body.segments.length; i++) {
      const seg = body.segments[i]
      if (seg.imagePath) {
        try {
          let fetchUrl = seg.imagePath
          if (seg.imagePath.startsWith('/')) {
            fetchUrl = `${request.nextUrl.origin}${seg.imagePath}`
          }
          const response = await fetch(fetchUrl)
          if (!response.ok) throw new Error(`Failed to fetch image ${i + 1}`)

          const arrayBuffer = await response.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          const filename = `scene-${String(i + 1).padStart(3, '0')}.jpg`
          zip.file(filename, buffer)
          downloadedCount++
        } catch (error: any) {
          errors.push(`Failed to download image ${i + 1}: ${error.message}`)
        }
      }
    }

    if (body.audioUrls && Array.isArray(body.audioUrls)) {
      for (let i = 0; i < body.audioUrls.length; i++) {
        const audioUrl = body.audioUrls[i]
        try {
          let fetchUrl = audioUrl
          if (audioUrl.startsWith('/')) {
            fetchUrl = `${request.nextUrl.origin}${audioUrl}`
          }

          const response = await fetch(fetchUrl)
          if (!response.ok) throw new Error(`Failed to fetch audio ${i + 1}`)

          const arrayBuffer = await response.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          const filename = `part-${String(i + 1).padStart(3, '0')}.mp3`
          zip.file(filename, buffer)
        } catch (error: any) {
          errors.push(`Failed to download audio ${i + 1}: ${error.message}`)
        }
      }
    }

    if (body.transcriptionResults && Array.isArray(body.transcriptionResults)) {
      for (let i = 0; i < body.transcriptionResults.length; i++) {
        const result = body.transcriptionResults[i]
        if (result.status === 'completed' && result.transcriptionUrl) {
          try {
            let fetchUrl = result.transcriptionUrl
            if (result.transcriptionUrl.startsWith('/')) {
              fetchUrl = `${request.nextUrl.origin}${result.transcriptionUrl}`
            }

            const response = await fetch(fetchUrl)
            if (!response.ok) throw new Error(`Failed to fetch transcription ${i + 1}`)

            const text = await response.text()
            const filename = `part-${String(i + 1).padStart(3, '0')}.json`
            zip.file(filename, text)
          } catch (error: any) {
            errors.push(`Failed to download transcription ${i + 1}: ${error.message}`)
          }
        }
      }
    }

    const metadata = {
      generatedAt: new Date().toISOString(),
      totalScenes: body.segments.length,
      audioFiles: body.audioUrls?.map((_, i) => ({
        filename: `part-${String(i + 1).padStart(3, '0')}.mp3`,
        partNumber: i + 1,
        transcriptionFile: body.transcriptionResults?.[i]?.status === 'completed' ? `part-${String(i + 1).padStart(3, '0')}.json` : null
      })) || [],
      scenes: body.segments.map((seg, index) => ({
        sceneNumber: index + 1,
        text: seg.text,
        type: seg.type || 'scene_text',
        imagePrompt: seg.imagePrompt
      }))
    }

    zip.file('metadata.json', JSON.stringify(metadata, null, 2))

    const scriptContent = body.segments
      .filter(s => !s.type || s.type === 'scene_text')
      .map((seg, index) => `=== CENA ${index + 1} ===\n\n${seg.text}`)
      .join('\n\n')
    if (scriptContent) {
      zip.file('script.txt', scriptContent)
    }

    const prompts = body.segments
      .filter(s => s.imagePrompt)
      .map((seg, index) => ({
        sceneNumber: index + 1,
        prompt: seg.imagePrompt
      }))
    zip.file('prompts.json', JSON.stringify(prompts, null, 2))

    const zipBuffer = await zip.generateAsync({ type: 'uint8array' })

    return new NextResponse(zipBuffer as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="story-images-${Date.now()}.zip"`,
      },
    })

  } catch (error) {
    console.error("ZIP generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate ZIP file" },
      { status: 500 }
    )
  }
}