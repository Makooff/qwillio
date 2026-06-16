import React from 'react';
import { Composition } from 'remotion';
import { Main } from './Main';
import { MainV2 } from './MainV2';
import { HeroV2, LiveCallV2 } from './v2';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Qwillio60"
        component={Main}
        durationInFrames={1910}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="QwillioV2"
        component={MainV2}
        durationInFrames={1560}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="V2Hero"
        component={HeroV2}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="V2LiveCall"
        component={LiveCallV2}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
