import { NextResponse } from 'next/server'
// Update this path to where your anondrop.ts file actually lives
import { uploadToAnonDrop } from '@/lib/ai/utils/anondrop'

export async function GET() {
  try {
    // A tiny 1x1 transparent PNG encoded in base64
    const tinyPngBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

    console.log('Initiating test upload to AnonDrop...')

    // Call our function
    const url = await uploadToAnonDrop(tinyPngBase64, 'test-pixel.png')

    return NextResponse.json({
      success: true,
      message: 'Upload successful!',
      hostedUrl: url
    })
  } catch (error) {
    console.error('Test upload failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}