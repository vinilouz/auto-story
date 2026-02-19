
import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { VideoScene } from '@/lib/video/types';

export const Scene: React.FC<{ scene: VideoScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  // Ken Burns Effect Logic
  const scale = interpolate(
    frame,
    [0, durationInFrames],
    scene.effect === 'zoom-in' ? [1, 1.15] :
      scene.effect === 'zoom-out' ? [1.15, 1] :
        [1.1, 1.1], // Static/Pan base scale
    { extrapolateRight: 'clamp' }
  );

  const translateX = interpolate(
    frame,
    [0, durationInFrames],
    scene.effect === 'pan-left' ? [0, -width * 0.05] :
      scene.effect === 'pan-right' ? [-width * 0.05, 0] :
        [0, 0],
    { extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: 'black' }}>
      <Img
        src={scene.imageUrl}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translateX(${translateX}px)`
        }}
      />
      {/* Optional: Text Overlay for debugging or style */}
      {/* <div style={{ position: 'absolute', bottom: 50, left: 50, color: 'white', fontSize: 40, textShadow: '2px 2px 4px black' }}>
        {scene.textFragment?.substring(0, 50)}...
      </div> */}
    </AbsoluteFill>
  );
};
