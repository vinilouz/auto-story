import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Canonical slug — SINGLE SOURCE OF TRUTH.
 * Every module that needs a filesystem-safe name MUST use this.
 */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 40);
}

/**
 * Canonical project directory name.
 * Format: `{slug}-{shortId}`
 * Used by: storage, audio, video, render — NEVER compute this inline.
 */
function generateRandomHash(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

export function generateProjectId(name?: string): { id: string; slug: string } {
  const uid = crypto.randomUUID().split("-")[0];
  const slug = name ? slugify(name) || "untitled" : generateRandomHash(8);
  return { id: `${slug}-${uid}`, slug };
}
