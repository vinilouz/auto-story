import { NextRequest, NextResponse } from "next/server"
import { StorageService } from "@/lib/storage"
import { createLogger } from "@/lib/logger"

const log = createLogger('api/projects/[id]')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = await StorageService.getProject(id)
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    return NextResponse.json(project)
  } catch (e) {
    log.error('Failed to fetch project', e)
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await StorageService.deleteProject(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    log.error('Failed to delete project', e)
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
  }
}