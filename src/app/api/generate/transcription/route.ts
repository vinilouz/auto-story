import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { concatenateAudio } from "@/lib/utils/audio";

const log = createLogger("api/transcription");

const DATA_DIR = path.join(process.cwd(), "public", "projects");

async function transcribe(audioFilePath: string) {
  const fileBuffer = fs.readFileSync(audioFilePath);
  const form = new FormData();
  form.append(
    "file",
    new Blob([fileBuffer], { type: "audio/mpeg" }),
    path.basename(audioFilePath),
  );

  const res = await fetch(
    `${process.env.LOUZLABS_BASE_URL}/v1/audio/transcriptions`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.LOUZLABS_API_KEY}` },
      body: form,
    },
  );
  if (!res.ok)
    throw new Error(`Transcription failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as {
    words: Array<{ text: string; startMs: number; endMs: number }>;
  };
}

export async function POST(req: Request) {
  try {
    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
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
    const audioUrl = `/projects/${projectId}/audios/${path.basename(audioPath)}`;
    const transcriptionUrl = `${audioUrl}.elevenlabs.json`;

    if (fs.existsSync(cachePath)) {
      log.info("Using cached transcription");
      return NextResponse.json({ url: audioUrl, transcriptionUrl });
    }

    log.info(`Transcribing ${path.basename(audioPath)}...`);
    const { words } = await transcribe(audioPath);
    fs.writeFileSync(cachePath, JSON.stringify(words, null, 2));
    log.success(`Transcription complete: ${words.length} words`);

    return NextResponse.json({ url: audioUrl, transcriptionUrl });
  } catch (e: unknown) {
    log.error("Transcription route error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
