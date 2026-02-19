import { NextRequest, NextResponse } from "next/server"
import { generateCommentsWithCommentator } from "@/lib/ai/processors/commentator"

interface CommentatorRequest {
  commentatorDescription: string
  segments: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body: CommentatorRequest = await request.json()

    if (!body.commentatorDescription || !body.segments || !Array.isArray(body.segments) || body.segments.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: commentatorDescription and segments (array)" },
        { status: 400 }
      )
    }

    const result = await generateCommentsWithCommentator({
      commentatorDescription: body.commentatorDescription,
      segments: body.segments
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Commentator API Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}