import { NextRequest, NextResponse } from "next/server";
import { extractEntities } from "@/lib/ai/processors/entity-extractor";

export async function POST(request: NextRequest) {
  try {
    const { segments } = await request.json();
    if (!segments?.length)
      return NextResponse.json({ error: "Missing segments" }, { status: 400 });

    const entities = await extractEntities(segments);
    return NextResponse.json({ entities });
  } catch (e: any) {
    console.error("Extract entities error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
