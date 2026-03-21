import type { SceneEffect, VideoScene, VideoTransition } from "../types";

export interface GenerateScenesOptions {
  effects: SceneEffect[];
  transitions: VideoTransition["type"][];
  transitionFrames: number;
}

export function generateScenes(
  segments: { id: string; imageUrl?: string; videoClipUrl?: string; text?: string }[],
  timings: { start: number; end: number; confidence?: number }[],
  fps: number,
  options: GenerateScenesOptions
): VideoScene[] {
  const scenes: VideoScene[] = [];
  const TRANSITION_FRAMES = options.transitionFrames;
  const HALF_TRANSITION = TRANSITION_FRAMES / 2;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const timing = timings[i];

    const startSeconds = timing.start;
    const endSeconds = timing.end;

    let logicalDurationFrames = 0;
    if (startSeconds !== -1) {
      logicalDurationFrames = Math.round((endSeconds - startSeconds) * fps);
    }

    const isFirst = i === 0;
    const isLast = i === segments.length - 1;

    const effect = options.effects[i % options.effects.length];
    const transitionType = options.transitions[i % options.transitions.length];

    let hasTransitionIn = !isFirst;
    let hasTransitionOut = !isLast;

    const paddingIn = hasTransitionIn ? HALF_TRANSITION : 0;
    const paddingOut = hasTransitionOut ? HALF_TRANSITION : 0;
    const projectedDuration = logicalDurationFrames + paddingIn + paddingOut;

    if (projectedDuration <= TRANSITION_FRAMES + 2) {
      hasTransitionIn = false;
      hasTransitionOut = false;

      if (i > 0 && scenes[i - 1]) {
        const prevScene = scenes[i - 1];
        if (prevScene.transition) {
          prevScene.transition = undefined;
          prevScene.durationInFrames -= HALF_TRANSITION;
          if (prevScene.durationInFrames < TRANSITION_FRAMES) {
            prevScene.durationInFrames = TRANSITION_FRAMES;
          }
        }
      }
    }

    let finalDuration = logicalDurationFrames;
    if (hasTransitionIn) finalDuration += HALF_TRANSITION;
    if (hasTransitionOut) finalDuration += HALF_TRANSITION;

    if (finalDuration < 1) finalDuration = 1;

    const startFrame = 0;

    scenes.push({
      id: seg.id,
      imageUrl: seg.imageUrl || "",
      videoClipUrl: seg.videoClipUrl,
      startFrame,
      durationInFrames: Math.round(finalDuration),
      effect,
      transition: hasTransitionOut
        ? {
            type: transitionType,
            durationInFrames: TRANSITION_FRAMES,
          }
        : undefined,
      textFragment: seg.text,
      debug: {
        startSeconds,
        endSeconds,
        durationSeconds: endSeconds - startSeconds,
        confidence: timing.confidence ?? 1,
      },
    });
  }

  return scenes;
}
