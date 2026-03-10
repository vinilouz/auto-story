import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Canonical slug — SINGLE SOURCE OF TRUTH.
 * Every module that needs a filesystem-safe name MUST use this.
 */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 40)
}

/**
 * Canonical project directory name.
 * Format: `{slug}-{shortId}`
 * Used by: storage, audio, video, render — NEVER compute this inline.
 */
export function getProjectDirName(projectId: string, projectName: string): string {
  const slug = slugify(projectName) || 'untitled'
  const shortId = projectId.split('-')[0] || projectId.substring(0, 8)
  return `${slug}-${shortId}`
}