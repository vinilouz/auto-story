import type { AssetType, Model } from "./config";
import { models, providers } from "./config";

const requestTimestamps: Map<string, number[]> = new Map();

const WINDOW_MS = 60_000;

function getTimestamps(providerId: string): number[] {
  return requestTimestamps.get(providerId) ?? [];
}

function cleanExpiredTimestamps(providerId: string, now: number): void {
  const timestamps = getTimestamps(providerId);
  const valid = timestamps.filter((ts) => now - ts < WINDOW_MS);
  requestTimestamps.set(providerId, valid);
}

export function canRequest(providerId: string): boolean {
  const provider = providers[providerId];
  if (!provider || !provider.active) {
    return false;
  }
  const now = Date.now();
  cleanExpiredTimestamps(providerId, now);
  const timestamps = getTimestamps(providerId);
  return timestamps.length < provider.rpm;
}

export function recordRequest(providerId: string): void {
  const now = Date.now();
  cleanExpiredTimestamps(providerId, now);
  const timestamps = getTimestamps(providerId);
  timestamps.push(now);
  requestTimestamps.set(providerId, timestamps);
}

export function resolveModel(assetType: AssetType): Model | null {
  const now = Date.now();

  for (const model of models) {
    if (model.assetType !== assetType) continue;
    if (!model.active) continue;

    const provider = providers[model.providerId];
    if (!provider || !provider.active) continue;

    cleanExpiredTimestamps(provider.id, now);
    const timestamps = getTimestamps(provider.id);
    if (timestamps.length < provider.rpm) {
      return model;
    }
  }

  return null;
}

export function nextSlotDelay(providerId: string): number {
  const provider = providers[providerId];
  if (!provider) {
    return 0;
  }

  const now = Date.now();
  cleanExpiredTimestamps(providerId, now);
  const timestamps = getTimestamps(providerId);

  if (timestamps.length < provider.rpm) {
    return 0;
  }

  const oldest = Math.min(...timestamps);
  const elapsed = now - oldest;
  const delay = WINDOW_MS - elapsed;
  return Math.max(0, delay);
}
