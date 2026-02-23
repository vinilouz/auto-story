import { NextRequest, NextResponse } from "next/server"
import { generateText } from "@/lib/ai/providers/custom-client"

import { ENHANCE_ENTITIES_PROMPT } from "@/lib/ai/prompts/prompts"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { entities, segments } = body

    if (!entities || !Array.isArray(entities) || entities.length === 0) {
      return NextResponse.json({ error: "No entities provided" }, { status: 400 })
    }
    if (!segments || !Array.isArray(segments)) {
      return NextResponse.json({ error: "No segments provided" }, { status: 400 })
    }

    const prompt = ENHANCE_ENTITIES_PROMPT(segments, "English", entities)
    const aiResponse = await generateText(prompt)

    let cleanResponse = aiResponse.trim()
    const jsonMatch = cleanResponse.match(/```json\s*((?:\{[\s\S]*?\}|\[[\s\S]*?\]))\s*```/)
    if (jsonMatch) {
      cleanResponse = jsonMatch[1]
    } else {
      const objOrArrayMatch = cleanResponse.match(/(?:\{[\s\S]*?\}|\[[\s\S]*?\])/)
      if (objOrArrayMatch) {
        cleanResponse = objOrArrayMatch[0]
      }
    }

    let parsedEntities = JSON.parse(cleanResponse)

    // Convert Record<string, string> back to [{name, description}] array
    if (!Array.isArray(parsedEntities) && typeof parsedEntities === 'object') {
      parsedEntities = Object.entries(parsedEntities).map(([name, description]) => ({
        name,
        description
      }))
    }

    return NextResponse.json({ entities: parsedEntities })
  } catch (error: any) {
    console.error("Enhance entities error:", error)
    return NextResponse.json(
      { error: "Failed to generate entity descriptions", details: error.message },
      { status: 500 }
    )
  }
}
