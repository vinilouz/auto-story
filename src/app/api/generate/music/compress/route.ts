import { type NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import path from "path";
import ffmpeg from "ffmpeg-static";
import { normalizeLoudness } from "@/lib/services/media-saver";
import { StorageService } from "@/lib/storage";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/music/compress");

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    if (!ffmpeg || !existsSync(ffmpeg)) {
      return NextResponse.json(
        { error: "ffmpeg not available on this server" },
        { status: 501 },
      );
    }

    const dir = path.join(process.cwd(), "public", "projects", projectId, "music");
    const rawPath = path.join(dir, "background-raw.mp4");
    const compressedPath = path.join(dir, "background.mp4");

    if (!existsSync(rawPath)) {
      return NextResponse.json({ error: "Raw music file not found" }, { status: 404 });
    }

    if (existsSync(compressedPath)) {
      const publicPath = `/projects/${projectId}/music/background.mp4`;
      return NextResponse.json({ musicUrl: publicPath });
    }

    await normalizeLoudness(rawPath, compressedPath);

    if (!existsSync(compressedPath)) {
      return NextResponse.json(
        { error: "Compression produced no output" },
        { status: 500 },
      );
    }

    const publicPath = `/projects/${projectId}/music/background.mp4`;
    await StorageService.patchMusic(projectId, publicPath);
    log.success(`Music compressed: ${publicPath}`);

    return NextResponse.json({ musicUrl: publicPath });
  } catch (e: any) {
    log.error("Music compression failed", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
