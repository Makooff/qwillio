import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { CalendarDays, MessageSquare, Users, Webhook } from '../icons';
import type { LucideIcon } from '../icons';
import QwillioLogo from '../QwillioLogo';
import { prefersReducedMotion } from './motion/reducedMotion';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin);

/* Ce à quoi elle est branchée: le logo au centre, les intégrations autour,
   reliées par des traits qui se tracent au scroll (DrawSVGPlugin, scrub).

   Uniquement des intégrations RÉELLES du produit. Les logos sont des icônes
   lucide dans une pastille blanche hairline, jamais des marques téléchargées:
   pas d'asset externe, pas de logo tiers détourné.

   Les quatre nœuds sont ancrés aux coins de la scène, donc aucun risque de
   débordement horizontal quelle que soit la largeur. Les tracés sont calculés
   à partir des positions mesurées (ResizeObserver), pas de coordonnées en
   dur. Statique en reduced-motion: traits déjà tracés, pas de pulsation. */

interface Node {
  id: string;
  icon: LucideIcon;
  label: string;
  noteFr: string;
  noteEn: string;
  /* Coin de la scène */
  corner: string;
  /* Sens de la courbure du trait, pour que les quatre ne soient pas jumelles */
  bend: number;
}

const NODES: Node[] = [
  {
    id: 'gcal',
    icon: CalendarDays,
    label: 'Google Calendar',
    noteFr: 'Créneaux lus et rendez-vous inscrits pendant l’appel',
    noteEn: 'Slots read and appointments booked during the call',
    corner: 'left-0 top-0',
    bend: -1,
  },
  {
    id: 'hubspot',
    icon: Users,
    label: 'HubSpot',
    noteFr: 'Le lead qualifié part dans votre CRM',
    noteEn: 'The qualified lead lands in your CRM',
    corner: 'right-0 top-0',
    bend: 1,
  },
  {
    id: 'sms',
    icon: MessageSquare,
    label: 'Twilio SMS',
    noteFr: 'Confirmation au client, brief à vous',
    noteEn: 'Confirmation to the customer, brief to you',
    corner: 'left-0 bottom-0',
    bend: 1,
  },
  {
    id: 'webhook',
    icon: Webhook,
    label: 'Webhook',
    noteFr: 'Zapier, Make, n8n via webhook',
    noteEn: 'Zapier, Make, n8n over webhook',
    corner: 'right-0 bottom-0',
    bend: -1,
  },
];

interface Geometry {
  w: number;
  h: number;
  paths: string[];
}

/* Course d'un éclat, du bord du hub au bord de la pastille. */
const TRAVEL_S = 1.9;
/* Temps mort avant que le même fil reparte. */
const REST_S = 1.15;
/* Décalage entre deux départs: les quatre ne partent pas en rang d'oignons. */
const DEPART_GAP_S = 0.62;

export default function IntegrationsOrbit({ isFr }: { isFr: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geometry | null>(null);
  const [reduced] = useState(prefersReducedMotion);

  /* Les extrémités viennent du DOM: la scène peut changer de forme sans
     qu'aucune coordonnée ne soit à retoucher ici. */
  const measure = useCallback(() => {
    const stage = stageRef.current;
    const hub = hubRef.current;
    if (!stage || !hub) return;
    const box = stage.getBoundingClientRect();
    if (box.width === 0) return;
    const hubBox = hub.getBoundingClientRect();
    const cx = hubBox.left - box.left + hubBox.width / 2;
    const cy = hubBox.top - box.top + hubBox.height / 2;
    const hubR = hubBox.width / 2;

    const paths = NODES.map((n) => {
      const el = stage.querySelector<HTMLElement>(`[data-orbit-node="${n.id}"]`);
      if (!el) return '';
      const nb = el.getBoundingClientRect();
      const nx = nb.left - box.left + nb.width / 2;
      const ny = nb.top - box.top + nb.height / 2;
      const dx = nx - cx;
      const dy = ny - cy;
      const dist = Math.hypot(dx, dy) || 1;
      /* On part du bord de la pastille centrale, on s'arrête au bord du nœud */
      const startGap = hubR + 10;
      const endGap = Math.min(nb.width, nb.height) / 2 + 8;
      const sx = cx + (dx / dist) * startGap;
      const sy = cy + (dy / dist) * startGap;
      const ex = nx - (dx / dist) * endGap;
      const ey = ny - (dy / dist) * endGap;
      /* Contrôle décalé perpendiculairement: une courbe douce, pas un rayon */
      const mx = (sx + ex) / 2 + (-dy / dist) * 26 * n.bend;
      const my = (sy + ey) / 2 + (dx / dist) * 26 * n.bend;
      return `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    });

    setGeo({ w: box.width, h: box.height, paths });
  }, []);

  useLayoutEffect(() => {
    measure();
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(stage);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !geo || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-orbit-line]',
        { drawSVG: '0%' },
        {
          drawSVG: '100%',
          ease: 'none',
          stagger: 0.12,
          scrollTrigger: { trigger: stage, start: 'top 82%', end: 'center 52%', scrub: 0.6 },
        },
      );
      /* Le groupe entier ne s'allume qu'une fois les fils tracés : un éclat qui
         court sur un trait pas encore dessiné se lit comme un bug. */
      gsap.to('[data-orbit-current-group]', {
        opacity: 1,
        ease: 'none',
        scrollTrigger: { trigger: stage, start: 'top 82%', end: 'center 52%', scrub: 0.6 },
      });

      /* Le courant, un nœud à la fois.
         Chaque trait porte un second tracé réduit à un tiret court
         (`pathLength=100` rend la mesure indépendante de la longueur réelle,
         donc les quatre éclats filent à la même vitesse malgré des courbes
         inégales). L'offset qui décroît pousse le tiret du hub vers le nœud :
         le courant part de Qwillio, il n'y revient pas.

         Deux corrections de la première version:
           - l'éclat NAÎT au départ et MEURT à l'arrivée (opacité menée dans la
             timeline). Sans ça, un tiret restait posé à l'entrée du fil entre
             deux passages, immobile, et se lisait comme un défaut de tracé;
           - l'anneau du nœud ne bat plus dans son coin: il est déclenché à
             l'instant où l'éclat le touche. C'est ce décalage qui raconte que
             quelque chose est ARRIVÉ, au lieu de deux animations qui tournent
             en parallèle sans rapport l'une avec l'autre. */
      NODES.forEach((n, i) => {
        const spark = stage.querySelector(`[data-orbit-current="${n.id}"]`);
        const ring = stage.querySelector(`[data-orbit-pulse="${n.id}"]`);
        const glow = stage.querySelector(`[data-orbit-glow="${n.id}"]`);
        if (!spark) return;

        /* L'éclat touche le bord de la pastille un cheveu avant la fin de sa
           course: c'est là que le nœud s'allume, pas à la fin de la timeline. */
        const ARRIVAL = TRAVEL_S - 0.18;

        gsap
          .timeline({ repeat: -1, repeatDelay: REST_S, delay: i * DEPART_GAP_S })
          .set(spark, { strokeDashoffset: 0, opacity: 0 })
          .to(spark, { opacity: 1, duration: 0.22, ease: 'none' }, 0)
          .to(spark, { strokeDashoffset: -100, duration: TRAVEL_S, ease: 'none' }, 0)
          .to(spark, { opacity: 0, duration: 0.26, ease: 'none' }, TRAVEL_S - 0.26)
          .fromTo(
            ring,
            { scale: 1, opacity: 0.9 },
            { scale: 1.65, opacity: 0, duration: 0.85, ease: 'power2.out' },
            ARRIVAL,
          )
          /* Le halo monte vite et redescend lentement: une pastille qui reçoit
             du courant, pas une pastille qui clignote. */
          .to(glow, { opacity: 1, duration: 0.18, ease: 'power2.out' }, ARRIVAL)
          .to(glow, { opacity: 0, duration: 1.1, ease: 'power2.out' }, ARRIVAL + 0.18);
      });
    }, stage);
    return () => ctx.revert();
  }, [geo]);

  return (
    <div
      ref={stageRef}
      className="relative w-full max-w-[560px] mx-auto aspect-square sm:aspect-[6/5]"
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full overflow-visible"
        viewBox={geo ? `0 0 ${geo.w} ${geo.h}` : undefined}
        fill="none"
      >
        {geo?.paths.map((d, i) =>
          d ? (
            <path
              key={NODES[i].id}
              data-orbit-line
              d={d}
              stroke="rgba(122, 95, 255, 0.34)"
              strokeWidth={1.25}
              strokeLinecap="round"
            />
          ) : null,
        )}
        {/* Le courant qui passe : un éclat court posé sur le même tracé. En
            reduced-motion il n'existe pas, les quatre fils restent des fils. */}
        {!reduced && (
          <g data-orbit-current-group style={{ opacity: 0 }}>
            {geo?.paths.map((d, i) =>
              d ? (
                <path
                  key={`current-${NODES[i].id}`}
                  data-orbit-current={NODES[i].id}
                  d={d}
                  pathLength={100}
                  stroke="rgba(150, 122, 255, 0.95)"
                  strokeWidth={1.9}
                  strokeLinecap="round"
                  strokeDasharray="9 91"
                  strokeDashoffset={0}
                  style={{ opacity: 0, filter: 'drop-shadow(0 0 4px rgba(122,95,255,0.8))' }}
                />
              ) : null,
            )}
          </g>
        )}
      </svg>

      {/* Lueur du centre: le hub est la source, les traits en partent */}
      <div
        aria-hidden="true"
        className="q2-halo absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] sm:w-[380px] sm:h-[380px]"
      />

      {/* Le hub: le logo tel quel, jamais redessiné */}
      <div
        ref={hubRef}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[76px] h-[76px] sm:w-[104px] sm:h-[104px] rounded-full bg-q2-canvas border border-q2-plate flex items-center justify-center shadow-[0_0_0_1px_rgba(122,95,255,0.12),0_18px_44px_-20px_rgba(122,95,255,0.6)]"
      >
        <QwillioLogo size={46} className="w-9 h-9 sm:w-[46px] sm:h-[46px]" />
      </div>

      {NODES.map((n) => (
        <div
          key={n.id}
          data-orbit-node={n.id}
          className={`q2-lit absolute ${n.corner} w-[120px] sm:w-[168px] rounded-[18px] bg-q2-canvas border border-q2-plate px-3 py-3 shadow-[var(--q2-shadow-whisper)]`}
        >
          {/* La pastille est éteinte au repos (retour utilisateur : les quatre
              halos allumés en permanence ne voulaient rien dire). Le halo et
              l'anneau sont réveillés par la timeline du fil correspondant, à la
              seconde où l'éclat arrive. */}
          <span className="relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-q2-band">
            <span
              data-orbit-glow={n.id}
              aria-hidden="true"
              className="absolute -inset-1.5 rounded-full"
              style={{
                opacity: 0,
                background: 'radial-gradient(closest-side, rgba(122,95,255,0.55), rgba(122,95,255,0) 100%)',
                willChange: 'opacity',
              }}
            />
            <n.icon size={15} className="relative text-q2-indigo" aria-hidden="true" />
            <span
              data-orbit-pulse={n.id}
              aria-hidden="true"
              className="absolute inset-0 rounded-full border border-q2-indigo/40 shadow-[0_0_10px_0_rgba(122,95,255,0.35)]"
              style={{ opacity: 0, willChange: 'transform, opacity' }}
            />
          </span>
          <p className="mt-2.5 text-[13px] font-medium text-q2-ink leading-tight">{n.label}</p>
          <p className="mt-1 text-[11.5px] leading-snug text-q2-body q2-body-text">
            {isFr ? n.noteFr : n.noteEn}
          </p>
        </div>
      ))}
    </div>
  );
}
