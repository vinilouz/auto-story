import { type NextRequest, NextResponse } from "next/server";
import { generateCommentsWithCommentator } from "@/lib/ai/processors/commentator";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/commentator");

export async function POST(request: NextRequest) {
  try {
    const { commentatorDescription, segments } = await request.json();

    if (!commentatorDescription || !segments?.length) {
      return NextResponse.json(
        { error: "Missing commentatorDescription or segments" },
        { status: 400 },
      );
    }

    log.info(`Commentator request: ${segments.length} segments`);
    const result = await generateCommentsWithCommentator({
      commentatorDescription,
      segments,
    });
    log.success(`Commentator done: ${result.segments.length} segments`);

    return NextResponse.json(result);
  } catch (e: any) {
    log.error("Commentator failed", e);
    return NextResponse.json(
      { error: e.message || "Internal error" },
      { status: 500 },
    );
  }
}
