import { NextRequest, NextResponse } from "next/server";
import { splitText } from "@/lib/text-segmentation";

export async function POST(request: NextRequest) {
  try {
    const { text, segmentLength } = await request.json();
    if (!text || !segmentLength)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    return NextResponse.json({ segments: splitText(text, segmentLength) });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
