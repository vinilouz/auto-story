import { pipe } from "@/lib/pipeline"
import { generateText } from "@/lib/ai/providers/custom-client"
import { SCENE_VISUAL_PROMPT } from "@/lib/ai/prompts/prompts"
import { Segment } from "@/lib/flows/types"

export interface SceneData {
  segments: Segment[]
  context?: 'story' | 'commentator'
  commentatorImage?: string
  commentatorName?: string
  commentatorPersonality?: string
  language?: string
  style?: string
  consistency?: boolean
}

export interface SceneVisualizationRequest extends SceneData {
  segments: Segment[]
}

export interface SceneVisualizationResponse {
  segments: Segment[]
  entities?: string[]
}

interface PromptData extends SceneData {
  visualPrompt: string
}

const validateSceneData = (data: SceneVisualizationRequest): SceneVisualizationRequest => {
  if (!data.segments || !Array.isArray(data.segments)) {
    throw new Error('Segments array is required')
  }
  if (data.segments.length === 0) {
    throw new Error('At least one segment is required')
  }
  return data
}

const buildVisualPrompt = (data: SceneVisualizationRequest): PromptData => {
  const segmentsForPrompt = data.segments.map((segment, index) => ({
    id: String(index + 1),
    scriptText: segment.text.trim()
  }))

  const visualPrompt = SCENE_VISUAL_PROMPT(
    segmentsForPrompt,
    data.language || "Portuguese"
  )

  return {
    segments: data.segments,
    visualPrompt,
    context: data.context,
    commentatorImage: data.commentatorImage,
    commentatorName: data.commentatorName,
    commentatorPersonality: data.commentatorPersonality,
    language: data.language,
    style: data.style
  }
}

const callAIService = async (data: PromptData): Promise<PromptData & { aiResponse: string }> => {
  try {
    const aiResponse = await generateText(data.visualPrompt)
    return { ...data, aiResponse }
  } catch (error) {
    console.error('AI service error:', error)
    throw error
  }
}

const parseVisualResponse = (data: PromptData & { aiResponse: string }): SceneVisualizationResponse => {
  try {
    let cleanResponse = data.aiResponse.trim()

    const jsonMatch = cleanResponse.match(/```json\s*(\[[\s\S]*?\])\s*```/)
    if (jsonMatch) {
      cleanResponse = jsonMatch[1]
    } else {
      const arrayMatch = cleanResponse.match(/\[[\s\S]*?\]/)
      if (arrayMatch) {
        cleanResponse = arrayMatch[0]
      }
    }

    cleanResponse = cleanResponse.trim()
    const parsedData = JSON.parse(cleanResponse)

    let descriptions: any = parsedData

    if (!Array.isArray(descriptions)) {
      if (descriptions && descriptions.visualDescriptions) {
        descriptions = descriptions.visualDescriptions
      } else {
        throw new Error('Visual descriptions is not an array')
      }
    }

    const updatedSegments: Segment[] = data.segments.map((seg, index) => {
      const desc = descriptions[index]
      const imagePrompt = desc && typeof desc.imagePrompt === 'string'
        ? desc.imagePrompt
        : typeof desc === 'string'
          ? desc
          : undefined

      if (!imagePrompt) {
        throw new Error(`Invalid description format at index ${index}`)
      }

      return { ...seg, imagePrompt }
    })

    let entities: string[] | undefined = undefined
    if (data.consistency && updatedSegments.length > 0) {
      const extractedEntities = new Set<string>()
      updatedSegments.forEach(seg => {
        const matches = seg.imagePrompt?.match(/<<([^>]+)>>/g)
        if (matches) {
          matches.forEach(m => extractedEntities.add(m.replace(/<<|>>/g, '')))
        }
      })
      entities = Array.from(extractedEntities)
    }

    return { segments: updatedSegments, ...(entities ? { entities } : {}) }
  } catch (error) {
    console.error('Parse error details:', error)
    console.log('AI response that failed to parse:', data.aiResponse)
    throw new Error('Failed to parse AI response into valid JSON: ' + (error instanceof Error ? error.message : String(error)))
  }
}

export const generateSceneDescriptions = pipe(
  validateSceneData,
  buildVisualPrompt,
  callAIService,
  parseVisualResponse
)