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

function repairJson(str: string): string {
  let result = str

  result = result.replace(/\s+/g, ' ')

  result = result.replace(/(\w+)":\s*"/g, '"$1": "')
  result = result.replace(/(\w+)":/g, '"$1":')
  result = result.replace(/"(\w+)"\s+\[/g, '"$1": [')
  result = result.replace(/"(\w+)"\s+\{/g, '"$1": {')
  result = result.replace(/"(\w+)"\s+"/g, '"$1": "')

  result = result.replace(/"":\s*\[/g, '"segment": [')

  result = result.replace(/(\d)\s+(\d)/g, '$1, $2')
  result = result.replace(/,\s*,/g, ',')
  result = result.replace(/,\s*\]/g, ']')

  result = result.replace(
    /"description":\s*([^"\[]+?)(\s*"[a-z]+":|\s*}\s*[,]])/gi,
    (_, v, end) => {
      const desc = v.trim().replace(/\s+/g, ' ')
      return `"description": "${desc}"${end}`
    }
  )

  result = result.replace(/\[\s*([^\]]*?)\s*(?="description")/g, (_, arr) => {
    const nums = arr.match(/\d+/g)
    return nums ? `[${nums.join(', ')}]` : '[]'
  })

  return result
}

function wrapIfNeeded(str: string): string {
  const trimmed = str.trim()
  if (trimmed.startsWith('[')) return trimmed
  if (trimmed.startsWith('{')) return `[${trimmed}]`
  return trimmed
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
    clean.match(/(\[[\s\S]*\])/) ||
    clean.match(/```json\s*(\{[\s\S]*\})\s*```/) ||
    clean.match(/(\{[\s\S]*\})/)
  if (m) clean = m[1]

  clean = wrapIfNeeded(clean)
  clean = repairJson(clean)

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
