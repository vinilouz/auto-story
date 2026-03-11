import { Player } from "@remotion/player";
import type React from "react";
import type { RemotionVideoProps } from "@/lib/video/types";
import { RemotionVideo } from "./RemotionVideo";
import { RemotionVideoFull } from "./RemotionVideoFull";

interface VideoPlayerProps {
  props: RemotionVideoProps;
  compositionId?: "CaptionedVideo" | "CaptionedVideoFull";
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  props,
  compositionId = "CaptionedVideo",
}) => {
  return (
    <div className="w-full aspect-video rounded-lg overflow-hidden border bg-black shadow-lg">
      <Player
        component={
          compositionId === "CaptionedVideoFull"
            ? (RemotionVideoFull as any)
            : (RemotionVideo as any)
        }
        inputProps={props as unknown as Record<string, unknown>}
        durationInFrames={props.durationInFrames}
        fps={props.fps}
        compositionWidth={props.width}
        compositionHeight={props.height}
        numberOfSharedAudioTags={30}
        style={{
          width: "100%",
          height: "100%",
        }}
        controls
        autoPlay
        loop={false}
      />
    </div>
  );
};
