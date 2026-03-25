import * as fs from "node:fs";
import type { VideoScene } from "../types";
import { getKenBurnsTransform } from "./effects";

const imageCache = new Map<string, ImageBitmap>();

async function loadImageLocal(filePath: string): Promise<ImageBitmap> {
  if (imageCache.has(filePath)) return imageCache.get(filePath)!;

  const buffer = fs.readFileSync(filePath);
  const blob = new Blob([buffer]);
  const bitmap = await createImageBitmap(blob);
  imageCache.set(filePath, bitmap);
  return bitmap;
}

export function findActiveScene(
  scenes: VideoScene[],
  frame: number,
): VideoScene | null {
  for (const scene of scenes) {
    const sceneEnd = scene.startFrame + scene.durationInFrames;
    if (frame >= scene.startFrame && frame < sceneEnd) {
      return scene;
    }
  }
  return null;
}

export async function renderScene(
  ctx: OffscreenCanvasRenderingContext2D,
  scene: VideoScene,
  frame: number,
): Promise<void> {
  const image = await loadImageLocal(scene.imageUrl);

  const sceneFrame = frame - scene.startFrame;
  const progress = sceneFrame / scene.durationInFrames;

  const transform = getKenBurnsTransform(
    scene.effect ?? "static",
    progress,
    ctx.canvas.width,
  );

  ctx.save();
  ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
  ctx.scale(transform.scale, transform.scale);
  ctx.translate(transform.x, transform.y);

  const scale = Math.max(
    ctx.canvas.width / image.width,
    ctx.canvas.height / image.height,
  );
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;

  ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

  ctx.restore();
}
