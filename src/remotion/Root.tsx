import React from "react";
import { Composition } from "remotion";
import { RemotionVideo } from "@/components/video/RemotionVideo";
import { RemotionVideoFull } from "@/components/video/RemotionVideoFull";
import { RemotionVideoProps } from "@/lib/video/types";
import {
  REMOTION_DEFAULT_FPS,
  REMOTION_DEFAULT_WIDTH,
  REMOTION_DEFAULT_HEIGHT,
} from "@/remotion/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CaptionedVideo"
        component={RemotionVideo as any}
        durationInFrames={1}
        fps={REMOTION_DEFAULT_FPS}
        width={REMOTION_DEFAULT_WIDTH}
        height={REMOTION_DEFAULT_HEIGHT}
        defaultProps={{
          fps: REMOTION_DEFAULT_FPS,
          durationInFrames: 1,
          width: REMOTION_DEFAULT_WIDTH,
          height: REMOTION_DEFAULT_HEIGHT,
          scenes: [],
          audioTracks: [],
          captions: [],
        } satisfies RemotionVideoProps}
      />
      <Composition
        id="CaptionedVideoFull"
        component={RemotionVideoFull as any}
        durationInFrames={1}
        fps={REMOTION_DEFAULT_FPS}
        width={REMOTION_DEFAULT_WIDTH}
        height={REMOTION_DEFAULT_HEIGHT}
        defaultProps={{
          fps: REMOTION_DEFAULT_FPS,
          durationInFrames: 1,
          width: REMOTION_DEFAULT_WIDTH,
          height: REMOTION_DEFAULT_HEIGHT,
          scenes: [],
          audioTracks: [],
          captions: [],
        } satisfies RemotionVideoProps}
      />
    </>
  );
};
