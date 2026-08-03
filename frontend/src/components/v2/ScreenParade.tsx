import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* Defile de VRAIES captures du dashboard (frontend/public/screens/,
   prises sur le produit avec une session de demonstration), posees en
   perspective avec une parallaxe douce au scroll. Chaque capture porte
   sa legende: sur mobile, la pile garde du sens au lieu d'aligner des
   panneaux anonymes. Transform/opacity uniquement, plat si
   reduced-motion. */

interface Panel {
  src: string;
  labelFr: string;
  labelEn: string;
  captionFr: string;
  captionEn: string;
  tilt: number;
  fromY: number;
  toY: number;
  raise?: boolean;
}

const PANELS: Panel[] = [
  {
    src: '/screens/appels.webp',
    labelFr: 'Appels',
    labelEn: 'Calls',
    captionFr: 'Chaque appel arrive ici : issue, durée, transcript.',
    captionEn: 'Every call lands here: outcome, duration, transcript.',
    tilt: 7,
    fromY: 46,
    toY: -26,
  },
  {
    src: '/screens/chat-config.webp',
    labelFr: 'Chat de configuration',
    labelEn: 'Configuration chat',
    captionFr: 'Vous lui parlez, elle se règle.',
    captionEn: 'You talk, she adjusts.',
    tilt: 0,
    fromY: 8,
    toY: -4,
    raise: true,
  },
  {
    src: '/screens/analytique.webp',
    labelFr: 'Analytique',
    labelEn: 'Analytics',
    captionFr: 'Ce que vos appels rapportent, semaine après semaine.',
    captionEn: 'What your calls bring in, week after week.',
    tilt: -7,
    fromY: 62,
    toY: -38,
  },
];

export default function ScreenParade({ isFr }: { isFr: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const panels = Array.from(wrap.querySelectorAll<HTMLElement>('[data-parade-panel]'));
    const ctx = gsap.context(() => {
      panels.forEach((panel, i) => {
        const p = PANELS[i];
        gsap.fromTo(
          panel,
          { y: p?.fromY ?? 30 },
          {
            y: p?.toY ?? -16,
            ease: 'none',
            scrollTrigger: { trigger: wrap, start: 'top 88%', end: 'bottom 12%', scrub: 0.6 },
          },
        );
      });
    }, wrap);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={wrapRef} className="grid md:grid-cols-3 gap-10 md:gap-6 items-start" style={{ perspective: '1600px' }}>
      {PANELS.map((p) => (
        <figure
          key={p.src}
          data-parade-panel
          className={p.raise ? 'md:-mt-6' : ''}
          style={p.tilt ? { transform: `rotateY(${p.tilt}deg)`, transformStyle: 'preserve-3d' } : undefined}
        >
          <div className="rounded-xl overflow-hidden border border-q2-graphite-d bg-q2-carbon">
            <img
              src={p.src}
              alt={isFr ? `${p.labelFr} : capture du dashboard Qwillio` : `${p.labelEn}: Qwillio dashboard screenshot`}
              loading="lazy"
              className="w-full h-auto block"
            />
          </div>
          <figcaption className="mt-3 px-1">
            <span className="q2-eyebrow text-q2-graphite block mb-1">{isFr ? p.labelFr : p.labelEn}</span>
            <span className="text-[13px] text-q2-body q2-body-text">{isFr ? p.captionFr : p.captionEn}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
