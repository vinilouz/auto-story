import { NextRequest, NextResponse } from "next/server"
import JSZip from "jszip"

interface ZipRequest {
  visualDescriptions: Array<{
    imagePrompt: string
    imageUrl?: string
    status: 'pending' | 'generating' | 'completed' | 'error'
  }>
  segments: string[]
  segmentsWithComments?: Array<{ type: 'scene_text' | 'comment', content: string }>
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

    if (!body.visualDescriptions || !Array.isArray(body.visualDescriptions)) {
      return NextResponse.json(
        { error: "Missing required fields: visualDescriptions (array)" },
        { status: 400 }
      )
    }

    const zip = new JSZip()
    let downloadedCount = 0
    const errors: string[] = []

    // Add images to ZIP (only completed ones)
    for (let i = 0; i < body.visualDescriptions.length; i++) {
      const desc = body.visualDescriptions[i]

      if (desc.status === 'completed' && desc.imageUrl) {
        try {
          // Fetch image data
          const response = await fetch(desc.imageUrl)
          if (!response.ok) throw new Error(`Failed to fetch image ${i + 1}`)

          const arrayBuffer = await response.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          // Add to ZIP with sequential naming
          const filename = `scene-${String(i + 1).padStart(3, '0')}.jpg`
          zip.file(filename, buffer)
          downloadedCount++
        } catch (error: any) {
          errors.push(`Failed to download image ${i + 1}: ${error.message}`)
        }
      }
    }

    // Add audio files to ZIP
    if (body.audioUrls && Array.isArray(body.audioUrls)) {
      for (let i = 0; i < body.audioUrls.length; i++) {
        const audioUrl = body.audioUrls[i]
        try {
          // Fetch audio data
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

    // Add transcription files to ZIP
    if (body.transcriptionResults && Array.isArray(body.transcriptionResults)) {
      for (let i = 0; i < body.transcriptionResults.length; i++) {
        const result = body.transcriptionResults[i]
        if (result.status === 'completed' && result.transcriptionUrl) {
          try {
            // Fetch transcription data
            let fetchUrl = result.transcriptionUrl
            if (result.transcriptionUrl.startsWith('/')) {
              fetchUrl = `${request.nextUrl.origin}${result.transcriptionUrl}`
            }

            const response = await fetch(fetchUrl)
            if (!response.ok) throw new Error(`Failed to fetch transcription ${i + 1}`)

            const text = await response.text() // JSON content

            // Should match audio filename convention
            // We assume audioUrls and transcriptionResults correspond by index if both generated sequentially,
            // OR we can just rely on the order in transcriptionResults.
            // But ideally we want: part-001.mp3 -> part-001.json

            // Just use sequential for now as per audio loop
            const filename = `part-${String(i + 1).padStart(3, '0')}.json`
            zip.file(filename, text)

          } catch (error: any) {
            errors.push(`Failed to download transcription ${i + 1}: ${error.message}`)
          }
        }
      }
    }

    // Add metadata file with descriptions
    const metadata = {
      generatedAt: new Date().toISOString(),
      totalScenes: body.visualDescriptions.length,
      audioFiles: body.audioUrls?.map((_, i) => ({
        filename: `part-${String(i + 1).padStart(3, '0')}.mp3`,
        partNumber: i + 1,
        transcriptionFile: body.transcriptionResults?.[i]?.status === 'completed' ? `part-${String(i + 1).padStart(3, '0')}.json` : null
      })) || [],
      scenes: body.visualDescriptions.map((desc, index) => ({
        sceneNumber: index + 1,
        text: body.segmentsWithComments?.[index]?.content || body.segments[index] || '',
        visualText: desc.imagePrompt,
        type: body.segmentsWithComments?.[index]?.type || 'scene_text'
      }))
    }

    zip.file('metadata.json', JSON.stringify(metadata, null, 2))

    // Add script text file
    if (body.segments && body.segments.length > 0) {
      const scriptContent = body.segments.map((segment, index) =>
        `=== CENA ${index + 1} ===\n\n${segment}`
      ).join('\n\n')
      zip.file('script.txt', scriptContent)
    }

    // Add prompts JSON file
    const prompts = body.visualDescriptions.map((desc, index) => ({
      sceneNumber: index + 1,
      prompt: desc.imagePrompt,
      status: desc.status
    }))
    zip.file('prompts.json', JSON.stringify(prompts, null, 2))

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'uint8array' })

    // Return ZIP file
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