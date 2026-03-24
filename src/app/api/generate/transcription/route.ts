import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { execute } from "@/lib/ai/providers";
import { createLogger } from "@/lib/logger";
import { concatenateAudio } from "@/lib/utils/audio";

const log = createLogger("api/transcription");

export async function POST(req: Request) {
  try {
    const { projectId, projectName } = await req.json();

    if (!projectId || !projectName) {
      return NextResponse.json({ error: "Missing projectId or projectName" }, { status: 400 });
    }

    const dir = path.join(process.cwd(), "public", "projects", `${projectId}_${projectName}`, "audios");

    if (!fs.existsSync(dir)) {
      return NextResponse.json({ error: "Audio directory not found" }, { status: 404 });
    }

    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith("audio_") && f.endsWith(".mp3"))
      .sort()
      .map(f => path.join(dir, f));

    if (files.length === 0) {
      return NextResponse.json({ error: "No audio files found" }, { status: 404 });
    }

    log.info(`Found ${files.length} audio files to concatenate`);

    const outputPath = path.join(dir, "full_audio.mp3");
    await concatenateAudio(files, outputPath);
    log.success(`Concatenated audio saved to ${outputPath}`);

    const cachePath = `${outputPath}.elevenlabs.json`;
    if (fs.existsSync(cachePath)) {
      const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      log.info("Using cached transcription");
      return NextResponse.json({ words: cached, url: `/projects/${projectId}_${projectName}/audios/full_audio.mp3` });
    }

    log.info("Transcribing concatenated audio via LouzLabs API...");
    const { words } = await execute("generateTranscription", { file: outputPath });
    fs.writeFileSync(cachePath, JSON.stringify(words, null, 2));
    log.success(`Transcription complete: ${words.length} words`);

    return NextResponse.json({ words, url: `/projects/${projectId}_${projectName}/audios/full_audio.mp3` });
  } catch (e: any) {
    log.error("Transcription route error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
