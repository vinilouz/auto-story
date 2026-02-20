import { useState, useCallback } from "react"
import { VisualDescription } from "./types"

interface ImageGenerationConfig {
  systemPrompt: string
  referenceImage?: string
  buildPrompt?: (originalPrompt: string) => string
}

export function useImageGeneration(
  descriptions: VisualDescription[],
  setDescriptions: React.Dispatch<React.SetStateAction<VisualDescription[]>>,
  config: ImageGenerationConfig
) {
  const [isLoading, setIsLoading] = useState(false)

  const updateAtIndex = useCallback((index: number, updates: Partial<VisualDescription>) => {
    setDescriptions(prev => {
      const next = [...prev]
      if (next[index]) {
        next[index] = { ...next[index], ...updates }
      }
      return next
    })
  }, [setDescriptions])

  const generateAll = async () => {
    setIsLoading(true)

    const promises = descriptions.map(async (desc, index) => {
      if (desc.status === 'completed' && desc.imageUrl) return

      updateAtIndex(index, { status: 'generating' })

      try {
        const finalPrompt = config.buildPrompt
          ? config.buildPrompt(desc.imagePrompt)
          : desc.imagePrompt

        const res = await fetch('/api/generate/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imagePrompt: finalPrompt,
            referenceImage: config.referenceImage,
            imageConfig: { aspect_ratio: "16:9" },
            systemPrompt: config.systemPrompt
          })
        })

        if (!res.ok) throw new Error('Failed to generate image')
        const data = await res.json()
        updateAtIndex(index, { imageUrl: data.imageUrl, status: 'completed' })
      } catch {
        updateAtIndex(index, { status: 'error' })
      }
    })

    await Promise.all(promises)
    setIsLoading(false)
  }

  const regenerate = async (index: number) => {
    const desc = descriptions[index]
    if (!desc) return

    updateAtIndex(index, { status: 'generating' })

    try {
      const finalPrompt = config.buildPrompt
        ? config.buildPrompt(desc.imagePrompt)
        : desc.imagePrompt

      const res = await fetch('/api/generate/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePrompt: finalPrompt,
          referenceImage: config.referenceImage,
          imageConfig: { aspect_ratio: "16:9" },
          systemPrompt: config.systemPrompt
        })
      })

      if (!res.ok) throw new Error('Failed to regenerate image')
      const data = await res.json()
      updateAtIndex(index, { imageUrl: data.imageUrl, status: 'completed' })
    } catch {
      updateAtIndex(index, { status: 'error' })
    }
  }

  const updatePrompt = (index: number, newPrompt: string) => {
    updateAtIndex(index, { imagePrompt: newPrompt })
  }

  return {
    generateAll,
    regenerate,
    updatePrompt,
    isLoading
  }
}
