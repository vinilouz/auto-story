
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { makeTransform, scale, translateY } from "@remotion/animation-utils";
import { TikTokPage } from "@remotion/captions";
import { CaptionStyle } from "@/lib/video/types";

const containerStyle: React.CSSProperties = {
  justifyContent: "center",
  alignItems: "center",
  top: undefined,
  bottom: 150,
  height: 150,
};

export const Page: React.FC<{
  readonly enterProgress: number;
  readonly page: TikTokPage;
  readonly style: CaptionStyle;
}> = ({ enterProgress, page, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeInMs = (frame / fps) * 1000;

  const { fontSize, fontFamily, highlightColor, fontWeight, uppercase } = style;

  return (
    <AbsoluteFill style={containerStyle}>
      <div
        style={{
          fontSize,
          color: "white",
          WebkitTextStroke: "8px black",
          paintOrder: "stroke",
          transform: makeTransform([
            scale(interpolate(enterProgress, [0, 1], [0.8, 1])),
            translateY(interpolate(enterProgress, [0, 1], [50, 0])),
          ]),
          fontFamily,
          textTransform: uppercase ? "uppercase" : "none",
          fontWeight,
          textAlign: 'center',
          lineHeight: 1.2,
          width: '100%',
          paddingLeft: 20,
          paddingRight: 20,
          whiteSpace: 'normal'
        }}
      >
        <span>
          {page.tokens.map((t, i) => {
            const startRelative = t.fromMs - page.startMs;
            const endRelative = t.toMs - page.startMs;

            const active = startRelative <= timeInMs && endRelative > timeInMs;

            return (
              <span
                key={`${t.fromMs}-${i}`}
                style={{
                  display: "inline-block",
                  whiteSpace: "pre",
                  color: active ? highlightColor : "white",
                  marginRight: '0.25em',
                }}
              >
                {t.text}
              </span>
            );
          })}
        </span>
      </div>
    </AbsoluteFill>
  );
};
