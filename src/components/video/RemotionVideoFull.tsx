import { Audio, Video } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import type { RemotionVideoProps } from "@/lib/video/types";
import { CaptionsLayer } from "./CaptionsLayer";

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
  transitionOverride,
  videoVolume,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* Audio Tracks */}
      {audioTracks.map((track, i) => (
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
        {scenes.map((scene) => {
          return (
            <React.Fragment key={scene.id}>
              <TransitionSeries.Sequence
                durationInFrames={scene.durationInFrames}
              >
                <AbsoluteFill
                  style={{ overflow: "hidden", backgroundColor: "black" }}
                >
                  <Video
                    src={scene.imageUrl}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    playbackRate={scene.playbackRate ?? 1}
                    volume={videoVolume ?? 0.2}
                  />
                </AbsoluteFill>
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
