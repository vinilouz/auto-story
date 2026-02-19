import React from 'react';
import { AbsoluteFill, Audio, Sequence } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { wipe } from '@remotion/transitions/wipe';
import { slide } from '@remotion/transitions/slide';
import { RemotionVideoProps } from '@/lib/video/types';
import { REMOTION_DEFAULT_FPS } from '@/remotion/constants';
import { Scene } from './Scene';
import { CaptionsLayer } from './CaptionsLayer';

const PRESENTATIONS: Record<string, any> = {
  fade: fade(),
  wipe: wipe(),
  slide: slide(),
};

export const RemotionVideo: React.FC<RemotionVideoProps> = ({ scenes, audioTracks, captions, captionStyle }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {/* Audio Tracks */}


      {/* We need to sequence audio tracks properly */}
      {audioTracks.map((track, i) => (
        // Remotion <Audio> by itself plays from frame 0 relative to parent.
        // We can wrap in Sequence to delay start.
        <Sequence key={`audio-${i}`} from={track.startFrame} durationInFrames={track.durationInFrames}>
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
              <TransitionSeries.Sequence durationInFrames={scene.durationInFrames}>
                <Scene scene={scene} />
              </TransitionSeries.Sequence>

              {scene.transition && scene.transition.type !== 'none' && PRESENTATIONS[scene.transition.type] && (
                <TransitionSeries.Transition
                  timing={linearTiming({ durationInFrames: scene.transition.durationInFrames })}
                  presentation={PRESENTATIONS[scene.transition.type]}
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
