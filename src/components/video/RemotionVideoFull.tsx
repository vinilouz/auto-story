import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import React from "react";
import { AbsoluteFill, Sequence, OffthreadVideo } from "remotion";
import type { RemotionVideoProps } from "@/lib/video/types";
import { CaptionsLayer } from "./CaptionsLayer";

/**
 * RemotionVideoFull — used exclusively by the "fullvideo" flow.
 *
 * Layer order (bottom → top):
 *   1. Videos  — raw concatenation, no transitions, no cuts
 *   2. Captions — fully independent, timed via ms
 *   3. Audios  — fully independent, timed via startFrame
 *
 * Each layer is self-contained and does NOT depend on the others.
 */
const PRESENTATIONS: Record<string, any> = {
  fade: fade(),
  wipe: wipe(),
  slide: slide(),
};

export const RemotionVideoFull: React.FC<RemotionVideoProps> = ({
  scenes,
  audioTracks,
  captions,
  captionStyle,
  videoVolume = 0.1,
  transitionOverride,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>

      {/* ── Layer 1: Video visuals with transitions ────────────────────────── */}
      <TransitionSeries>
        {scenes.map((scene) => (
          <React.Fragment key={scene.id}>
            <TransitionSeries.Sequence durationInFrames={scene.durationInFrames}>
              <AbsoluteFill style={{ overflow: "hidden" }}>
                {/* OffthreadVideo: canvas-based, consumes NO audio tag */}
                <OffthreadVideo
                  src={scene.videoClipUrl ?? scene.imageUrl}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  playbackRate={scene.playbackRate ?? 1}
                  muted
                />
              </AbsoluteFill>

              {/* Clip ambient audio — isolated from narration pool.
                  videoVolume===0 → skip entirely (no audio tag allocated). */}
              {videoVolume > 0 && (
                <Audio
                  src={scene.videoClipUrl ?? scene.imageUrl}
                  volume={videoVolume}
                  playbackRate={scene.playbackRate ?? 1}
                />
              )}
            </TransitionSeries.Sequence>

            {/* Transition to next clip — present only when scene defines one */}
            {scene.transition &&
              scene.transition.type !== "none" &&
              transitionOverride !== "none" && (() => {
                const type = transitionOverride === "random" || !transitionOverride
                  ? scene.transition.type
                  : transitionOverride;
                const presentation = PRESENTATIONS[type];
                if (!presentation) return null;
                return (
                  <TransitionSeries.Transition
                    timing={linearTiming({
                      durationInFrames: scene.transition.durationInFrames,
                    })}
                    presentation={presentation}
                  />
                );
              })()}
          </React.Fragment>
        ))}
      </TransitionSeries>

      {/* ── Layer 2: Captions (independent) ────────────────────────────────── */}
      <CaptionsLayer captions={captions ?? []} style={captionStyle} />

      {/* ── Layer 3: Narration audio ──────────────────────────────────────────
          Outside TransitionSeries entirely — clip lifecycle events cannot
          glitch these tracks. */}
      {audioTracks.map((track, i) => (
        <Sequence
          key={`narration-${i}`}
          from={track.startFrame}
          durationInFrames={track.durationInFrames}
          layout="none"
        >
          <Audio src={track.src} volume={track.volume ?? 1} />
        </Sequence>
      ))}

    </AbsoluteFill>
  );
};