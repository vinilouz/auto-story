import { useState, useCallback } from "react"
import { Segment } from "./types"

interface ImageGenerationConfig {
  systemPrompt: string
  referenceImage?: string
  entities?: any[]
  buildPrompt?: (originalPrompt: string) => string
}

export function useImageGeneration(
  segments: Segment[],
  setSegments: React.Dispatch<React.SetStateAction<Segment[]>>,
  config: ImageGenerationConfig
) {
  const [isLoading, setIsLoading] = useState(false)
  const [imageStatuses, setImageStatuses] = useState<Map<number, 'generating' | 'error'>>(new Map())

  const updateSegmentAtIndex = useCallback((index: number, updates: Partial<Segment>) => {
    setSegments(prev => {
      const next = [...prev]
      if (next[index]) {
        next[index] = { ...next[index], ...updates }
      }
      return next
    })
  }, [setSegments])

  const setStatus = useCallback((index: number, status: 'generating' | 'error' | null) => {
    setImageStatuses(prev => {
      const next = new Map(prev)
      if (status === null) {
        next.delete(index)
      } else {
        next.set(index, status)
      }
      return next
    })
  }, [])

  const generateAll = async (params?: { projectId?: string | null, projectName?: string }) => {
    setIsLoading(true)

    const isRegeneratingAll = segments.every(s => s.imagePath)

    const promises = segments.map(async (seg, index) => {
      if (!seg.imagePrompt) return
      if (!isRegeneratingAll && seg.imagePath) return

      setStatus(index, 'generating')

      try {
        const finalPrompt = config.buildPrompt
          ? config.buildPrompt(seg.imagePrompt)
          : seg.imagePrompt

        const payload: any = {
          imagePrompt: finalPrompt,
          imageConfig: { aspect_ratio: "16:9" },
          systemPrompt: config.systemPrompt,
          projectId: params?.projectId,
          projectName: params?.projectName
        }

        const matches = finalPrompt.match(/<<([^>]+)>>/g)
        const extractedEntities = matches ? matches.map(m => m.replace(/<<|>>/g, '')) : []

        if (extractedEntities.length > 0 && config.entities) {
          const mentionedEntities = config.entities.filter(e => extractedEntities.includes(e.name) && e.imageUrl)
          if (mentionedEntities.length > 0) {
            payload.referenceImages = mentionedEntities.map(e => e.imageUrl)
          } else if (config.referenceImage) {
            payload.referenceImage = config.referenceImage
          }
        } else if (config.referenceImage) {
          payload.referenceImage = config.referenceImage
        }

        const res = await fetch('/api/generate/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        if (!res.ok) throw new Error('Failed to generate image')
        const data = await res.json()
        updateSegmentAtIndex(index, { imagePath: data.imageUrl })
        setStatus(index, null)
      } catch {
        setStatus(index, 'error')
      }
    })

    await Promise.all(promises)
    setIsLoading(false)
  }

  const regenerate = async (index: number, params?: { projectId?: string | null, projectName?: string }) => {
    const seg = segments[index]
    if (!seg?.imagePrompt) return

    setStatus(index, 'generating')

    try {
      const finalPrompt = config.buildPrompt
        ? config.buildPrompt(seg.imagePrompt)
        : seg.imagePrompt

      const payload: any = {
        imagePrompt: finalPrompt,
        imageConfig: { aspect_ratio: "16:9" },
        systemPrompt: config.systemPrompt,
        projectId: params?.projectId,
        projectName: params?.projectName
      }

      const matches = finalPrompt.match(/<<([^>]+)>>/g)
      const extractedEntities = matches ? matches.map(m => m.replace(/<<|>>/g, '')) : []

      if (extractedEntities.length > 0 && config.entities) {
        const mentionedEntities = config.entities.filter(e => extractedEntities.includes(e.name) && e.imageUrl)
        if (mentionedEntities.length > 0) {
          payload.referenceImages = mentionedEntities.map(e => e.imageUrl)
        } else if (config.referenceImage) {
          payload.referenceImage = config.referenceImage
        }
      } else if (config.referenceImage) {
        payload.referenceImage = config.referenceImage
      }

      const res = await fetch('/api/generate/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error('Failed to regenerate image')
      const data = await res.json()
      updateSegmentAtIndex(index, { imagePath: data.imageUrl })
      setStatus(index, null)
    } catch {
      setStatus(index, 'error')
    }
  }

  const updatePrompt = (index: number, newPrompt: string) => {
    updateSegmentAtIndex(index, { imagePrompt: newPrompt })
  }

  return {
    generateAll,
    regenerate,
    updatePrompt,
    imageStatuses,
    isLoading
  }
}
