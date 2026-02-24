import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { transcribeWithElevenLabs } from "@/lib/ai/transcription/elevenlabs";

export async function POST(req: Request) {
  try {
    const { audioUrls } = await req.json();

    if (!audioUrls || !Array.isArray(audioUrls)) {
      return NextResponse.json({ error: "Invalid audioUrls" }, { status: 400 });
    }

    const results = [];

    for (const url of audioUrls) {
      const filename = url.split('/').pop();
      if (!filename) continue;

      const inputPath = path.join(process.cwd(), 'public', url);

      if (!fs.existsSync(inputPath)) {
        console.error(`File not found: ${inputPath}`);
        results.push({ url, status: 'error', error: 'File not found' });
        continue;
      }

      const suffix = '.elevenlabs.json';
      const outputPath = `${inputPath}${suffix}`;

      if (fs.existsSync(outputPath)) {
        const existingData = fs.readFileSync(outputPath, 'utf-8');
        results.push({ url, status: 'completed', transcriptionUrl: `${url}${suffix}`, data: JSON.parse(existingData) });
        continue;
      }

      try {
        console.log(`[Transcription] Transcribing ${filename} with ElevenLabs STT...`);
        const captions = await transcribeWithElevenLabs(inputPath);

        fs.writeFileSync(outputPath, JSON.stringify(captions, null, 2));

        results.push({
          url,
          status: 'completed',
          transcriptionUrl: `${url}${suffix}`,
          data: captions
        });

      } catch (err: any) {
        console.error(`Error transcribing ${filename}:`, err);
        results.push({ url, status: 'error', error: err.message });
      }
    }

    return NextResponse.json({ results });

  } catch (error: any) {
    console.error("Transcription route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

