import { NextRequest, NextResponse } from "next/server";
import { generateAudio } from "@/lib/ai/processors/audio-generator";

export async function POST(request: NextRequest) {
  try {
    const {
      text,
      voice,
      systemPrompt,
      targetBatchIndices,
      projectId,
      projectName,
    } = await request.json();
    if (!text)
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    const result = await generateAudio({
      text,
      voice,
      systemPrompt,
      targetBatchIndices,
      projectId: projectId || "temp",
      projectName: projectName || "untitled",
    });
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("Audio API Error:", e);
    return NextResponse.json(
      { error: e.message || "Internal error" },
      { status: 500 },
    );
  }
}
