import React from 'react';
import { Composition } from 'remotion';
import { Film } from './Film';
import { DURATION, FPS } from './timeline';

export const RemotionRoot: React.FC = () => (
  <Composition id="QwillioFilm" component={Film} durationInFrames={Math.round(DURATION * FPS)} fps={FPS} width={1920} height={1080} />
);
