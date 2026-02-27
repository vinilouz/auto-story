import { useState, useCallback } from "react"
import { Segment } from "./types"
import pLimit from "p-limit"
import { GENERATE_VIDEO_PROMPT } from "@/lib/ai/prompts/prompts"

type ClipStatus = 'pending' | 'generating' | 'completed' | 'error'

const executeGeneration = async (
  prompt: string,
  referenceImageUrl: string,
  config: { modelId: string; projectId?: string | null; projectName?: string }
) => {
  const enhancedPrompt = GENERATE_VIDEO_PROMPT(prompt)

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('/api/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          referenceImageUrl,
          modelId: config.modelId,
          projectId: config.projectId,
          projectName: config.projectName
        })
      })

      if (!res.ok) throw new Error('Video generation failed')
      return await res.json()
    } catch (error) {
      if (attempt === 2) throw error
      await new Promise(r => setTimeout(r, 2000))
    }
  }
}

export function useVideoClipGeneration(
  segments: Segment[],
  setSegments: React.Dispatch<React.SetStateAction<Segment[]>>
) {
  const [clipStatuses, setClipStatuses] = useState<Map<number, ClipStatus>>(new Map())
  const [isLoading, setIsLoading] = useState(false)

  const generateAll = async (
    config: {
      modelId: string
      projectId?: string | null
      projectName?: string
    },
    onUpdate?: (newSegments: Segment[]) => void
  ) => {
    setIsLoading(true)

    const indices = segments
      .map((seg, i) => (!seg.videoPath ? i : -1))
      .filter(i => i !== -1)

    const limit = pLimit(config.modelId === 'veo-3.1-fast' ? 2 : 10)
    let currentSegments = [...segments]

    const promises = indices.map(idx => limit(async () => {
      const seg = segments[idx]
      if (!seg.imagePath) return

      setClipStatuses(prev => new Map(prev).set(idx, 'generating'))

      try {
        const data = await executeGeneration(
          seg.imagePrompt || seg.text,
          seg.imagePath,
          config
        )

        setSegments(prev => {
          const next = prev.map((s, i) =>
            i === idx ? { ...s, videoPath: data.videoUrl } : s
          )
          currentSegments = next
          return next
        })
        setClipStatuses(prev => new Map(prev).set(idx, 'completed'))
      } catch (error) {
        console.error(`Video clip generation error for segment ${idx}:`, error)
        setClipStatuses(prev => new Map(prev).set(idx, 'error'))
      }
    }))

    await Promise.all(promises)
    setIsLoading(false)
    if (onUpdate) {
      onUpdate(currentSegments)
    }
  }

  const regenerate = useCallback(async (
    index: number,
    config: { modelId: string; projectId?: string | null; projectName?: string },
    onUpdate?: (newSegments: Segment[]) => void
  ) => {
    const seg = segments[index]
    if (!seg?.imagePath) return

    setClipStatuses(prev => new Map(prev).set(index, 'generating'))

    try {
      const data = await executeGeneration(
        seg.imagePrompt || seg.text,
        seg.imagePath,
        config
      )

      setSegments(prev => {
        const next = prev.map((s, i) =>
          i === index ? { ...s, videoPath: data.videoUrl } : s
        )
        if (onUpdate) onUpdate(next)
        return next
      })
      setClipStatuses(prev => new Map(prev).set(index, 'completed'))
    } catch (error) {
      console.error(`Video clip regeneration error for segment ${index}:`, error)
      setClipStatuses(prev => new Map(prev).set(index, 'error'))
    }
  }, [segments, setSegments])

  return {
    clipStatuses,
    generateAll,
    regenerate,
    isLoading
  }
}
