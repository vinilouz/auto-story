import { pipe } from "@/lib/pipeline"
import { generateText } from "@/lib/ai/providers/custom-client"
import { COMMENTATOR_PROMPT } from "@/lib/ai/prompts/prompts"
import { Segment } from "@/lib/flows/types"

export interface CommentatorData {
  commentatorDescription: string
  segments: string[]
}

export interface CommentatorRequest extends CommentatorData {
  commentatorDescription: string
  segments: string[]
}

export interface CommentatorResponse {
  segments: Segment[]
}

interface PromptData extends CommentatorData {
  commentPrompt: string
}

const validateCommentatorData = (data: CommentatorRequest): CommentatorRequest => {
  if (!data.commentatorDescription || typeof data.commentatorDescription !== 'string') {
    throw new Error('Commentator description is required and must be a string')
  }
  if (!data.segments || !Array.isArray(data.segments)) {
    throw new Error('Segments array is required')
  }
  if (data.segments.length === 0) {
    throw new Error('At least one segment is required')
  }
  return data
}

const buildCommentPrompt = (data: CommentatorRequest): PromptData => {
  const segmentsJson = JSON.stringify(data.segments.map((segment, index) => ({
    id: index + 1,
    text: segment.trim()
  })))

  const commentPrompt = COMMENTATOR_PROMPT(data.commentatorDescription, segmentsJson)

  return {
    commentatorDescription: data.commentatorDescription,
    segments: data.segments,
    commentPrompt
  }
}

const callAIService = async (data: PromptData): Promise<PromptData & { aiResponse: string }> => {
  try {
    const aiResponse = await generateText(data.commentPrompt)
    return { ...data, aiResponse }
  } catch (error) {
    console.error('AI service error:', error)
    throw error
  }
}

const parseCommentResponse = (data: PromptData & { aiResponse: string }): CommentatorResponse => {
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
    const parsed = JSON.parse(cleanResponse)

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array')
    }

    const segments: Segment[] = parsed.map((item: any, index: number) => {
      if (item && typeof item === 'object' && item.type && item.content) {
        const type = (item.type === 'scene_text' || item.type === 'comment') ? item.type : 'scene_text'
        return { text: String(item.content), type } as Segment
      }
      return { text: String(item || ''), type: 'scene_text' } as Segment
    }).filter((s: Segment) => s.text)

    if (segments.length === 0) {
      return {
        segments: data.segments.map(text => ({ text, type: 'scene_text' } as Segment))
      }
    }

    return { segments }
  } catch (error) {
    console.error('Parse error:', error)
    return {
      segments: data.segments.map(text => ({ text, type: 'scene_text' } as Segment))
    }
  }
}

export const generateCommentsWithCommentator = pipe(
  validateCommentatorData,
  buildCommentPrompt,
  callAIService,
  parseCommentResponse
)