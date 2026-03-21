import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { type ProjectData, StorageService } from "@/lib/storage";
import { createProject, updateProject } from "@/lib/services/project-service";

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

    let project: ProjectData;
    const existing = body.id ? await StorageService.getProject(body.id) : null;

    if (existing) {
      project = updateProject(existing, body);
      log.success(`Updated project: ${project.name} (${project.id.substring(0, 8)})`);
    } else {
      project = createProject(body);
      log.success(`Created project: ${project.name} (${project.id.substring(0, 8)})`);
    }

    await StorageService.saveProject(project);
    return NextResponse.json(project);
  } catch (e) {
    log.error("Save project error", e);
    return NextResponse.json(
      { error: "Failed to save project" },
      { status: 500 },
    );
  }
}
