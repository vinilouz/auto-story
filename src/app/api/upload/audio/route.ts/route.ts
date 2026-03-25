import { type NextRequest, NextResponse } from "next/server";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { createLogger } from "@/lib/logger";
import { getProjectDirName } from "@/lib/utils";

const log = createLogger("api/upload/audio");

const DATA_DIR = path.join(process.cwd(), "public", "projects");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const projectName = formData.get("projectName") as string | null;

    if (!file || !projectId || !projectName) {
      return NextResponse.json(
        { error: "Missing file, projectId or projectName" },
        { status: 400 },
      );
    }

    if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|ogg|m4a|webm)$/i)) {
      return NextResponse.json(
        { error: "Invalid file type — audio required" },
        { status: 400 },
      );
    }

    const dirName = getProjectDirName(projectId, projectName);
    const audiosDir = path.join(DATA_DIR, dirName, "audios");

    if (!existsSync(audiosDir)) mkdirSync(audiosDir, { recursive: true });

    const ext = file.name.split(".").pop() ?? "mp3";
    const fileName = `audio_0001.${ext}`;
    const filePath = path.join(audiosDir, fileName);
    const publicPath = `/projects/${dirName}/audios/${fileName}`;

    const bytes = await file.arrayBuffer();
    writeFileSync(filePath, Buffer.from(bytes));

    log.success(`Audio uploaded: ${publicPath} (${Math.round(file.size / 1024)} KB)`);

    return NextResponse.json({ audioPath: publicPath, fileName });
  } catch (e: any) {
    log.error("Audio upload failed", e);
    return NextResponse.json(
      { error: e.message || "Upload failed" },
      { status: 500 },
    );
  }
}
