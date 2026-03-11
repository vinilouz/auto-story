import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { type ProjectData, StorageService } from "@/lib/storage";

const log = createLogger("api/projects");

export async function GET() {
  try {
    return NextResponse.json(await StorageService.getAllProjects());
  } catch (e) {
    log.error("Failed to fetch projects", e);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.scriptText) {
      return NextResponse.json(
        { error: "Missing required field: scriptText" },
        { status: 400 },
      );
    }

    // Merge with existing project if updating
    let existing: ProjectData | null = null;
    if (body.id) {
      existing = await StorageService.getProject(body.id);
    }

    if (existing) {
      const merged: ProjectData = {
        ...existing,
        ...body,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };
      await StorageService.saveProject(merged);
      log.success(
        `Updated project: ${merged.name} (${merged.id.substring(0, 8)})`,
      );
      return NextResponse.json(merged);
    }

    // New project
    const project: ProjectData = {
      id: body.id || crypto.randomUUID(),
      name: body.name || `Project ${new Date().toLocaleString()}`,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      flowType: body.flowType || "simple",
      scriptText: body.scriptText,
      segmentSize: body.segmentSize,
      language: body.language,
      style: body.style,
      voice: body.voice,
      consistency: body.consistency,
      segments: body.segments || [],
      entities: body.entities,
      audioUrls: body.audioUrls,
      commentator: body.commentator,
      audioSystemPrompt: body.audioSystemPrompt,
      audioBatches: body.audioBatches,
      transcriptionResults: body.transcriptionResults,
      videoModel: body.videoModel,
    };

    await StorageService.saveProject(project);
    log.success(
      `Created project: ${project.name} (${project.id.substring(0, 8)})`,
    );
    return NextResponse.json(project);
  } catch (e) {
    log.error("Save project error", e);
    return NextResponse.json(
      { error: "Failed to save project" },
      { status: 500 },
    );
  }
}
