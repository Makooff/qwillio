import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion } from './reducedMotion';

/* Fond « pixel blush »: quatre grands cercles radiaux (rose pâle, lilas,
   indigo) posés sur le canvas #FDFCFC, floutés à 80-120px et dérivant très
   lentement en boucle. C'est le seul décor du hero: il reste sous la
   lisibilité du texte (opacités 0.22-0.46, aucun contraste altéré).

   Le mauve de marque (#7A5FFF indigo, #CD6BFB violet) est ici délavé, jamais
   saturé: sur registre clair la couleur vit dans les visuels, pas dans le
   chrome (DA/v2-direction.md).

   Perf: seuls x/y sont animés (transform), chaque blob est promu en couche
   par will-change, le flou n'est donc rasterisé qu'une fois. Statique en
   reduced-motion: aucun timeline créé, les cercles gardent leur pose. */

interface Blob {
  /* Pose de départ en pourcentage du conteneur */
  top: string;
  left: string;
  /* Diamètre en px avant flou */
  size: number;
  /* Couleur en composantes RVB, l'alpha vient de `o` */
  rgb: string;
  o: number;
  blur: number;
  /* Amplitude de dérive en px */
  dx: number;
  dy: number;
  /* Durée d'un aller simple, la boucle yoyo double la période */
  dur: number;
}

const BLOBS: Blob[] = [
  { top: '-24%', left: '-12%', size: 620, rgb: '205, 107, 251', o: 0.26, blur: 110, dx: 58, dy: 44, dur: 26 },
  { top: '-16%', left: '44%', size: 560, rgb: '122, 95, 255', o: 0.22, blur: 100, dx: -52, dy: 58, dur: 21 },
  { top: '18%', left: '68%', size: 480, rgb: '247, 199, 232', o: 0.46, blur: 92, dx: 44, dy: -48, dur: 30 },
  { top: '44%', left: '2%', size: 520, rgb: '185, 168, 255', o: 0.3, blur: 120, dx: -46, dy: -40, dur: 18 },
];

/* Bruit léger: une turbulence SVG en data URI, 3 % d'opacité. Casse le banding
   des dégradés très larges sans salir la surface. */
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

interface PixelBlushBackdropProps {
  className?: string;
  /* Multiplicateur global d'opacité, pour poser le même fond en sourdine */
  intensity?: number;
  /* Voile de bruit, actif par défaut */
  noise?: boolean;
}

export default function PixelBlushBackdrop({
  className = '',
  intensity = 1,
  noise = true,
}: PixelBlushBackdropProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const nodes = gsap.utils.toArray<HTMLElement>('[data-blush-blob]');
      nodes.forEach((node, i) => {
        const b = BLOBS[i];
        if (!b) return;
        gsap.to(node, {
          x: b.dx,
          y: b.dy,
          duration: b.dur,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: i * 1.4,
        });
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {BLOBS.map((b, i) => (
        <div
          key={i}
          data-blush-blob
          className="absolute rounded-full"
          style={{
            top: b.top,
            left: b.left,
            width: b.size,
            height: b.size,
            opacity: Math.min(1, b.o * intensity),
            filter: `blur(${b.blur}px)`,
            willChange: 'transform',
            background: `radial-gradient(circle at 50% 50%, rgba(${b.rgb}, 0.9) 0%, rgba(${b.rgb}, 0.42) 46%, rgba(${b.rgb}, 0) 72%)`,
          }}
        />
      ))}
      {noise && (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: NOISE, backgroundRepeat: 'repeat', opacity: 0.03 }}
        />
      )}
    </div>
  );
}
