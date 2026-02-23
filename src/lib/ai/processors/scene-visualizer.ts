import { pipe } from "@/lib/pipeline"
import { generateText } from "@/lib/ai/providers/custom-client"
import { SCENE_VISUAL_PROMPT } from "@/lib/ai/prompts/prompts"

export interface SceneData {
  segments: string[]
  context?: 'story' | 'commentator'
  commentatorImage?: string
  commentatorName?: string
  commentatorPersonality?: string
  language?: string
  style?: string
  consistency?: boolean
}

export interface VisualData {
  visualDescriptions: Array<{ imagePrompt: string }>
  entities?: string[]
}

export interface SceneVisualizationRequest extends SceneData {
  segments: string[]
  context?: 'story' | 'commentator'
  commentatorImage?: string
  language?: string
  style?: string
}

export interface SceneVisualizationResponse extends SceneData, VisualData { }

export interface PromptData extends SceneData {
  visualPrompt: string
  context?: 'story' | 'commentator'
  commentatorImage?: string
  language?: string
  style?: string
}

const validateSceneData = (data: SceneVisualizationRequest): SceneVisualizationRequest => {
  if (!data.segments || !Array.isArray(data.segments)) {
    console.error('Invalid segments:', data.segments)
    throw new Error('Segments array is required')
  }
  if (data.segments.length === 0) {
    console.error('Empty segments array')
    throw new Error('At least one segment is required')
  }


  return data
}

const buildVisualPrompt = (data: SceneVisualizationRequest): PromptData => {

  const segmentsForPrompt = data.segments.map((segment, index) => ({
    id: String(index + 1),
    scriptText: segment.trim()
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

    return {
      ...data,
      aiResponse
    }
  } catch (error) {
    console.error('AI service error:', error)
    throw error
  }
}

const parseVisualResponse = (data: PromptData & { aiResponse: string }): SceneVisualizationResponse => {
  try {


    let cleanResponse = data.aiResponse.trim()

    // Try to extract JSON from response
    const jsonMatch = cleanResponse.match(/```json\s*(\[[\s\S]*?\])\s*```/)
    if (jsonMatch) {
      cleanResponse = jsonMatch[1]
    } else {
      // Fallback: try to find array in response
      const arrayMatch = cleanResponse.match(/\[[\s\S]*?\]/)
      if (arrayMatch) {
        cleanResponse = arrayMatch[0]
      }
    }

    cleanResponse = cleanResponse.trim()
    const parsedData = JSON.parse(cleanResponse)

    let visualDescriptions: any = parsedData
    let entities: string[] | undefined = undefined

    if (!Array.isArray(visualDescriptions)) {
      if (visualDescriptions && visualDescriptions.visualDescriptions) {
        // Handle case where AI still returns the old format by mistake
        visualDescriptions = visualDescriptions.visualDescriptions
      } else {
        console.error('Visual descriptions is not an array:', typeof visualDescriptions)
        throw new Error('Visual descriptions is not an array')
      }
    }

    // Handle both old and new formats
    const validDescriptions = visualDescriptions.map((item: any, index: number) => {
      if (item && typeof item.imagePrompt === 'string') {
        return { imagePrompt: item.imagePrompt }
      } else if (item && typeof item === 'string') {
        // Fallback: if AI returns just strings
        return { imagePrompt: item }
      } else {
        console.warn(`Invalid description at index ${index}:`, item)
        throw new Error(`Invalid description format at index ${index}`)
      }
    })

    if (data.consistency && validDescriptions.length > 0) {
      const extractedEntities = new Set<string>()
      validDescriptions.forEach((desc: any) => {
        const matches = desc.imagePrompt.match(/<<([^>]+)>>/g)
        if (matches) {
          matches.forEach((m: string) => extractedEntities.add(m.replace(/<<|>>/g, '')))
        }
      })
      entities = Array.from(extractedEntities)
    }

    if (validDescriptions.length === 0) {
      console.error('No valid descriptions found')
      throw new Error('No valid descriptions found in AI response')
    }

    return {
      segments: data.segments,
      visualDescriptions: validDescriptions,
      ...(entities ? { entities } : {})
    }
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