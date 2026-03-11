import { type NextRequest, NextResponse } from "next/server";
import { extractEntities } from "@/lib/ai/processors/entity-extractor";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/entities");

export async function POST(request: NextRequest) {
  try {
    const { segments } = await request.json();

    if (!segments?.length) {
      return NextResponse.json({ error: "Missing segments" }, { status: 400 });
    }

    log.info(`Entity extraction request: ${segments.length} segments`);
    const entities = await extractEntities(segments);
    log.success(`Extracted ${entities.length} entities`);

    return NextResponse.json({ entities });
  } catch (e: any) {
    log.error("Entity extraction failed", e);
    return NextResponse.json(
      { error: e.message || "Internal error" },
      { status: 500 },
    );
  }
}
