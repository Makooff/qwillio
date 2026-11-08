import React from 'react';
import { Composition } from 'remotion';
import { Film } from './Film';
import { Probe } from './Probe';
import { Pub } from './pub/Pub';
import * as PubT from './pub/timeline';
import { Pub2, DURATION as PUB2_DURATION } from './pub2/Pub2';
import { Pub3, DURATION as PUB3_DURATION } from './pub3/Pub3';
import { Pub4, DURATION as PUB4_DURATION } from './pub4/Pub4';
import { DURATION, FPS } from './timeline';

export const RemotionRoot: React.FC = () => (
  <>
  <Composition id="Probe" component={Probe} durationInFrames={1} fps={30} width={1080} height={3000} />
  <Composition id="QwillioFilm" component={Film} durationInFrames={Math.round(DURATION * FPS)} fps={FPS} width={1920} height={1080} />
  <Composition id="QwillioPub" component={Pub} durationInFrames={Math.round(PubT.DURATION * PubT.FPS)} fps={PubT.FPS} width={1080} height={1920} />
  <Composition id="QwillioPub2" component={Pub2} durationInFrames={Math.round(PUB2_DURATION * 60)} fps={60} width={1080} height={1920} />
  <Composition id="QwillioPub3" component={Pub3} durationInFrames={Math.round(PUB3_DURATION * 60)} fps={60} width={1080} height={1920} />
  <Composition id="QwillioPub4" component={Pub4} durationInFrames={Math.round(PUB4_DURATION * 60)} fps={60} width={1080} height={1920} />
  </>
);
