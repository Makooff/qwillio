import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { BarChart3, CalendarCheck, Home, MessageSquare, Phone, Settings } from 'lucide-react';

/* Illustration hero: le dashboard Qwillio rendu dans un iPhone 17 Pro,
   habillage iOS 26. Tout l'ecran est du vrai registre produit V2
   (void/carbon/obsidian, hairlines, indigo unique), les donnees sont
   celles d'un appel reel du runtime: creneau verifie, RDV inscrit,
   SMS envoye (tool-runtime.service.ts). Reactif: inclinaison 3D au
   pointeur (GSAP), flottement lent, sequence d'appel qui se rejoue.
   Exception DA documentee (v2-direction.md): la barre d'onglets
   translucide est une illustration d'iOS, pas du chrome UI du site. */

const EASE_TILT = 'power2.out';

export default function PhoneDashboard3D({ isFr, className = '' }: { isFr: boolean; className?: string }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLUListElement>(null);
  const islandDotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    const float = floatRef.current;
    const phone = phoneRef.current;
    if (!scene || !float || !phone) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const ctx = gsap.context(() => {
      /* Pose de repos legerement tournee: l'objet est en volume des le depart */
      gsap.set(phone, { rotateY: -14, rotateX: 6, transformPerspective: 1100 });

      /* Flottement lent sur le conteneur externe (independant du tilt) */
      gsap.to(float, { y: 9, duration: 3.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });

      /* Sequence d'appel: les actions du runtime apparaissent une a une,
         pause, puis la scene se rejoue. */
      const items = stepsRef.current ? Array.from(stepsRef.current.children) : [];
      if (items.length) {
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 2.6 });
        tl.set(items, { opacity: 0, y: 8 });
        tl.to(items, { opacity: 1, y: 0, duration: 0.5, stagger: 0.85, ease: 'power3.out' }, 0.8);
        if (islandDotRef.current) {
          gsap.to(islandDotRef.current, { opacity: 0.35, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' });
        }
      }

      /* Inclinaison au pointeur, ramenee a la pose de repos a la sortie */
      const onMove = (e: PointerEvent) => {
        const r = scene.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(phone, { rotateY: -14 + nx * 16, rotateX: 6 - ny * 12, duration: 0.6, ease: EASE_TILT });
      };
      const onLeave = () => {
        gsap.to(phone, { rotateY: -14, rotateX: 6, duration: 0.9, ease: EASE_TILT });
      };
      scene.addEventListener('pointermove', onMove);
      scene.addEventListener('pointerleave', onLeave);
      return () => {
        scene.removeEventListener('pointermove', onMove);
        scene.removeEventListener('pointerleave', onLeave);
      };
    }, scene);

    return () => ctx.revert();
  }, []);

  const steps = isFr
    ? [
        { icon: CalendarCheck, text: 'Créneau vérifié', detail: 'mar. 14:30' },
        { icon: CalendarCheck, text: 'RDV inscrit à l’agenda', detail: '' },
        { icon: MessageSquare, text: 'SMS de confirmation envoyé', detail: '' },
      ]
    : [
        { icon: CalendarCheck, text: 'Slot checked', detail: 'Tue 2:30 pm' },
        { icon: CalendarCheck, text: 'Booked to the calendar', detail: '' },
        { icon: MessageSquare, text: 'Confirmation text sent', detail: '' },
      ];

  return (
    <div ref={sceneRef} className={`relative flex justify-center ${className}`} aria-hidden="true">
      {/* Halo lilas/indigo derriere l'objet, decoratif */}
      <div
        className="absolute inset-0 -inset-x-16 pointer-events-none"
        style={{
          background:
            'radial-gradient(42% 46% at 52% 42%, rgba(122,95,255,0.16), transparent 70%), radial-gradient(30% 34% at 68% 66%, rgba(205,107,251,0.10), transparent 70%)',
        }}
      />

      <div ref={floatRef} className="relative" style={{ perspective: '1100px' }}>
        <div
          ref={phoneRef}
          className="relative w-[272px] sm:w-[300px]"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Chassis titane: cadre en degrade froid, coins concentriques iPhone 17 Pro */}
          <div
            className="rounded-[52px] p-[3px]"
            style={{
              background: 'linear-gradient(145deg, #d8d6dd 0%, #8e8c95 30%, #55535b 65%, #b9b7c0 100%)',
              boxShadow: '0 40px 90px rgba(20, 16, 50, 0.28), 0 12px 30px rgba(20, 16, 50, 0.18)',
            }}
          >
            <div className="rounded-[49px] bg-black p-[6px]">
              {/* Ecran */}
              <div className="relative overflow-hidden rounded-[43px] bg-q2-void">
                {/* Voile indigo du registre produit: le noir Qwillio n'est jamais neutre */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(180deg, rgba(122,95,255,0.06) 0%, transparent 40%)' }}
                />

                {/* Barre d'etat iOS */}
                <div className="relative flex items-center justify-between px-7 pt-3.5 text-white">
                  <span className="text-[12px] font-semibold tabular-nums">9:41</span>
                  <span className="flex items-center gap-1">
                    <span className="flex items-end gap-[1.5px]" style={{ height: 9 }}>
                      <span className="w-[3px] h-[4px] rounded-[1px] bg-white" />
                      <span className="w-[3px] h-[6px] rounded-[1px] bg-white" />
                      <span className="w-[3px] h-[8px] rounded-[1px] bg-white" />
                      <span className="w-[3px] h-[9px] rounded-[1px] bg-white/45" />
                    </span>
                    <span className="ml-1 w-[20px] h-[10px] rounded-[3px] border border-white/50 relative">
                      <span className="absolute inset-[1.5px] right-[5px] rounded-[1.5px] bg-white" />
                    </span>
                  </span>
                </div>

                {/* Dynamic Island: activite d'appel en cours */}
                <div className="absolute left-1/2 top-2 -translate-x-1/2 h-[26px] min-w-[92px] px-3 rounded-full bg-black flex items-center justify-center gap-1.5">
                  <span ref={islandDotRef} className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--q2p-ok)' }} />
                  <span className="text-[9px] font-medium text-white/85 tabular-nums">00:41</span>
                </div>

                {/* Contenu app: le dashboard V2, registre instrument */}
                <div className="relative px-4 pt-5 pb-6">
                  <div className="flex items-center justify-between mb-3.5 px-1">
                    <p className="text-[13px] font-normal tracking-tight text-white">
                      {isFr ? 'Vue d’ensemble' : 'Overview'}
                    </p>
                    <span className="text-[9.5px] text-q2-fog uppercase tracking-[0.08em]">Qwillio</span>
                  </div>

                  {/* Deux mesures, cards carbon hairline comme le vrai Overview */}
                  <div className="grid grid-cols-2 gap-2 mb-2.5">
                    <div className="bg-q2-carbon border border-q2-graphite-d rounded-xl p-2.5">
                      <p className="text-[8.5px] font-medium uppercase tracking-[0.08em] text-q2-fog mb-1">
                        {isFr ? 'Appels' : 'Calls'}
                      </p>
                      <p className="text-[19px] font-light text-white tabular-nums leading-none">12</p>
                    </div>
                    <div className="bg-q2-carbon border border-q2-graphite-d rounded-xl p-2.5">
                      <p className="text-[8.5px] font-medium uppercase tracking-[0.08em] text-q2-fog mb-1">
                        {isFr ? 'RDV pris' : 'Booked'}
                      </p>
                      <p className="text-[19px] font-light leading-none tabular-nums" style={{ color: 'var(--q2-lift)' }}>5</p>
                    </div>
                  </div>

                  {/* Appel en cours: Marie decroche, les actions se jouent en direct */}
                  <div className="bg-q2-carbon border border-q2-graphite-d rounded-xl p-3">
                    <div className="flex items-center gap-2.5 pb-2.5 border-b border-q2-graphite-d">
                      <img
                        src="/characters/marie.webp"
                        alt=""
                        loading="lazy"
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-white truncate">
                          {isFr ? 'Appel entrant · Mme Lefèvre' : 'Incoming call · Ms Lefèvre'}
                        </p>
                        <p className="text-[9.5px] text-q2-fog">
                          {isFr ? 'Marie répond' : 'Marie is answering'}
                        </p>
                      </div>
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-q2-indigo shrink-0" />
                    </div>
                    {/* Visible au repos (etat final): reduced-motion n'anime rien,
                        sinon GSAP rejoue l'apparition en boucle */}
                    <ul ref={stepsRef} className="pt-2 space-y-1.5">
                      {steps.map((s) => (
                        <li key={s.text} className="flex items-center gap-2">
                          <s.icon size={11} className="text-q2-lift shrink-0" />
                          <span className="text-[10px] text-q2-mist leading-tight">{s.text}</span>
                          {s.detail && (
                            <span className="ml-auto text-[9.5px] text-q2-fog tabular-nums shrink-0">{s.detail}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Barre d'onglets flottante iOS 26, translucide (illustration d'OS) */}
                  <div
                    className="mt-4 mx-2 h-11 rounded-full flex items-center justify-around border border-white/10"
                    style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
                  >
                    <Home size={15} className="text-white" />
                    <Phone size={15} className="text-q2-fog" />
                    <BarChart3 size={15} className="text-q2-fog" />
                    <Settings size={15} className="text-q2-fog" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tranche laterale: reflet titane cote droit pour asseoir le volume */}
          <div
            className="absolute top-[52px] -right-[2px] bottom-[52px] w-[2px] rounded-full opacity-60"
            style={{ background: 'linear-gradient(180deg, transparent, #cfcdd6 20%, #cfcdd6 80%, transparent)' }}
          />
        </div>
      </div>
    </div>
  );
}
