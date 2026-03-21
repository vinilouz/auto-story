import { type NextRequest, NextResponse } from "next/server";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { execute } from "@/lib/ai/providers";
import { StorageService } from "@/lib/storage";
import { getProjectDirName } from "@/lib/utils";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/music");

export async function POST(request: NextRequest) {
  try {
    const { projectId, projectName, prompt } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    log.info(`Music generation request for project: ${projectId}`);

    const { musicUrl } = await execute("generateMusic", {
      prompt: prompt || "Soft spiritual instrumental, gentle piano, warm strings and ambient choir, peaceful and sacred mood, reflective atmosphere inspired by biblical themes, perfect background music for narrating stories from the Bible, no vocals.",
      instrumental: true,
    });

    const dir = getProjectDirName(projectId, projectName || "untitled");
    const musicDir = path.join(process.cwd(), "public", "projects", dir, "music");

    if (!existsSync(musicDir)) mkdirSync(musicDir, { recursive: true });

    const filename = "background.mp4";
    const filepath = path.join(musicDir, filename);
    const publicPath = `/projects/${dir}/music/${filename}`;

    if (musicUrl.startsWith("data:")) {
      const [, base64Data] = musicUrl.split(",");
      writeFileSync(filepath, Buffer.from(base64Data, "base64"));
    } else {
      const res = await fetch(musicUrl);
      if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
      writeFileSync(filepath, Buffer.from(await res.arrayBuffer()));
    }

    log.success(`Music saved: ${publicPath}`);

    await StorageService.patchMusic(projectId, projectName || "untitled", publicPath);

    return NextResponse.json({ musicUrl: publicPath });
  } catch (e: any) {
    log.error("Music generation failed", e);
    return NextResponse.json(
      { error: e.message || "Internal error" },
      { status: 500 },
    );
  }
}
