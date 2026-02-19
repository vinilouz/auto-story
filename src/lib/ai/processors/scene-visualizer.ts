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
}

export interface VisualData {
  visualDescriptions: Array<{ imagePrompt: string }>
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

  const scenesJson = JSON.stringify(data.segments.map((segment, index) => ({
    id: index + 1,
    text: segment.trim()
  })))

  const visualPrompt = SCENE_VISUAL_PROMPT(
    scenesJson,
    data.language || "Portuguese",
    data.style || "Cinematic",
    data.commentatorName,
    data.commentatorPersonality
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


    const visualDescriptions = JSON.parse(cleanResponse)


    if (!Array.isArray(visualDescriptions)) {
      console.error('Response is not an array:', typeof visualDescriptions)
      throw new Error('Response is not an array')
    }

    // Handle both old and new formats
    const validDescriptions = visualDescriptions.map((item, index) => {
      if (item && typeof item.imagePrompt === 'string') {
        return { imagePrompt: item.imagePrompt }
      } else if (item && typeof item === 'string') {
        // Fallback: if AI returns just strings
        return { imagePrompt: item }
      } else {
        console.warn(`Invalid description at index ${index}:`, item)
        return { imagePrompt: `Scene ${index + 1}` } // Fallback description
      }
    }).filter(item => item.imagePrompt)



    if (validDescriptions.length === 0) {
      console.error('No valid descriptions found')
      // Create fallback descriptions
      return {
        segments: data.segments,
        visualDescriptions: data.segments.map((segment, index) => ({
          imagePrompt: `Visual representation of scene: ${segment.substring(0, 100)}...`
        }))
      }
    }


    return {
      segments: data.segments,
      visualDescriptions: validDescriptions
    }
  } catch (error) {
    console.error('Parse error details:', error)
    console.log('AI response that failed to parse:', data.aiResponse)

    // Return fallback descriptions instead of failing
    console.log('Using fallback descriptions')
    return {
      segments: data.segments,
      visualDescriptions: data.segments.map((segment, index) => ({
        imagePrompt: `Scene ${index + 1}: ${segment.substring(0, 100)}...`
      }))
    }
  }
}

export const generateSceneDescriptions = pipe(
  validateSceneData,
  buildVisualPrompt,
  callAIService,
  parseVisualResponse
)