import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import type { RemotionVideoProps } from "@/lib/video/types";
import { REMOTION_DEFAULT_FPS } from "@/remotion/constants";
import { CaptionsLayer } from "./CaptionsLayer";
import { Scene } from "./Scene";

const PRESENTATIONS: Record<string, any> = {
  fade: fade(),
  wipe: wipe(),
  slide: slide(),
};

export const RemotionVideo: React.FC<RemotionVideoProps> = ({
  scenes,
  audioTracks,
  captions,
  captionStyle,
  transitionOverride,
  videoVolume,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* Audio Tracks */}

      {/* We need to sequence audio tracks properly */}
      {audioTracks.map((track, i) => (
        // Remotion <Audio> by itself plays from frame 0 relative to parent.
        // We can wrap in Sequence to delay start.
        <Sequence
          key={`audio-${i}`}
          from={track.startFrame}
          durationInFrames={track.durationInFrames}
        >
          <Audio src={track.src} volume={track.volume || 1} />
        </Sequence>
      ))}

      {/* Visual Track with Transitions */}
      <TransitionSeries>
        {scenes.map((scene, i) => {
          // Determine Transition
          // The transition is applied AFTER this sequence, connecting to the NEXT.
          // The data model has `transition` on the scene object.

          return (
            <React.Fragment key={scene.id}>
              <TransitionSeries.Sequence
                durationInFrames={scene.durationInFrames}
              >
                <Scene scene={scene} videoVolume={videoVolume} />
              </TransitionSeries.Sequence>

              {scene.transition &&
                scene.transition.type !== "none" &&
                transitionOverride !== "none" &&
                PRESENTATIONS[
                  transitionOverride === "random" || !transitionOverride
                    ? scene.transition.type
                    : transitionOverride
                ] && (
                  <TransitionSeries.Transition
                    timing={linearTiming({
                      durationInFrames: scene.transition.durationInFrames,
                    })}
                    presentation={
                      PRESENTATIONS[
                        transitionOverride === "random" || !transitionOverride
                          ? scene.transition.type
                          : transitionOverride
                      ]
                    }
                  />
                )}
            </React.Fragment>
          );
        })}
      </TransitionSeries>

      <CaptionsLayer captions={captions || []} style={captionStyle} />
    </AbsoluteFill>
  );
};
