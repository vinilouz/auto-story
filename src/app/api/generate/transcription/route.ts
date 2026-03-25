import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { execute } from "@/lib/ai/providers";
import { createLogger } from "@/lib/logger";
import { concatenateAudio } from "@/lib/utils/audio";

const log = createLogger("api/transcription");

const DATA_DIR = path.join(process.cwd(), "public", "projects");

export async function POST(req: Request) {
  try {
    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing projectId" },
        { status: 400 },
      );
    }

    const dir = path.join(DATA_DIR, projectId, "audios");

    if (!fs.existsSync(dir)) {
      return NextResponse.json(
        { error: "Audio directory not found" },
        { status: 404 },
      );
    }

    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith("audio_") && f.endsWith(".mp3"))
      .sort()
      .map((f) => path.join(dir, f));

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No audio files found" },
        { status: 404 },
      );
    }

    const audioPath =
      files.length === 1
        ? files[0]
        : await concatenateAudio(files, path.join(dir, "full_audio.mp3"));

    const cachePath = `${audioPath}.elevenlabs.json`;
    if (fs.existsSync(cachePath)) {
      const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      log.info("Using cached transcription");
      return NextResponse.json({
        words: cached,
        url: `/projects/${projectId}/audios/${path.basename(audioPath)}`,
      });
    }

    log.info("Transcribing audio via LouzLabs API...");
    const { words } = await execute("generateTranscription", {
      file: audioPath,
    });
    fs.writeFileSync(cachePath, JSON.stringify(words, null, 2));
    log.success(`Transcription complete: ${words.length} words`);

    return NextResponse.json({
      words,
      url: `/projects/${projectId}/audios/${path.basename(audioPath)}`,
    });
  } catch (e: unknown) {
    log.error("Transcription route error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
