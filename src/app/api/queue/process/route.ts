import { NextResponse } from "next/server";
import { models, providers } from "@/lib/ai/config";
import { generate } from "@/lib/ai/generate";
import type { QueueItem } from "@/lib/ai/queue";
import { readQueue, writeQueue } from "@/lib/ai/queue";
import { canRequest, nextSlotDelay, recordRequest } from "@/lib/ai/router";

export const maxDuration = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processItem(item: QueueItem): Promise<QueueItem> {
  const model = models.find((m) => m.assetType === item.assetType && m.active);
  if (!model) {
    return {
      ...item,
      status: "failed",
      error: `No active model for assetType: ${item.assetType}`,
    };
  }

  const provider = providers[model.providerId];
  if (!provider) {
    return {
      ...item,
      status: "failed",
      error: `Provider not found: ${model.providerId}`,
    };
  }

  if (!canRequest(provider.id)) {
    const delay = nextSlotDelay(provider.id);
    if (delay > 0) {
      await sleep(delay);
    }
  }

  recordRequest(provider.id);

  try {
    const result = await generate({
      prompt: item.prompt,
      model,
      provider,
      params: item.params,
    });

    return {
      ...item,
      status: "completed",
      resolvedModel: model.id,
      result: {
        content: result.content,
        type: result.type,
        raw: result.raw,
      },
    };
  } catch (error) {
    const newAttempts = item.attempts + 1;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (newAttempts >= 3) {
      return {
        ...item,
        status: "failed",
        attempts: newAttempts,
        error: errorMessage,
      };
    }

    return {
      ...item,
      status: "pending",
      attempts: newAttempts,
      error: errorMessage,
    };
  }
}

export async function POST() {
  const items = await readQueue();
  const pending = items.filter(
    (i) => i.status === "pending" || i.status === "processing",
  );

  if (pending.length === 0) {
    return NextResponse.json({
      done: true,
      processed: 0,
      remaining: 0,
    });
  }

  let processed = 0;

  const item = pending[0];
  if (!item) {
    return NextResponse.json({
      done: true,
      processed: 0,
      remaining: 0,
    });
  }

  const itemIndex = items.findIndex((i) => i.id === item.id);
  if (itemIndex === -1) {
    return NextResponse.json({
      done: false,
      processed: 0,
      remaining: pending.length,
    });
  }

  items[itemIndex] = { ...item, status: "processing" };
  await writeQueue(items);

  const processedItem = await processItem(items[itemIndex]);
  items[itemIndex] = processedItem;
  await writeQueue(items);
  processed = 1;

  const finalPending = items.filter(
    (i) => i.status === "pending" || i.status === "processing",
  );

  return NextResponse.json({
    done: finalPending.length === 0,
    processed,
    remaining: finalPending.length,
  });
}
