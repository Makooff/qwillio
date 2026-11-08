import { useEffect, useRef } from 'react';

/* Le rond de l'appel en direct.
 *
 * Repris du fichier Figma Make « Shader Reminder » (7wYeHdH9iallsagJqpUmot) :
 *  - `flowingWavesShader` tel quel : neuf itérations de cosinus, une couleur
 *    divisée par |sin(t - y - x)|, le centre assombri à 30 % entre 0,3 et 0,5
 *    rayon, rien hors du cercle. Palette gris et noir (la neutre du
 *    fichier), un peu plus claire une fois l'appel établi ;
 *  - `CenterReminderDisplay` : disque de 70 %, noir à 30 %, flou 16 px, liseré
 *    blanc à 10 %, l'emoji d'appel au centre et le décompte au-dessus.
 * Ajout propre à Qwillio : le rond réagit à `level`, le niveau de la voix de
 * l'agent que le SDK émet déjà (`volume-level`). Quand elle parle, les vagues
 * accélèrent, se tordent davantage et s'éclairent ; quand elle écoute, elles
 * retombent. Pas d'ombre (demande utilisateur).
 *
 * C'est le même rond que dans la pub (video-promo/src/pub3/ShaderOrb.tsx). */

const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `
precision mediump float;
uniform vec2 iResolution;
uniform float iTime;
uniform float active;
uniform float level;
varying vec2 v;
void main() {
  vec2 fragCoord = v * iResolution;
  vec2 center = iResolution * 0.5;
  float dist = distance(fragCoord, center);
  float radius = min(iResolution.x, iResolution.y) * 0.5;
  if (dist >= radius) discard;
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);
  float centerDim = smoothstep(radius * 0.3, radius * 0.5, dist);
  float warp = 0.6 + 0.25 * level;
  for (float i = 1.0; i < 10.0; i++) {
    uv.x += warp / i * cos(i * 2.5 * uv.y + iTime);
    uv.y += warp / i * cos(i * 1.5 * uv.x + iTime);
  }
  // Gris et noir : la palette neutre du fichier, un peu plus claire une
  // fois l'appel pris et quand la voix monte.
  vec3 base = vec3(0.1 + 0.025 * active + 0.06 * level);
  vec3 col = base / abs(sin(iTime - uv.y - uv.x));
  col = mix(col * 0.3, col, centerDim);
  gl_FragColor = vec4(col, 1.0);
}`;

function useWaves(canvas: React.RefObject<HTMLCanvasElement | null>, active: boolean, level: number) {
  const activeRef = useRef(active ? 1 : 0);
  activeRef.current = active ? 1 : 0;
  const levelRef = useRef(level);
  levelRef.current = level;
  useEffect(() => {
    const el = canvas.current;
    const gl = el?.getContext('webgl', { premultipliedAlpha: false, antialias: true });
    if (!el || !gl) return;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, 'iResolution');
    const uTime = gl.getUniformLocation(prog, 'iTime');
    const uActive = gl.getUniformLocation(prog, 'active');
    const uLevel = gl.getUniformLocation(prog, 'level');

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let last = performance.now();
    let phase = 1.2;
    let lv = 0;
    let shown = activeRef.current;
    let raf = 0;
    const frame = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(el.clientWidth * dpr);
      if (el.width !== w) { el.width = w; el.height = w; }
      gl.viewport(0, 0, w, w);
      // La bascule de palette se fond en 600 ms au lieu de sauter.
      shown += (activeRef.current - shown) * 0.06;
      // La voix accélère les vagues et les tord : la phase est la somme des
      // vitesses passées, donc elle ne saute jamais quand le niveau change.
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      lv += (Math.min(1, levelRef.current) - lv) * 0.25;
      if (!reduced) phase += dt * (0.8 + 2.6 * lv);
      gl.uniform2f(uRes, w, w);
      gl.uniform1f(uTime, phase);
      gl.uniform1f(uActive, shown);
      gl.uniform1f(uLevel, lv);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    frame();
    return () => {
      cancelAnimationFrame(raf);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, [canvas]);
}

export default function CallOrb({
  size = 200,
  level = 0,
  active = false,
  label,
}: {
  size?: number;
  /** Niveau de la voix de l'agent, 0 à 1 (`volume-level` du SDK). */
  level?: number;
  /** L'appel est établi : palette plus vive. */
  active?: boolean;
  /** Ce qui s'affiche au-dessus de l'emoji, en général le décompte. */
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useWaves(ref, active, level);
  const l = Math.min(1, Math.max(0, level));
  const inner = size * 0.7;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{ transform: `scale(${1 + l * 0.035})`, transition: 'transform 120ms linear' }}
      >
        <canvas
          ref={ref}
          className="block rounded-full"
          style={{
            width: size,
            height: size,
            background: '#0A0A0C',
          }}
        />
        <div
          className="absolute rounded-full flex flex-col items-center justify-center"
          style={{
            left: (size - inner) / 2,
            top: (size - inner) / 2,
            width: inner,
            height: inner,
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {label && (
            <span className="tabular-nums" style={{ fontSize: Math.max(10, inner * 0.08), color: 'rgba(250,250,250,0.8)', marginBottom: inner * 0.05 }}>
              {label}
            </span>
          )}
          <span style={{ fontSize: inner * 0.32, lineHeight: 1 }}>📞</span>
        </div>
      </div>
    </div>
  );
}
