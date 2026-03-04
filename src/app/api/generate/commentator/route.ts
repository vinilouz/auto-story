import { NextRequest, NextResponse } from "next/server";
import { generateCommentsWithCommentator } from "@/lib/ai/processors/commentator";

export async function POST(request: NextRequest) {
  try {
    const { commentatorDescription, segments } = await request.json();
    if (!commentatorDescription || !segments?.length)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    return NextResponse.json(
      await generateCommentsWithCommentator({
        commentatorDescription,
        segments,
      }),
    );
  } catch (e: any) {
    console.error("Commentator API Error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
