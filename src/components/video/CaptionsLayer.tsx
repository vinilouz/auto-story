import { createTikTokStyleCaptions } from "@remotion/captions";
import type React from "react";
import { useMemo } from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import type { Caption, CaptionStyle } from "@/lib/video/types";
import { REMOTION_TOKEN_COMBINE_MS } from "@/remotion/constants";
import SubtitlePage from "./captions/SubtitlePage";

interface CaptionsLayerProps {
  captions: Caption[];
  style?: CaptionStyle;
}

const DEFAULT_STYLE: CaptionStyle = {
  fontSize: 70,
  fontFamily: "TikTok Sans",
  maxWordsPerLine: 3,
  uppercase: true,
  highlightColor: "#FFE81F",
  fontWeight: 700,
};

export const CaptionsLayer: React.FC<CaptionsLayerProps> = ({
  captions,
  style,
}) => {
  const { fps } = useVideoConfig();
  const activeStyle = { ...DEFAULT_STYLE, ...style };

  const { pages } = useMemo(() => {
    const chunks: Caption[][] = [];
    let currentChunk: Caption[] = [];

    for (let i = 0; i < captions.length; i++) {
      const cap = captions[i];
      const nextCap = captions[i + 1];

      currentChunk.push(cap);

      const isEndOfSentence = /[.!?]$/.test(cap.text.trim());
      const wordCountLimit = currentChunk.length >= activeStyle.maxWordsPerLine;

      if (isEndOfSentence || wordCountLimit || !nextCap) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    }

    const allPages = chunks.flatMap((chunk) => {
      const { pages } = createTikTokStyleCaptions({
        combineTokensWithinMilliseconds: REMOTION_TOKEN_COMBINE_MS,
        captions: chunk.map((c) => ({
          text: c.text,
          startMs: c.startMs,
          endMs: c.endMs,
          timestampMs: c.startMs,
          confidence: 0,
        })),
      });
      return pages;
    });

    return { pages: allPages };
  }, [captions, activeStyle.maxWordsPerLine]);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {pages.map((page, index) => {
        const nextPage = pages[index + 1];
        const lastToken = page.tokens[page.tokens.length - 1];

        const startFrame = Math.round((page.startMs / 1000) * fps);
        const endFrame = Math.round(
          nextPage
            ? (nextPage.startMs / 1000) * fps
            : (lastToken.toMs / 1000) * fps,
        );

        const durationInFrames = endFrame - startFrame;

        if (durationInFrames <= 0) return null;

        return (
          <Sequence
            key={index}
            from={startFrame}
            durationInFrames={durationInFrames}
          >
            <SubtitlePage page={page} style={activeStyle} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
