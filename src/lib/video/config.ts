export const RENDERER = {
  REMOTION: "remotion",
  MEDIABUNNY: "mediabunny",
} as const;

export type RendererType =
  (typeof RENDERER)[keyof typeof RENDERER];

export const ACTIVE_RENDERER: RendererType =
  process.env.RENDERER === "mediabunny"
    ? RENDERER.MEDIABUNNY
    : RENDERER.REMOTION;
