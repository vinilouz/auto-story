import { existsSync, mkdirSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AssetType } from "./config";

export type QueueStatus = "pending" | "processing" | "completed" | "failed";

export interface QueueItem {
  id: string;
  assetType: AssetType;
  prompt: string;
  params: Record<string, unknown>;
  status: QueueStatus;
  resolvedModel?: string;
  result?: Record<string, unknown>;
  attempts: number;
  error?: string;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const QUEUE_FILE = path.join(DATA_DIR, "queue.json");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

export async function readQueue(): Promise<QueueItem[]> {
  try {
    if (!existsSync(QUEUE_FILE)) {
      return [];
    }
    const data = await fs.readFile(QUEUE_FILE, "utf-8");
    return JSON.parse(data) as QueueItem[];
  } catch {
    return [];
  }
}

export async function writeQueue(items: QueueItem[]): Promise<void> {
  await fs.writeFile(QUEUE_FILE, JSON.stringify(items, null, 2));
}

export async function enqueue(
  assetType: AssetType,
  prompt: string,
  params: Record<string, unknown> = {},
): Promise<QueueItem> {
  const items = await readQueue();
  const item: QueueItem = {
    id: crypto.randomUUID(),
    assetType,
    prompt,
    params,
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  items.push(item);
  await writeQueue(items);
  return item;
}
