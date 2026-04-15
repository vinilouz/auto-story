import { useWindowedAudioData, visualizeAudio } from "@remotion/media-utils";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { RemotionVideoProps } from "@/lib/video/types";
import { AudioVizOverlay } from "./audio-viz/AudioVizOverlay";
import { CaptionsLayer } from "./CaptionsLayer";
import { Scene } from "./Scene";

const PRESENTATIONS: Record<string, any> = {
  fade: fade(),
  wipe: wipe(),
  slide: slide(),
};

const DUCK_VOLUME = 0.08;

export const RemotionVideo: React.FC<RemotionVideoProps> = ({
  scenes,
  audioTracks,
  captions,
  captionStyle,
  transitionOverride,
  videoVolume,
  musicSrc,
  musicVolume = 0.3,
  musicCompressor,
  audioViz,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isNarrationAt = (f: number) =>
    audioTracks.some(
      (t) => f >= t.startFrame && f < t.startFrame + t.durationInFrames,
    );

  const musicVol = musicCompressor
    ? (f: number) =>
        isNarrationAt(f) ? DUCK_VOLUME * musicVolume : musicVolume
    : musicVolume;

  const showModulation =
    audioViz?.enabled && audioViz.effects.includes("scene-modulation");

  const modulationTrack = audioTracks[0];
  const modulationSrc = modulationTrack?.src ?? "";
  const modulationFrame = modulationTrack ? frame - modulationTrack.startFrame : 0;

  const { audioData: modulationAudio, dataOffsetInSeconds: modulationOffset } =
    useWindowedAudioData({
      src: modulationSrc,
      frame: modulationFrame,
      fps,
      windowInSeconds: 10,
    });

  let amplitude = 0;
  if (showModulation && modulationAudio) {
    const frequencies = visualizeAudio({
      fps,
      frame: modulationFrame,
      audioData: modulationAudio,
      numberOfSamples: 512,
      optimizeFor: "speed",
      dataOffsetInSeconds: modulationOffset,
    });
    amplitude =
      frequencies.reduce((sum, v) => sum + v, 0) / frequencies.length;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* Background Music */}
      {musicSrc && musicVolume > 0 && (
        <Audio src={musicSrc} volume={musicVol} />
      )}

      {/* Narration Audio Tracks */}
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
        {scenes.map((scene, i) => {
          // Determine Transition
          // The transition is applied AFTER this sequence, connecting to the NEXT.
          // The data model has `transition` on the scene object.

          return (
            <React.Fragment key={scene.id}>
              <TransitionSeries.Sequence
                durationInFrames={scene.durationInFrames}
              >
                <Scene
                  scene={scene}
                  videoVolume={videoVolume}
                  audioAmplitude={showModulation ? amplitude : undefined}
                  modulationConfig={audioViz?.sceneModulation}
                />
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

      {/* Audio Visualization Overlay */}
      {audioViz?.enabled && audioTracks.length > 0 && (
        <AudioVizOverlay audioTracks={audioTracks} config={audioViz} />
      )}

      <CaptionsLayer captions={captions || []} style={captionStyle} />
    </AbsoluteFill>
  );
};
