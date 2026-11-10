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
import { Post, POSTS, POST_FORMATS, type PostFormat } from './shorts/poster';
import { FORMATS, Format, SHORT_FPS, SHORT_IDS, Short, buildTimeline, shortName } from './shorts/Short';

export const RemotionRoot: React.FC = () => (
  <>
  <Composition id="Probe" component={Probe} durationInFrames={1} fps={30} width={1080} height={3000} />
  <Composition id="QwillioFilm" component={Film} durationInFrames={Math.round(DURATION * FPS)} fps={FPS} width={1920} height={1080} />
  <Composition id="QwillioPub" component={Pub} durationInFrames={Math.round(PubT.DURATION * PubT.FPS)} fps={PubT.FPS} width={1080} height={1920} />
  <Composition id="QwillioPub2" component={Pub2} durationInFrames={Math.round(PUB2_DURATION * 60)} fps={60} width={1080} height={1920} />
  <Composition id="QwillioPub3" component={Pub3} durationInFrames={Math.round(PUB3_DURATION * 60)} fps={60} width={1080} height={1920} />
  <Composition id="QwillioPub4" component={Pub4} durationInFrames={Math.round(PUB4_DURATION * 60)} fps={60} width={1080} height={1920} />
  {/* La série courte : une composition par vidéo (src/shorts). */}
  {SHORT_IDS.flatMap((id) => (Object.keys(FORMATS) as Format[]).map((format) => (
    <Composition key={`${id}-${format}`} id={shortName(id, format)} component={Short} defaultProps={{ id, format, cine: true }} durationInFrames={Math.round(buildTimeline(id).duration * SHORT_FPS)} fps={SHORT_FPS} width={FORMATS[format].w} height={FORMATS[format].h} />
  )))}
  {/* Les posts fixes, Instagram et LinkedIn (4:5). */}
  {(['fr', 'en', 'nl'] as const).flatMap((lang) => POSTS[lang].flatMap((_, i) => (Object.keys(POST_FORMATS) as PostFormat[]).map((fmt) => (
    <Composition key={`post-${lang}-${i}-${fmt}`} id={`Post-${lang}-${String(i + 1).padStart(2, '0')}${fmt === '4x5' ? '' : `-${fmt}`}`} component={Post} defaultProps={{ lang, index: i, fmt }} durationInFrames={1} fps={30} width={POST_FORMATS[fmt].w} height={POST_FORMATS[fmt].h} />
  ))))}  {/* Le style « affiche » (src/shorts/poster.tsx), d'après la référence ElevenLabs. */}
  {SHORT_IDS.flatMap((id) => (Object.keys(FORMATS) as Format[]).map((format) => (
    <Composition key={`${id}-${format}-poster`} id={`${shortName(id, format)}-poster`} component={Short} defaultProps={{ id, format, poster: true }} durationInFrames={Math.round(buildTimeline(id).duration * SHORT_FPS)} fps={SHORT_FPS} width={FORMATS[format].w} height={FORMATS[format].h} />
  )))}
  </>
);
