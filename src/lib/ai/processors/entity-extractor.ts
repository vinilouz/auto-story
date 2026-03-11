import { EXTRACT_ENTITIES_PROMPT } from '@/lib/ai/prompts/prompts'
import { execute } from '@/lib/ai/providers'
import { createLogger } from '@/lib/logger'
import type { Segment } from '@/lib/flows/types'

const log = createLogger('entity-extractor')

export interface ExtractedEntity {
  type: string
  segment: number[]
  description: string
}

export async function extractEntities(segments: Segment[]): Promise<ExtractedEntity[]> {
  if (!segments?.length) throw new Error('No segments')

  log.info(`Extracting entities from ${segments.length} segments`)

  const { text: raw } = await execute('generateText', {
    prompt: EXTRACT_ENTITIES_PROMPT(
      segments.map((s, i) => ({ id: i + 1, text: s.text }))
    ),
  })

  let clean = raw.trim()
  const m =
    clean.match(/```json\s*(\[[\s\S]*\])\s*```/) ||
    clean.match(/(\[[\s\S]*\])/)
  if (m) clean = m[1]

  clean = clean
    .replace(/"(\w+)\s+\[/g, '"$1": [')
    .replace(/"(\w+)\s+\{/g, '"$1": {')

  let parsed: any
  try {
    parsed = JSON.parse(clean.trim())
  } catch (e) {
    log.error('Failed to parse entity extraction response', raw.substring(0, 500))
    throw new Error(`Invalid JSON from AI: ${(e as Error).message}`)
  }

  if (!Array.isArray(parsed)) {
    log.error('Response is not an array', raw.substring(0, 500))
    throw new Error('Response not an array')
  }

  log.success(`Extracted ${parsed.length} entities: ${parsed.map((e: any) => e.type).join(', ')}`)
  return parsed
}