import fs from "fs";
import { NextResponse } from "next/server";
import path from "path";
import { execute } from "@/lib/ai/providers";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/transcription");

export async function POST(req: Request) {
  try {
    const { audioUrls } = await req.json();

    if (!audioUrls || !Array.isArray(audioUrls)) {
      return NextResponse.json({ error: "Invalid audioUrls" }, { status: 400 });
    }

    log.info(`Transcription request: ${audioUrls.length} files`);
    const results = [];

    for (const url of audioUrls) {
      const filename = url.split("/").pop();
      if (!filename) continue;

      const inputPath = path.join(process.cwd(), "public", url);

      if (!fs.existsSync(inputPath)) {
        log.warn(`File not found: ${inputPath}`);
        results.push({ url, status: "error", error: "File not found" });
        continue;
      }

      const suffix = ".elevenlabs.json";
      const outputPath = `${inputPath}${suffix}`;

      // Return cached transcription if exists
      if (fs.existsSync(outputPath)) {
        const existingData = fs.readFileSync(outputPath, "utf-8");
        log.info(`Using cached transcription for ${filename}`);
        results.push({
          url,
          status: "completed",
          transcriptionUrl: `${url}${suffix}`,
          data: JSON.parse(existingData),
        });
        continue;
      }

      try {
        log.info(`Transcribing ${filename} via LouzLabs API...`);
        const { words } = await execute("generateTranscription", { file: inputPath });
        fs.writeFileSync(outputPath, JSON.stringify(words, null, 2));
        log.success(`Transcribed ${filename}: ${words.length} words`);

        results.push({
          url,
          status: "completed",
          transcriptionUrl: `${url}${suffix}`,
          data: words,
        });
      } catch (err: any) {
        log.error(`Transcription failed for ${filename}`, err.message);
        results.push({ url, status: "error", error: err.message });
      }
    }

    const ok = results.filter((r) => r.status === "completed").length;
    log.info(`Transcription batch done: ${ok}/${results.length} ok`);

    return NextResponse.json({ results });
  } catch (e: any) {
    log.error("Transcription route error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
