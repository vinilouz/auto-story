import React from 'react'
import { AbsoluteFill, Img, OffthreadVideo, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { VideoScene } from '@/lib/video/types'

export const Scene: React.FC<{ scene: VideoScene; videoVolume?: number }> = ({ scene, videoVolume }) => {
  const frame = useCurrentFrame()
  const { width, durationInFrames } = useVideoConfig()

  // Video clip — muted by default (narration is a separate audio track)
  if (scene.videoClipUrl) {
    return (
      <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: 'black' }}>
        <OffthreadVideo
          src={scene.videoClipUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          volume={videoVolume ?? 0}
        />
      </AbsoluteFill>
    )
  }

  // Static image with Ken Burns effect
  const scale = interpolate(
    frame, [0, durationInFrames],
    scene.effect === 'zoom-in' ? [1, 1.15] :
      scene.effect === 'zoom-out' ? [1.15, 1] :
        [1.1, 1.1],
    { extrapolateRight: 'clamp' },
  )

  const translateX = interpolate(
    frame, [0, durationInFrames],
    scene.effect === 'pan-left' ? [0, -width * 0.05] :
      scene.effect === 'pan-right' ? [-width * 0.05, 0] :
        [0, 0],
    { extrapolateRight: 'clamp' },
  )

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: 'black' }}>
      <Img
        src={scene.imageUrl}
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
          transform: `scale(${scale}) translateX(${translateX}px)`,
        }}
      />
    </AbsoluteFill>
  )
}