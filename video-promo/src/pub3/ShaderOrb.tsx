/**
 * Le rond de l'appel, repris du fichier Figma Make « Shader Reminder »
 * (7wYeHdH9iallsagJqpUmot) :
 *  - `ShaderCanvas` + `flowingWavesShader` (src/app/components/util/shaders.ts) :
 *    neuf itérations de cosinus qui tordent l'espace, une couleur divisée par
 *    |sin(t - y - x)|, le centre assombri à 30 % entre 0,3 et 0,5 rayon, et tout
 *    ce qui sort du cercle jeté. Les deux palettes du fichier sont gardées :
 *    neutre (au repos) et bleue (`hasActiveReminders`, ici : l'appel est pris).
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
function drawWaves(ctx: CanvasRenderingContext2D, res: number, time: number, active: number) {
  const img = ctx.createImageData(res, res);
  const d = img.data;
  const r = res / 2;
  // Palette : neutre (0,1) vers bleue (0,1 · 0,3 · 0,6), comme les deux états du fichier.
  const br = 0.1, bg = 0.1 + 0.2 * active, bb = 0.1 + 0.5 * active;
  for (let py = 0; py < res; py++) {
    const fy = res - 1 - py + 0.5; // gl_FragCoord monte, le canvas descend
    for (let px = 0; px < res; px++) {
      const fx = px + 0.5;
      const dist = Math.hypot(fx - r, fy - r);
      const o = (py * res + px) * 4;
      if (dist >= r) { d[o + 3] = 0; continue; }
      let ux = (2 * fx - res) / res, uy = (2 * fy - res) / res;
      for (let i = 1; i < 10; i++) {
        ux += (0.6 / i) * Math.cos(i * 2.5 * uy + time);
        uy += (0.6 / i) * Math.cos(i * 1.5 * ux + time);
      }
      const s = Math.abs(Math.sin(time - uy - ux)) || 1e-6;
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
    if (ctx) drawWaves(ctx, RES, time, active);
  }, [time, active]);
  const inner = size * 0.7;
  // La voix fait respirer le rond, à peine.
  const breathe = 1 + level * 0.035;
  // L'ombre : un halo qui tourne lentement sous le rond et enfle avec la voix.
  const a = time * 0.8;
  const glow = 0.35 + level * 0.65;
  const halo = (dx: number, dy: number, c: string, s: number) => (
    <div style={{ position: 'absolute', left: size * (0.5 + dx) - size * s / 2, top: size * (0.5 + dy) - size * s / 2, width: size * s, height: size * s, borderRadius: '50%', background: c, filter: `blur(${size * 0.12}px)`, opacity: glow }} />
  );
  return (
    <div style={{ position: 'relative', width: size, height: size, transform: `scale(${breathe})` }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        {halo(Math.cos(a) * 0.08, 0.1 + Math.sin(a) * 0.06, 'rgba(122,95,255,0.55)', 0.95 + level * 0.25)}
        {halo(Math.cos(a + 2.1) * 0.1, 0.12 + Math.sin(a + 2.1) * 0.05, 'rgba(205,107,251,0.45)', 0.85 + level * 0.3)}
        {halo(Math.cos(a + 4.2) * 0.09, 0.14 + Math.sin(a + 4.2) * 0.04, 'rgba(66,153,225,0.35)', 0.8 + level * 0.2)}
      </div>
      <canvas ref={ref} width={RES} height={RES} style={{ width: size, height: size, borderRadius: '50%', display: 'block', position: 'relative', boxShadow: active > 0.5 ? '0 0 30px rgba(66,153,225,0.4)' : 'none' }} />
      <div style={{ position: 'absolute', left: (size - inner) / 2, top: (size - inner) / 2, width: inner, height: inner, borderRadius: '50%', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontSize: inner * 0.07, color: 'rgba(250,250,250,0.8)', marginBottom: inner * 0.05, fontVariantNumeric: 'tabular-nums' }}>{timer}</div>
        <div style={{ fontSize: inner * 0.32, lineHeight: 1, fontFamily: 'QEmoji' }}>📞</div>
      </div>
    </div>
  );
}
