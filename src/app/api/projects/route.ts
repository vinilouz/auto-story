import { NextRequest, NextResponse } from "next/server"
import { StorageService, ProjectData } from "@/lib/storage"

export async function GET() {
  try {
    const projects = await StorageService.getAllProjects()
    return NextResponse.json(projects)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Basic validation
    if (!body.scriptText) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const project: ProjectData = {
      id: body.id || crypto.randomUUID(),
      name: body.name || `Project ${new Date().toLocaleString()}`,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      flowType: body.flowType || 'simple',
      scriptText: body.scriptText,
      segmentSize: body.segmentSize || 150,
      language: body.language,
      style: body.style,
      voice: body.voice,
      consistency: body.consistency,
      // Simple flow fields
      segments: body.segments || [],
      entities: body.entities,
      audioUrls: body.audioUrls,
      // Commentator flow fields
      commentator: body.commentator,
      audioSystemPrompt: body.audioSystemPrompt,
      audioBatches: body.audioBatches,
      transcriptionResults: body.transcriptionResults
    }

    await StorageService.saveProject(project)

    return NextResponse.json(project)
  } catch (error) {
    console.error("Save project error:", error)
    return NextResponse.json(
      { error: "Failed to save project" },
      { status: 500 }
    )
  }
}
