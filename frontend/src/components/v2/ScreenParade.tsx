import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PhoneIncoming, CalendarCheck, PhoneForwarded } from 'lucide-react';
import ChatConfigMock from './ChatConfigMock';

gsap.registerPlugin(ScrollTrigger);

/* Defile de vrais ecrans du produit poses en perspective. Chaque panneau
   est un rendu React fidele du registre dashboard (carbon, hairlines,
   un seul indigo), pas une capture floue. Parallaxe douce au scroll
   (GSAP ScrollTrigger, transform uniquement), plat si reduced-motion. */

const NB = ' ';

function CallsMock({ isFr }: { isFr: boolean }) {
  const rows = isFr
    ? [
        { icon: CalendarCheck, name: 'Mme Lefèvre', tag: 'RDV pris', time: `2${NB}min` },
        { icon: PhoneIncoming, name: 'N. Dubois', tag: 'Lead', time: `1${NB}min` },
        { icon: PhoneForwarded, name: 'Cabinet Ligne 2', tag: 'Transfert', time: `3${NB}min` },
        { icon: CalendarCheck, name: 'M. Peeters', tag: 'RDV pris', time: `2${NB}min` },
      ]
    : [
        { icon: CalendarCheck, name: 'Ms Lefèvre', tag: 'Booked', time: `2${NB}min` },
        { icon: PhoneIncoming, name: 'N. Dubois', tag: 'Lead', time: `1${NB}min` },
        { icon: PhoneForwarded, name: 'Office line 2', tag: 'Transfer', time: `3${NB}min` },
        { icon: CalendarCheck, name: 'Mr Peeters', tag: 'Booked', time: `2${NB}min` },
      ];
  return (
    <figure className="bg-q2-carbon border border-q2-graphite-d rounded-xl p-5">
      <figcaption className="q2-eyebrow text-q2-fog pb-4 border-b border-q2-graphite-d">
        {isFr ? 'Appels' : 'Calls'}
      </figcaption>
      <ul role="list">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-3 py-3 border-b border-q2-graphite-d last:border-b-0">
            <span className="w-7 h-7 shrink-0 rounded-lg bg-q2-obsidian flex items-center justify-center">
              <r.icon size={12} className="text-q2-lift" aria-hidden="true" />
            </span>
            <span className="text-[13px] text-q2-mist truncate">{r.name}</span>
            <span className="ml-auto text-[10.5px] text-q2-fog border border-q2-graphite-d rounded-full px-2 py-0.5 whitespace-nowrap">
              {r.tag}
            </span>
            <span className="text-[11.5px] text-q2-fog tabular-nums">{r.time}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function AnalyticsMock({ isFr }: { isFr: boolean }) {
  const bars = [34, 52, 44, 68, 58, 84, 74];
  return (
    <figure className="bg-q2-carbon border border-q2-graphite-d rounded-xl p-5">
      <figcaption className="flex items-baseline justify-between pb-4 border-b border-q2-graphite-d">
        <span className="q2-eyebrow text-q2-fog">{isFr ? 'Analytique' : 'Analytics'}</span>
        <span className="text-[11px] text-q2-fog">{isFr ? '7 jours' : '7 days'}</span>
      </figcaption>
      <div className="flex items-end gap-2 h-[110px] pt-5" aria-hidden="true">
        {bars.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${h}%`, background: i === 5 ? 'var(--q2-indigo)' : 'var(--q2-void)', border: '1px solid var(--q2-border-d)', borderBottom: 'none' }}
          />
        ))}
      </div>
      <p className="mt-4 pt-3 border-t border-q2-graphite-d flex items-baseline justify-between text-[12.5px]">
        <span className="text-q2-fog">{isFr ? 'RDV pris cette semaine' : 'Booked this week'}</span>
        <span className="text-white tabular-nums text-[15px] font-light">23</span>
      </p>
    </figure>
  );
}

export default function ScreenParade({ isFr }: { isFr: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const panels = Array.from(wrap.querySelectorAll<HTMLElement>('[data-parade-panel]'));
    const ctx = gsap.context(() => {
      panels.forEach((panel, i) => {
        gsap.fromTo(
          panel,
          { y: [46, 8, 62][i] ?? 30 },
          {
            y: [-26, -4, -38][i] ?? -16,
            ease: 'none',
            scrollTrigger: { trigger: wrap, start: 'top 88%', end: 'bottom 12%', scrub: 0.6 },
          },
        );
      });
    }, wrap);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={wrapRef} className="grid md:grid-cols-3 gap-5 md:gap-6 items-start" style={{ perspective: '1600px' }}>
      <div data-parade-panel style={{ transform: 'rotateY(7deg)', transformStyle: 'preserve-3d' }}>
        <CallsMock isFr={isFr} />
      </div>
      <div data-parade-panel className="md:-mt-6">
        <ChatConfigMock isFr={isFr} className="!p-5 [&_.q2-eyebrow]:text-q2-fog" />
      </div>
      <div data-parade-panel style={{ transform: 'rotateY(-7deg)', transformStyle: 'preserve-3d' }}>
        <AnalyticsMock isFr={isFr} />
      </div>
    </div>
  );
}
