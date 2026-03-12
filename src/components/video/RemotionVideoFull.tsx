import { Audio, Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
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
export const RemotionVideoFull: React.FC<RemotionVideoProps> = ({
  scenes,
  audioTracks,
  captions,
  captionStyle,
  videoVolume = 0.2, // default 20% as required
}) => {
  // ── 1. Compute cumulative start frames for raw concatenation ──────────────
  // No TransitionSeries — each clip plays in full, back-to-back.
  let cursor = 0;
  const videoSequences = scenes.map((scene) => {
    const startFrame = cursor;
    cursor += scene.durationInFrames;
    return { scene, startFrame };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>

      {/* ── Layer 1: Videos (raw concatenation) ──────────────────────────── */}
      {videoSequences.map(({ scene, startFrame }) => (
        <Sequence
          key={`video-${scene.id}`}
          from={startFrame}
          durationInFrames={scene.durationInFrames}
          layout="none"
        >
          <AbsoluteFill style={{ overflow: "hidden" }}>
            <Video
              src={scene.videoClipUrl || scene.imageUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              volume={videoVolume}
            />
          </AbsoluteFill>
        </Sequence>
      ))}

      {/* ── Layer 2: Captions (independent) ──────────────────────────────── */}
      <CaptionsLayer captions={captions || []} style={captionStyle} />

      {/* ── Layer 3: Audio tracks (independent) ──────────────────────────── */}
      {audioTracks.map((track, i) => (
        <Sequence
          key={`audio-${i}`}
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