import { SCENE_VISUAL_PROMPT } from '@/lib/ai/prompts/prompts'
import { execute } from '@/lib/ai/providers'
import { createLogger } from '@/lib/logger'
import type { Segment } from '@/lib/flows/types'

const log = createLogger('visualizer')

export interface SceneVisualizationRequest {
  segments: Segment[]
  language?: string
  style?: string
  consistency?: boolean
  commentatorName?: string
  commentatorPersonality?: string
}

export async function generateSceneDescriptions(data: SceneVisualizationRequest) {
  if (!data.segments?.length) throw new Error('No segments')

  const prompt = SCENE_VISUAL_PROMPT(
    data.segments.map((s, i) => ({ id: String(i + 1), scriptText: s.text.trim() })),
    data.language || 'Portuguese',
  )

  log.info(`Generating descriptions for ${data.segments.length} segments`)
  const { text: raw } = await execute('generateText', { prompt })

  let clean = raw.trim()
  const m = clean.match(/```json\s*(\[[\s\S]*?\])\s*```/) || clean.match(/(\[[\s\S]*?\])/)
  if (m) clean = m[1]

  let parsed: any
  try {
    parsed = JSON.parse(clean.trim())
  } catch (e) {
    log.error('Failed to parse AI response as JSON', raw.substring(0, 500))
    throw new Error(`Invalid JSON from AI: ${(e as Error).message}`)
  }

  const descriptions = Array.isArray(parsed) ? parsed : parsed.visualDescriptions
  if (!Array.isArray(descriptions)) {
    log.error('Response is not an array', raw.substring(0, 500))
    throw new Error('Response not an array')
  }

  const segments: Segment[] = data.segments.map((seg, i) => {
    const desc = descriptions[i]
    const imagePrompt = typeof desc?.imagePrompt === 'string'
      ? desc.imagePrompt
      : typeof desc === 'string' ? desc : null

    if (!imagePrompt) {
      log.error(`Bad description at index ${i}`, desc)
      throw new Error(`Bad description at index ${i}: ${JSON.stringify(desc).substring(0, 200)}`)
    }
    return { ...seg, imagePrompt }
  })

  let entities: string[] | undefined
  if (data.consistency) {
    const set = new Set<string>()
    for (const s of segments) {
      const matches = s.imagePrompt?.match(/<<([^>]+)>>/g)
      if (matches) matches.forEach(m => set.add(m.replace(/<<|>>/g, '')))
    }
    if (set.size > 0) entities = Array.from(set)
  }

  log.success(`Generated ${segments.length} descriptions${entities ? `, ${entities.length} entities` : ''}`)
  return { segments, ...(entities ? { entities } : {}) }
}