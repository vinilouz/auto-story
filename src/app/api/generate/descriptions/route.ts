import { NextRequest, NextResponse } from "next/server";
import { generateSceneDescriptions } from "@/lib/ai/processors/scene-visualizer";
import type { ExtractedEntity } from "@/lib/ai/processors/entity-extractor";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.segments?.length)
      return NextResponse.json({ error: "Missing segments" }, { status: 400 });

    const result = await generateSceneDescriptions({
      segments: body.segments,
      entities: body.entities as ExtractedEntity[] | undefined,
      language: body.language,
      style: body.style,
      context: body.context,
      commentatorName: body.commentatorName,
      commentatorPersonality: body.commentatorPersonality,
      commentatorImage: body.commentatorImage,
    });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error("Descriptions API Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
