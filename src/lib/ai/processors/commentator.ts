import { pipe } from "@/lib/pipeline"
import { generateText } from "@/lib/ai/providers/custom-client"
import { COMMENTATOR_PROMPT } from "@/lib/ai/prompts/prompts"

export interface CommentatorData {
  commentatorDescription: string
  segments: string[]
}

export interface CommentatorRequest extends CommentatorData {
  commentatorDescription: string
  segments: string[]
}

export interface CommentatorResponse {
  segmentsWithComments: Array<{ type: 'scene_text' | 'comment', content: string }>
}

export interface PromptData extends CommentatorData {
  commentPrompt: string
}

const validateCommentatorData = (data: CommentatorRequest): CommentatorRequest => {
  if (!data.commentatorDescription || typeof data.commentatorDescription !== 'string') {
    console.error('Invalid commentator description:', data.commentatorDescription)
    throw new Error('Commentator description is required and must be a string')
  }
  if (!data.segments || !Array.isArray(data.segments)) {
    console.error('Invalid segments:', data.segments)
    throw new Error('Segments array is required')
  }
  if (data.segments.length === 0) {
    console.error('Empty segments array')
    throw new Error('At least one segment is required')
  }

  console.log('Commentator validation passed')
  return data
}

const buildCommentPrompt = (data: CommentatorRequest): PromptData => {
  console.log('Building comment prompt for segments:', data.segments.length)

  const segmentsJson = JSON.stringify(data.segments.map((segment, index) => ({
    id: index + 1,
    text: segment.trim()
  })))

  const commentPrompt = COMMENTATOR_PROMPT(data.commentatorDescription, segmentsJson)

  console.log('Generated comment prompt length:', commentPrompt.length)

  return {
    commentatorDescription: data.commentatorDescription,
    segments: data.segments,
    commentPrompt
  }
}

const callAIService = async (data: PromptData): Promise<PromptData & { aiResponse: string }> => {
  try {
    const aiResponse = await generateText(data.commentPrompt)

    return {
      ...data,
      aiResponse
    }
  } catch (error) {
    console.error('AI service error:', error)
    throw error
  }
}

const parseCommentResponse = (data: PromptData & { aiResponse: string }): CommentatorResponse => {
  try {
    console.log('Original AI response:', data.aiResponse.substring(0, 500) + '...')

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
    console.log('Extracted JSON:', cleanResponse.substring(0, 200) + '...')

    const segmentsWithComments = JSON.parse(cleanResponse)
    console.log('Parsed segments with comments:', segmentsWithComments)

    if (!Array.isArray(segmentsWithComments)) {
      console.error('Response is not an array:', typeof segmentsWithComments)
      throw new Error('Response is not an array')
    }

    // Validate the format
    const validSegments = segmentsWithComments.map((item, index) => {
      if (item && typeof item === 'object' && item.type && item.content) {
        if (item.type === 'scene_text' || item.type === 'comment') {
          return {
            type: item.type,
            content: String(item.content)
          }
        } else {
          console.warn(`Invalid type at index ${index}:`, item.type)
          // Fallback to scene_text
          return {
            type: 'scene_text',
            content: String(item.content)
          }
        }
      } else {
        console.warn(`Invalid item at index ${index}:`, item)
        // Fallback: treat as scene_text
        return {
          type: 'scene_text',
          content: String(item || '')
        }
      }
    }).filter(item => item.content)

    console.log('Valid segments count:', validSegments.length)

    if (validSegments.length === 0) {
      console.error('No valid segments found')
      // Create fallback: return original segments without comments
      return {
        segmentsWithComments: data.segments.map(segment => ({
          type: 'scene_text',
          content: segment
        }))
      }
    }

    console.log('Successfully parsed comment segments')
    return {
      segmentsWithComments: validSegments
    }
  } catch (error) {
    console.error('Parse error details:', error)
    console.log('AI response that failed to parse:', data.aiResponse)

    // Return fallback: original segments without comments
    console.log('Using fallback: original segments without comments')
    return {
      segmentsWithComments: data.segments.map(segment => ({
        type: 'scene_text',
        content: segment
      }))
    }
  }
}

export const generateCommentsWithCommentator = pipe(
  validateCommentatorData,
  buildCommentPrompt,
  callAIService,
  parseCommentResponse
)