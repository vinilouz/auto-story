import { useState, useEffect, useCallback } from "react"
import { ProjectData, AudioBatch, TranscriptionResult, VisualDescription, SegmentWithComment, CommentatorConfig, EntityAsset } from "./types"
import { cleanTitle } from "@/lib/utils"

interface UseProjectConfig {
  projectId?: string
  flowType: 'simple' | 'with-commentator'
  getProjectData: () => Omit<ProjectData, 'id' | 'flowType' | 'name'> & { name?: string }
  onLoad?: (data: LoadedProjectData) => void
}

export interface LoadedProjectData {
  name?: string
  consistency?: boolean
  scriptText: string
  segmentSize: number
  language: string
  style?: string
  voice?: string
  segments?: string[]
  entities?: EntityAsset[]
  visualDescriptions?: VisualDescription[]
  segmentsWithComments?: SegmentWithComment[]
  audioBatches?: AudioBatch[]
  audioSystemPrompt?: string
  transcriptionResults?: TranscriptionResult[]
  commentator?: CommentatorConfig
}

export function useProject(config: UseProjectConfig) {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(config.projectId || null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(!!config.projectId)

  useEffect(() => {
    if (config.projectId) {
      setIsLoading(true)
      loadProject(config.projectId)
    }
  }, [config.projectId])

  const loadProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`)
      if (res.ok) {
        const project = await res.json()
        setCurrentProjectId(project.id)
        config.onLoad?.({
          name: project.name,
          consistency: project.consistency || false,
          scriptText: project.scriptText || '',
          segmentSize: project.segmentSize || 150,
          language: project.language || 'english',
          style: project.style,
          voice: project.voice,
          segments: project.segments,
          entities: project.entities,
          visualDescriptions: project.visualDescriptions,
          segmentsWithComments: project.segmentsWithComments,
          audioBatches: project.audioBatches || (project.audioUrls?.map((url: string, i: number) => ({
            index: i,
            text: `Legacy ${i}`,
            status: 'completed' as const,
            url
          }))),
          audioSystemPrompt: project.audioSystemPrompt,
          transcriptionResults: project.transcriptionResults,
          commentator: project.commentator
        })
      }
    } catch (error) {
      console.error('Load error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const save = async (overrides?: Partial<ProjectData>) => {
    const projectPayload = config.getProjectData()

    if (!projectPayload.scriptText?.trim()) return null

    setIsSaving(true)

    try {
      let resolvedName = projectPayload.name?.trim();
      if (!resolvedName) {
        resolvedName = cleanTitle(projectPayload.scriptText);
      }

      const projectData: ProjectData = {
        id: currentProjectId || undefined,
        name: resolvedName,
        flowType: config.flowType,
        ...projectPayload,
        ...overrides
      } as ProjectData

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      })

      if (res.ok) {
        const savedProject = await res.json()
        setCurrentProjectId(savedProject.id)
        return savedProject
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      console.error('Save error:', error)
      throw error
    } finally {
      setIsSaving(false)
    }
  }



  return {
    currentProjectId,
    save,
    loadProject,
    isSaving,
    isLoading
  }
}

export function determineStage(data: LoadedProjectData, flowType: 'simple' | 'with-commentator'): string {
  if (data.transcriptionResults && data.transcriptionResults.length > 0) {
    return 'TRANSCRIPTION'
  }
  if (data.audioBatches && data.audioBatches.some(b => b.status === 'completed')) {
    return 'AUDIO'
  }
  if (data.consistency && data.entities && data.entities.length > 0 && !data.entities.every((e: EntityAsset) => e.status === 'completed')) {
    return 'ENTITIES'
  }
  if (data.visualDescriptions && data.visualDescriptions.length > 0) {
    return 'IMAGES'
  }
  if (data.segmentsWithComments && data.segmentsWithComments.length > 0) {
    return 'DESCRIPTIONS'
  }
  if (data.commentator && flowType === 'with-commentator') {
    return 'COMMENTS'
  }
  if (data.segments && data.segments.length > 0) {
    return flowType === 'with-commentator' ? 'COMMENTATOR' : 'DESCRIPTIONS'
  }
  return 'INPUT'
}

export function useDownload() {
  const [isDownloading, setIsDownloading] = useState(false)

  const downloadZip = async (payload: {
    visualDescriptions: VisualDescription[]
    segments?: string[]
    segmentsWithComments?: SegmentWithComment[]
    audioUrls: string[]
    transcriptionResults: TranscriptionResult[]
    filename?: string
  }) => {
    setIsDownloading(true)

    try {
      const res = await fetch('/api/generate/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visualDescriptions: payload.visualDescriptions,
          segments: payload.segments,
          segmentsWithComments: payload.segmentsWithComments,
          audioUrls: payload.audioUrls,
          transcriptionResults: payload.transcriptionResults
        })
      })

      if (!res.ok) throw new Error('Failed to download ZIP')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = payload.filename || `story-${Date.now()}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download error:', error)
      throw error
    } finally {
      setIsDownloading(false)
    }
  }

  return {
    downloadZip,
    isDownloading
  }
}
