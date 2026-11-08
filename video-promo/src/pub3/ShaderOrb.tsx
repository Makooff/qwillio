/**
 * Le rond de l'appel, repris du fichier Figma Make « Shader Reminder »
 * (7wYeHdH9iallsagJqpUmot) :
 *  - `ShaderCanvas` + `flowingWavesShader` (src/app/components/util/shaders.ts) :
 *    neuf itérations de cosinus qui tordent l'espace, une couleur divisée par
 *    |sin(t - y - x)|, le centre assombri à 30 % entre 0,3 et 0,5 rayon, et tout
 *    ce qui sort du cercle jeté. Les deux palettes du fichier sont gardées :
 *    ramenées au gris et noir (la palette neutre du fichier), sans ombre.
 *  - `CenterReminderDisplay` : un disque de 70 %, noir à 30 %, flou de 16 px
 *    (`backdrop-blur-lg`), liseré blanc à 10 %, l'heure au-dessus du message.
 *    Le message est ici l'emoji d'appel.
 * Le shader est recalculé en JavaScript, pixel par pixel, à partir du temps de
 * la vidéo et non de l'horloge : chaque image du rendu est donc reproductible.
 */
import React, { useLayoutEffect, useRef } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';
import { loadFont } from '@remotion/fonts';

// Noto Color Emoji (OFL) : sans elle, Chromium retombe sur un glyphe gris.
let emojiLoaded = false;
function useEmojiFont() {
  if (emojiLoaded) return;
  emojiLoaded = true;
  const h = delayRender('emoji');
  loadFont({ family: 'QEmoji', url: staticFile('fonts/NotoColorEmoji.ttf') }).then(() => continueRender(h));
}

const smoothstep = (a: number, b: number, x: number) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** Une image du shader « Flowing Waves », dans un canvas de `res` pixels. */
function drawWaves(ctx: CanvasRenderingContext2D, res: number, time: number, active: number, level: number) {
  const img = ctx.createImageData(res, res);
  const d = img.data;
  const r = res / 2;
  // Palette : gris et noir, la palette neutre d'origine du fichier (0,1),
  // un peu plus claire une fois l'appel pris et quand la voix monte.
  const gain = 0.1 + 0.025 * active + 0.06 * level;
  // La voix tord davantage les vagues : 0,6 au repos, jusqu'à 0,85.
  const warp = 0.6 + 0.25 * level;
  for (let py = 0; py < res; py++) {
    const fy = res - 1 - py + 0.5; // gl_FragCoord monte, le canvas descend
    for (let px = 0; px < res; px++) {
      const fx = px + 0.5;
      const dist = Math.hypot(fx - r, fy - r);
      const o = (py * res + px) * 4;
      if (dist >= r) { d[o + 3] = 0; continue; }
      let ux = (2 * fx - res) / res, uy = (2 * fy - res) / res;
      for (let i = 1; i < 10; i++) {
        ux += (warp / i) * Math.cos(i * 2.5 * uy + time);
        uy += (warp / i) * Math.cos(i * 1.5 * ux + time);
      }
      const s = Math.abs(Math.sin(time - uy - ux)) || 1e-6;
      const br = gain, bg = gain, bb = gain;
      const dim = smoothstep(r * 0.3, r * 0.5, dist);
      const k = 0.3 + 0.7 * dim;
      // L'antialiasing du bord, que le `discard` du fichier n'a pas mais que le
      // `rounded-full` du canvas lui donne à l'écran.
      const edge = Math.min(1, r - dist);
      d[o] = Math.min(255, (br / s) * 255) * k;
      d[o + 1] = Math.min(255, (bg / s) * 255) * k;
      d[o + 2] = Math.min(255, (bb / s) * 255) * k;
      d[o + 3] = 255 * edge;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function ShaderOrb({ size, time, active, timer, level = 0 }: { size: number; time: number; active: number; timer: string; level?: number }) {
  useEmojiFont();
  const ref = useRef<HTMLCanvasElement>(null);
  const RES = 360;
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawWaves(ctx, RES, time, active, level);
  }, [time, active, level]);
  const inner = size * 0.7;
  // La voix fait respirer le rond, à peine.
  const breathe = 1 + level * 0.035;
  return (
    <div style={{ position: 'relative', width: size, height: size, transform: `scale(${breathe})` }}>
      <canvas ref={ref} width={RES} height={RES} style={{ width: size, height: size, borderRadius: '50%', display: 'block', position: 'relative' }} />
      <div style={{ position: 'absolute', left: (size - inner) / 2, top: (size - inner) / 2, width: inner, height: inner, borderRadius: '50%', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontSize: inner * 0.07, color: 'rgba(250,250,250,0.8)', marginBottom: inner * 0.05, fontVariantNumeric: 'tabular-nums' }}>{timer}</div>
        <div style={{ fontSize: inner * 0.32, lineHeight: 1, fontFamily: 'QEmoji' }}>📞</div>
      </div>
    </div>
  );
}
