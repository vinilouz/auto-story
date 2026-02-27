import { useState, useCallback } from "react"
import { AudioBatch, VoiceConfig } from "./types"

interface SingleVoiceConfig {
  type: 'single'
  getText: () => string
  voice: string
  projectId: string
  projectName: string
}

interface MultiVoiceConfig {
  type: 'multi'
  getText: () => string
  voices: VoiceConfig
  systemPrompt?: string
  projectId: string
  projectName: string
}

type AudioGenerationConfig = SingleVoiceConfig | MultiVoiceConfig

export function useAudioGeneration(config: AudioGenerationConfig) {
  const [batches, setBatches] = useState<AudioBatch[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const generate = async (overrideConfig?: { projectId?: string | null, projectName?: string }) => {

    setIsLoading(true)

    try {
      let payload: Record<string, unknown>

      if (config.type === 'single') {
        payload = {
          text: config.getText(),
          voice: config.voice,
          projectId: overrideConfig?.projectId || config.projectId,
          projectName: overrideConfig?.projectName || config.projectName
        }
      } else {
        payload = {
          text: config.getText(),
          systemPrompt: config.systemPrompt,
          voices: [
            { speaker: 'narrator', voice: config.voices.narrator },
            { speaker: 'commentator', voice: config.voices.commentator }
          ],
          projectId: overrideConfig?.projectId || config.projectId,
          projectName: overrideConfig?.projectName || config.projectName
        }
      }

      const res = await fetch('/api/generate/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error('Failed to generate audio')
      const data = await res.json()

      if (data.batches) {
        setBatches(data.batches)
      }

      return data.batches
    } catch (error) {
      console.error('Audio generation error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const regenerateBatch = useCallback(async (index: number, expectedBatches?: string[], overrideConfig?: { projectId?: string | null, projectName?: string }) => {
    setBatches(prev => {
      const exists = prev.find(b => b.index === index)
      if (exists) {
        return prev.map(b => b.index === index
          ? { ...b, status: 'generating' as const, error: undefined }
          : b
        )
      }
      return [...prev, {
        index,
        text: expectedBatches?.[index] || "",
        status: 'generating' as const
      }]
    })

    try {
      let payload: Record<string, unknown>

      if (config.type === 'single') {
        payload = {
          text: config.getText(),
          voice: config.voice,
          targetBatchIndices: [index],
          projectId: overrideConfig?.projectId || config.projectId,
          projectName: overrideConfig?.projectName || config.projectName
        }
      } else {
        payload = {
          text: config.getText(),
          systemPrompt: config.systemPrompt,
          voices: [
            { speaker: 'narrator', voice: config.voices.narrator },
            { speaker: 'commentator', voice: config.voices.commentator }
          ],
          targetBatchIndices: [index],
          projectId: overrideConfig?.projectId || config.projectId,
          projectName: overrideConfig?.projectName || config.projectName
        }
      }

      const res = await fetch('/api/generate/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error('Audio regeneration failed')
      const data = await res.json()

      if (data.batches) {
        const updatedBatch = data.batches.find((b: AudioBatch) => b.index === index)
        if (updatedBatch) {
          setBatches(prev => prev.map(b => b.index === index ? updatedBatch : b))
        }
        return data.batches
      }
    } catch (error) {
      console.error('Batch regeneration error:', error)
      setBatches(prev => prev.map(b =>
        b.index === index
          ? { ...b, status: 'error' as const, error: 'Failed to regenerate' }
          : b
      ))
    }
  }, [config])

  const setBatchesDirect = useCallback((newBatches: AudioBatch[]) => {
    setBatches(newBatches)
  }, [])

  return {
    batches,
    setBatches: setBatchesDirect,
    generate,
    regenerateBatch,
    isLoading
  }
}
