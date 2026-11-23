import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { buildTimeline, SHORT_FPS } from './Short';
import { campaignVisual } from './campaign';
import { CineCtx, LookCtx, lookFor } from './cine';

/**
 * L'illustration animée du site : les deux iPhones de la vidéo c01 (ligne
 * occupée, Qwillio prend le deuxième appel, la réservation arrive), seuls,
 * sur fond TRANSPARENT, sans titres ni son. Rendue en WebM avec alpha pour
 * la page d'accueil, entre le hero et la section suivante.
 *
 * Elle relit la frise de la vidéo (buildTimeline) au lieu d'en écrire une
 * seconde : le site montre exactement ce que montre la vidéo.
 */
const CROP_Y = 400; // la scène « split » vit entre y≈430 (étiquettes) et y≈1480 (reflets)
export const SITE_LOOP_SIZE = { w: 1080, h: 1080 };

export function siteLoopScenes(id: string) {
  const T = buildTimeline(id);
  const scenes = T.scenes.filter((s) => s.visual.kind === 'x' && s.visual.scene === 'split');
  const start = scenes[0].at;
  const end = scenes[scenes.length - 1].out;
  return { T, scenes, start, duration: end - start };
}

export const SiteLoop: React.FC<{ id: string }> = ({ id }) => {
  const { fps } = useVideoConfig();
  const { T, scenes, start } = React.useMemo(() => siteLoopScenes(id), [id]);
  const t = start + useCurrentFrame() / fps;
  const s = scenes.find((x) => t >= x.at && t < x.out) ?? scenes[scenes.length - 1];
  return (
    <CineCtx.Provider value>
      <LookCtx.Provider value={lookFor(id)}>
        <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
          <AbsoluteFill style={{ top: -CROP_Y, height: 1920, transformStyle: 'preserve-3d' }}>{campaignVisual(t, s, T.lang).body}</AbsoluteFill>
        </AbsoluteFill>
      </LookCtx.Provider>
    </CineCtx.Provider>
  );
};

export const siteLoopFrames = (id: string) => Math.round(siteLoopScenes(id).duration * SHORT_FPS);
