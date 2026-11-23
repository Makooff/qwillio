import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import ScaledDevice from './ios/ScaledDevice';
import { H, Notification, StatusBar, W, sf } from './ios/IosKit';

/**
 * L'illustration du hero de la page Réceptionniste (demande utilisateur: le
 * hero ressemblait trop à l'accueil, même phrase, même vidéo, ancienne
 * illustration). L'accueil montre le DOUBLE APPEL sur deux téléphones; ici un
 * seul iPhone montre ce que la page vend: le rendez-vous s'écrit dans
 * l'agenda PENDANT l'appel.
 *   1. l'appel est en cours, l'île dynamique affiche ce qui se dit;
 *   2. Qwillio regarde l'agenda, le créneau libre de midi s'allume;
 *   3. le rendez-vous s'inscrit;
 *   4. l'appel se termine, la notification tombe.
 * L'app Calendrier n'est pas dans le kit Figma: elle est recomposée à la
 * grille de la vue Jour d'iOS (barre rouge du système, bande de semaine,
 * heures à gauche). Transparente autour du téléphone, comme sur l'accueil.
 */

const EASE = [0.16, 1, 0.3, 1] as const;
const INDIGO = '#7A5FFF';
const RED = '#FF3B30';
const STEPS = [
  { key: 'call', ms: 2400 },
  { key: 'scan', ms: 1900 },
  { key: 'write', ms: 2600 },
  { key: 'done', ms: 3200 },
] as const;
type Step = (typeof STEPS)[number]['key'];

const TXT = {
  fr: {
    month: 'Novembre', days: ['L', 'M', 'M', 'J', 'V', 'S', 'D'], title: 'jeudi 26 novembre 2026',
    lines: { call: '« Un créneau jeudi, vers midi ? »', scan: 'Je regarde l’agenda…', write: '« Jeudi à midi, c’est noté. »' },
    caller: 'Julie Martin', service: 'Coupe brushing', added: 'Rendez-vous ajouté', addedDesc: 'Julie Martin · jeudi 26 · 12:00', now: 'maintenant',
    events: [['Coupe', 'Marc Dubois'], ['Couleur', 'Sarah Leroy'], ['Mèches', 'Inès Haddad'], ['Barbe', 'Tom Lemaire']],
  },
  en: {
    month: 'November', days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], title: 'Thursday 26 November 2026',
    lines: { call: '"Anything Thursday around noon?"', scan: 'Checking the calendar…', write: '"Thursday at noon, you’re booked."' },
    caller: 'Julie Martin', service: 'Cut and blow-dry', added: 'Appointment added', addedDesc: 'Julie Martin · Thu 26 · 12:00', now: 'now',
    events: [['Cut', 'Marc Dubois'], ['Colour', 'Sarah Leroy'], ['Highlights', 'Inès Haddad'], ['Beard', 'Tom Lemaire']],
  },
};

/* la vue Jour: une heure = 56 pt, 9 h posé à 220 pt du haut de l'écran */
const ROW = 56;
const y = (h: number) => 220 + (h - 9) * ROW;
const BOOKED: { from: number; to: number; color: string }[] = [
  { from: 9.5, to: 10.5, color: '#1C7CF2' },
  { from: 11, to: 12, color: '#F29A1C' },
  { from: 13.5, to: 15, color: '#34A853' },
  { from: 15.5, to: 16.5, color: '#2BB3C0' },
];
const SLOT = { from: 12, to: 13 }; // haut dans la journée: en fond de hero, le bas du téléphone est coupé

function EventBlock({ from, to, color, title, sub }: { from: number; to: number; color: string; title: string; sub: string }) {
  return (
    <div style={{ position: 'absolute', left: 64, right: 10, top: y(from) + 1, height: (to - from) * ROW - 2, borderRadius: 6, background: `color-mix(in srgb, ${color} 16%, #fff)`, padding: '5px 9px', ...sf }}>
      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: '17px', color }}>{title}</div>
      <div style={{ fontSize: 12, lineHeight: '16px', color, opacity: 0.8 }}>{sub}</div>
    </div>
  );
}

/** L'app Calendrier, vue Jour. */
function CalendarDay({ L, step }: { L: typeof TXT.fr; step: Step }) {
  const written = step === 'write' || step === 'done';
  return (
    <div style={{ position: 'relative', width: W, height: H, background: '#fff', overflow: 'hidden', ...sf }}>
      <StatusBar time="16:42" />
      {/* barre de navigation */}
      <div style={{ position: 'absolute', left: 10, right: 16, top: 66, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: RED }}>
        <span style={{ fontSize: 17, letterSpacing: -0.4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="12" height="20" viewBox="0 0 12 20"><path d="M10 2L2 10l8 8" stroke={RED} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {L.month}
        </span>
        <span style={{ display: 'flex', gap: 22 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2.2" strokeLinecap="round"><path d="M12 4v16M4 12h16" /></svg>
        </span>
      </div>
      {/* bande de la semaine: le 23 est aujourd'hui (rouge), le 26 est choisi (noir) */}
      <div style={{ position: 'absolute', left: 8, right: 8, top: 108, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' }}>
        {L.days.map((d, k) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(60,60,67,0.6)' }}>{d}</span>
            <span style={{ width: 34, height: 34, borderRadius: 34, display: 'grid', placeItems: 'center', fontSize: 19, fontWeight: k === 3 ? 600 : 400, background: k === 3 ? '#000' : 'transparent', color: k === 3 ? '#fff' : k === 0 ? RED : k > 4 ? 'rgba(60,60,67,0.6)' : '#000' }}>{23 + k}</span>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 172, textAlign: 'center', fontSize: 15, fontWeight: 500, color: '#000', letterSpacing: -0.2 }}>{L.title}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 202, height: 0.5, background: 'rgba(60,60,67,0.29)' }} />
      {/* la grille des heures */}
      {Array.from({ length: 11 }, (_, k) => 9 + k).map((h) => (
        <div key={h} style={{ position: 'absolute', left: 0, right: 0, top: y(h) - 8, height: 16, display: 'flex', alignItems: 'center' }}>
          <span style={{ width: 54, textAlign: 'right', fontSize: 11, color: 'rgba(60,60,67,0.6)', fontVariantNumeric: 'tabular-nums' }}>{`${String(h).padStart(2, '0')}:00`}</span>
          <span style={{ flex: 1, height: 0.5, marginLeft: 8, background: 'rgba(60,60,67,0.18)' }} />
        </div>
      ))}
      {BOOKED.map((e, k) => <EventBlock key={k} {...e} title={L.events[k][0]} sub={L.events[k][1]} />)}
      {/* le créneau libre que Qwillio a trouvé, puis le rendez-vous qui s'y écrit */}
      <AnimatePresence>
        {step === 'scan' && (
          <motion.div key="ghost" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.45, 1] }} exit={{ opacity: 0, transition: { duration: 0.2 } }} transition={{ duration: 1.6, ease: 'easeInOut' }}
            style={{ position: 'absolute', left: 64, right: 10, top: y(SLOT.from) + 1, height: (SLOT.to - SLOT.from) * ROW - 2, borderRadius: 6, border: `1.5px dashed ${INDIGO}`, background: `color-mix(in srgb, ${INDIGO} 6%, #fff)` }} />
        )}
        {written && (
          <motion.div key="event" initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0 round 6px)' }} animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0 round 6px)' }} exit={{ opacity: 0, transition: { duration: 0.35 } }} transition={{ duration: 0.7, ease: EASE }}
            style={{ position: 'absolute', left: 64, right: 10, top: y(SLOT.from) + 1, height: (SLOT.to - SLOT.from) * ROW - 2, borderRadius: 6, background: INDIGO, padding: '5px 9px', color: '#fff' }}>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: '17px' }}>{L.caller}</div>
            <div style={{ fontSize: 12, lineHeight: '16px', opacity: 0.85 }}>{L.service} · 12:00</div>
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 134, height: 5, marginLeft: -67, borderRadius: 100, background: '#000' }} />
    </div>
  );
}

/** L'île dynamique pendant l'appel: elle s'ouvre et dit ce qui se passe au téléphone. */
function CallIsland({ open, line, agent, sec }: { open: boolean; line: string; agent: boolean; sec: number }) {
  return (
    <motion.div
      initial={false}
      animate={open ? { width: 373, height: 104, borderRadius: 46 } : { width: 125, height: 37, borderRadius: 100 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      style={{ position: 'absolute', top: 11, left: '50%', x: '-50%', background: '#000', overflow: 'hidden', ...sf }}
    >
      <AnimatePresence>
        {open && (
          <motion.div key="in" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.18, duration: 0.3 } }} exit={{ opacity: 0, transition: { duration: 0.12 } }}
            style={{ position: 'absolute', inset: 0, padding: '16px 20px 0 18px', width: 373 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 26, height: 26, borderRadius: 26, background: '#FDFDFF', display: 'grid', placeItems: 'center', flex: 'none' }}>
                <img alt="" src="/qwillio-logo-512.svg" style={{ width: 24, height: 24 }} />
              </span>
              <span style={{ color: '#fff', fontSize: 15, fontWeight: 600, letterSpacing: -0.3 }}>Qwillio</span>
              <span style={{ color: 'rgba(235,235,245,0.6)', fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{`0:${String(sec).padStart(2, '0')}`}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3, height: 18 }}>
                {[0.5, 1, 0.7, 0.9, 0.45].map((h, k) => (
                  <motion.span key={k} animate={{ scaleY: [h, 0.3, 1, h] }} transition={{ duration: 0.9, repeat: Infinity, delay: k * 0.12, ease: 'easeInOut' }}
                    style={{ width: 3, height: 18, borderRadius: 3, background: '#30D158', display: 'block' }} />
                ))}
              </span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={line} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3, ease: EASE }}
                style={{ marginTop: 12, fontSize: 16, lineHeight: '21px', letterSpacing: -0.3, color: agent ? '#C4B6FF' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {line}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function HeroAgenda({ isFr, className = '', fill = false }: { isFr: boolean; className?: string; fill?: boolean }) {
  const L = isFr ? TXT.fr : TXT.en;
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: '0px 0px -10% 0px' });
  const running = visible && !reduce;
  const [i, setI] = useState(0);
  const [sec, setSec] = useState(8);
  const step: Step = reduce ? 'done' : STEPS[i].key;

  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setI((n) => (n + 1) % STEPS.length), STEPS[i].ms);
    return () => clearTimeout(id);
  }, [i, running]);
  useEffect(() => {
    if (!running || step === 'done') return;
    const id = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running, step]);
  useEffect(() => { if (step === 'call') setSec(8); }, [step]);

  const line = step === 'call' ? L.lines.call : step === 'scan' ? L.lines.scan : L.lines.write;

  return (
    <div ref={ref} className={`relative ${className}`} role="img"
      aria-label={isFr
        ? 'Illustration: pendant l’appel, Qwillio trouve un créneau libre et inscrit le rendez-vous dans l’agenda.'
        : 'Illustration: during the call, Qwillio finds a free slot and writes the appointment into the calendar.'}>
      {/* `fill`: le téléphone prend toute la largeur reçue, pour servir de fond au hero */}
      <div className={`relative mx-auto ${fill ? 'w-full' : 'w-[68%] max-w-[330px] sm:w-[52%] lg:w-[78%]'}`} style={{ perspective: 1600 }}>
        {/* la rotation sur une enveloppe, le flottement dessous: Framer écrit `transform` en ligne */}
        <div style={{ transform: 'rotateY(-12deg) rotateX(4deg) rotateZ(2deg)', transformStyle: 'preserve-3d' }}>
          <motion.div {...(reduce ? {} : { animate: { y: [0, -8, 0] }, transition: { duration: 6.8, repeat: Infinity, ease: 'easeInOut' as const } })}>
            <ScaledDevice>
              <div style={{ position: 'relative', width: W, height: H }}>
                <CalendarDay L={L} step={step} />
                <CallIsland open={step !== 'done'} line={line} agent={step !== 'call'} sec={sec} />
                <AnimatePresence>
                  {step === 'done' && (
                    <motion.div key="added" style={{ position: 'absolute', left: 10, top: 58 }}
                      initial={{ opacity: 0, y: -24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 26, delay: reduce ? 0 : 0.35 }}>
                      <Notification kind="qwillio" title={L.added} desc={L.addedDesc} time={L.now} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScaledDevice>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
