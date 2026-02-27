import { NextRequest, NextResponse } from "next/server"
import { generateVideoClip } from "@/lib/ai/providers/custom-client"
import { VIDEO_MODELS } from "@/config/video-models"
import fs from "fs"
import path from "path"
import { cleanTitle } from "@/lib/utils"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.prompt || !body.referenceImageUrl || !body.modelId) {
      return NextResponse.json(
        { error: "Missing required fields: prompt, referenceImageUrl, modelId" },
        { status: 400 }
      )
    }

    const model = VIDEO_MODELS.find(m => m.id === body.modelId)
    if (!model) {
      return NextResponse.json(
        { error: `Unknown video model: ${body.modelId}` },
        { status: 400 }
      )
    }

    let imageUrl = body.referenceImageUrl;
    if (imageUrl.startsWith('/projects/') || imageUrl.startsWith('data:image/')) {
      let buffer: Buffer;
      let mime = 'image/jpeg';
      let fileName = `img-${Date.now()}.jpg`;

      if (imageUrl.startsWith('/projects/')) {
        const publicDir = path.join(process.cwd(), 'public');
        const filePath = path.join(publicDir, imageUrl);
        buffer = await fs.promises.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase().replace('.', '');
        mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        fileName = `img-${Date.now()}.${ext}`;
      } else {
        const matches = imageUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const ext = matches[1];
          mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
          buffer = Buffer.from(matches[2], 'base64');
          fileName = `img-${Date.now()}.${ext}`;
        } else {
          throw new Error('Invalid data URI format');
        }
      }

      const blob = new Blob([new Uint8Array(buffer)], { type: mime });
      const { S3Client } = await import('@/lib/networking/s3-client');
      const uploadResp = await S3Client.uploadFile(blob, fileName);
      const htmlText = await uploadResp.text();

      const hrefMatch = htmlText.match(/href='([^']+)'/);

      if (hrefMatch && hrefMatch[1]) {
        const pageUrl = hrefMatch[1];

        // Fetch the page to get the filename
        const pageResp = await fetch(pageUrl);
        const pageHtml = await pageResp.text();
        const filenameMatch = pageHtml.match(/<h2[^>]*>([^<]+)<\/h2>/i);

        if (filenameMatch && filenameMatch[1]) {
          const finalFilename = filenameMatch[1].trim();
          imageUrl = pageUrl.endsWith('/') ? `${pageUrl}${finalFilename}` : `${pageUrl}/${finalFilename}`;
        } else {
          // Fallback to the generated filename if scraping fails
          imageUrl = pageUrl.endsWith('/') ? `${pageUrl}${fileName}` : `${pageUrl}/${fileName}`;
        }
      } else {
        throw new Error('Failed to extract S3 URL from response');
      }
    }

    const videoUrl = await generateVideoClip(body.prompt, imageUrl, model)

    if (body.projectId && body.projectName && videoUrl.startsWith('http')) {
      try {
        const videoResponse = await fetch(videoUrl)
        if (!videoResponse.ok) throw new Error('Failed to download video')

        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer())
        const slug = cleanTitle(body.projectName)
        const shortId = body.projectId.split('-')[0] || body.projectId.substring(0, 8)
        const dirName = `${slug}-${shortId}`
        const videosDir = path.join(process.cwd(), 'public', 'projects', dirName, 'videos')

        if (!fs.existsSync(videosDir)) {
          await fs.promises.mkdir(videosDir, { recursive: true })
        }

        const fileName = `clip-${Date.now()}.mp4`
        const outputPath = path.join(videosDir, fileName)
        await fs.promises.writeFile(outputPath, videoBuffer)

        const localUrl = `/projects/${dirName}/videos/${fileName}`
        return NextResponse.json({ videoUrl: localUrl })
      } catch (downloadError) {
        console.error('[Video API] Download/save error:', downloadError)
        return NextResponse.json({ videoUrl })
      }
    }

    return NextResponse.json({ videoUrl })
  } catch (error) {
    console.error("Video API Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
