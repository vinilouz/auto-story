import type { TikTokPage } from "@remotion/captions";
import type React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CaptionStyle } from "@/lib/video/types";
import { Page } from "./Page";

const SubtitlePage: React.FC<{
  readonly page: TikTokPage;
  readonly style: CaptionStyle;
}> = ({ page, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: {
      damping: 200,
    },
    durationInFrames: 5,
  });

  return (
    <AbsoluteFill>
      <Page enterProgress={enter} page={page} style={style} />
    </AbsoluteFill>
  );
};

export default SubtitlePage;
