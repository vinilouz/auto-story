import { NextRequest, NextResponse } from "next/server";
import { generateSceneDescriptions } from "@/lib/ai/processors/scene-visualizer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.segments?.length)
      return NextResponse.json({ error: "Missing segments" }, { status: 400 });
    return NextResponse.json(await generateSceneDescriptions(body));
  } catch (e: any) {
    console.error("Descriptions API Error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
