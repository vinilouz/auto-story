
import React from 'react';
import { AbsoluteFill, Img, Video, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { VideoScene } from '@/lib/video/types';

export const Scene: React.FC<{ scene: VideoScene; videoVolume?: number }> = ({ scene, videoVolume }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  // Ken Burns Effect Logic
  const scale = interpolate(
    frame,
    [0, durationInFrames],
    scene.effect === 'zoom-in' ? [1, 1.15] :
      scene.effect === 'zoom-out' ? [1.15, 1] :
        scene.effect === 'static' ? [1.0, 1.0] :
          [1.1, 1.1], // Pan base scale
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

  const isVideo = scene.imageUrl.endsWith('.mp4') || scene.imageUrl.endsWith('.webm');

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: 'black' }}>
      {isVideo ? (
        <Video
          src={scene.imageUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale}) translateX(${translateX}px)`
          }}
          playbackRate={scene.playbackRate ?? 1}
          volume={videoVolume ?? 0.5}
          loop={true}
        />
      ) : (
        <Img
          src={scene.imageUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale}) translateX(${translateX}px)`
          }}
        />
      )}
      {/* Optional: Text Overlay for debugging or style */}
      {/* <div style={{ position: 'absolute', bottom: 50, left: 50, color: 'white', fontSize: 40, textShadow: '2px 2px 4px black' }}>
        {scene.textFragment?.substring(0, 50)}...
      </div> */}
    </AbsoluteFill>
  );
};
