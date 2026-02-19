
import React from 'react';
import { Player } from '@remotion/player';
import { RemotionVideoProps } from '@/lib/video/types';
import { RemotionVideo } from './RemotionVideo';

interface VideoPlayerProps {
  props: RemotionVideoProps;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ props }) => {
  return (
    <div className="w-full aspect-video rounded-lg overflow-hidden border bg-black shadow-lg">
      <Player
        component={RemotionVideo as any}
        inputProps={props as unknown as Record<string, unknown>}
        durationInFrames={props.durationInFrames}
        fps={props.fps}
        compositionWidth={props.width}
        compositionHeight={props.height}
        numberOfSharedAudioTags={30}
        style={{
          width: '100%',
          height: '100%'
        }}
        controls
        autoPlay
        loop={false}
      />
    </div>
  );
};
