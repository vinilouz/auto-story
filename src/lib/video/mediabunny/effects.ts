import type { SceneEffect } from "../types";

interface KenBurnsTransform {
  scale: number;
  x: number;
  y: number;
}

export function getKenBurnsTransform(
  effect: SceneEffect,
  progress: number,
  canvasWidth: number,
): KenBurnsTransform {
  switch (effect) {
    case "zoom-in":
      return { scale: 1 + progress * 0.15, x: 0, y: 0 };
    case "zoom-out":
      return { scale: 1.15 - progress * 0.15, x: 0, y: 0 };
    case "pan-left":
      return { scale: 1.1, x: progress * canvasWidth * 0.05, y: 0 };
    case "pan-right":
      return { scale: 1.1, x: (1 - progress) * -canvasWidth * 0.05, y: 0 };
    case "static":
    default:
      return { scale: 1.1, x: 0, y: 0 };
  }
}
