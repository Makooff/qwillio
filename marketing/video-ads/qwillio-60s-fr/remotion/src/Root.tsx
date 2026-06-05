import React from 'react';
import { Composition } from 'remotion';
import { Main } from './Main';

// 1910 frames @ 30fps = ~63.7s (covers the full CTA voiceover + end card).
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Qwillio60"
      component={Main}
      durationInFrames={1910}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
