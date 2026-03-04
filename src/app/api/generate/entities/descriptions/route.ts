import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/ai/providers";
import { ENHANCE_ENTITIES_PROMPT } from "@/lib/ai/prompts/prompts";

export async function POST(request: NextRequest) {
  try {
    const { entities, segments } = await request.json();
    if (!entities?.length || !segments?.length)
      return NextResponse.json({ error: "Missing data" }, { status: 400 });

    const { text: raw } = await execute("generateText", {
      prompt: ENHANCE_ENTITIES_PROMPT(segments, "English", entities),
    });

    let clean = raw.trim();
    const m =
      clean.match(/```json\s*((?:\{[\s\S]*?\}|\[[\s\S]*?\]))\s*```/) ||
      clean.match(/((?:\{[\s\S]*?\}|\[[\s\S]*?\]))/);
    if (m) clean = m[1];

    let parsed = JSON.parse(clean);
    if (!Array.isArray(parsed) && typeof parsed === "object") {
      parsed = Object.entries(parsed).map(([name, description]) => ({
        name,
        description,
      }));
    }

    return NextResponse.json({ entities: parsed });
  } catch (e: any) {
    console.error("Enhance entities error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
