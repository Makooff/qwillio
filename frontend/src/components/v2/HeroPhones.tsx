import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import ScaledDevice from './ios/ScaledDevice';
import { H, InCallScreen, LockScreen, Notification, W, sf } from './ios/IosKit';

/**
 * L'illustration du hero de l'accueil: l'expérience client EN ENTIER, pas une
 * fonctionnalité (demande utilisateur: le double appel « est une
 * fonctionnalité parmi d'autres »). Deux iPhones, deux côtés du même appel:
 *   - à gauche, la cliente qui appelle le restaurant, puis reçoit sa
 *     confirmation par SMS;
 *   - à droite, le gérant: Qwillio décroche, la conversation s'écrit mot à
 *     mot comme des sous-titres, puis la réservation et le résumé tombent.
 * Les écrans sont ceux des pubs (`ios/IosKit`). Les notifications vivent
 * dans la pile de l'écran verrouillé, là où iOS les pose: tout en haut, elles
 * passaient sous l'île et dans les coins arrondis de l'écran.
 */

const EASE = [0.16, 1, 0.3, 1] as const;
const INDIGO = '#7A5FFF';
const WORD_MS = 120;   // un mot toutes les 120 ms, le rythme d'une parole posée
const PAUSE_MS = 750;  // le silence entre deux répliques
const LEAD_MS = 350;

type Line = { agent: boolean; t: string };

const TXT = {
  fr: {
    date: 'vendredi 14 novembre', place: 'Le Comptoir', calling: 'appel…', keys: ['haut-parleur', 'FaceTime', 'silence', 'ajouter', 'clavier', 'fin'] as [string, string, string, string, string, string],
    ringTitle: 'Appel de Sophie Lambert', ringDesc: 'Qwillio décroche pour vous',
    booked: 'Nouvelle réservation', bookedDesc: 'Sophie Lambert · 2 personnes · 21:00',
    summary: 'Résumé de l’appel', summaryDesc: 'Table pour deux ce soir, a demandé le parking',
    sms: 'Réservation confirmée : ce soir 21:00, 2 personnes. À tantôt !', now: 'maintenant',
    lines: [
      { agent: false, t: 'Bonsoir, vous auriez une table pour deux ce soir ?' },
      { agent: true, t: 'Bonsoir ! Oui, à vingt et une heures. C’est à quel nom ?' },
      { agent: false, t: 'Lambert. Et il y a un parking ?' },
      { agent: true, t: 'Oui, juste derrière. C’est réservé, Madame Lambert, à ce soir !' },
    ] as Line[],
  },
  en: {
    date: 'Friday 14 November', place: 'Le Comptoir', calling: 'calling…', keys: ['speaker', 'FaceTime', 'mute', 'add', 'keypad', 'end'] as [string, string, string, string, string, string],
    ringTitle: 'Call from Sophie Lambert', ringDesc: 'Qwillio is answering for you',
    booked: 'New booking', bookedDesc: 'Sophie Lambert · 2 people · 21:00',
    summary: 'Call summary', summaryDesc: 'Table for two tonight, asked about parking',
    sms: 'Booking confirmed: tonight 21:00, 2 people. See you soon!', now: 'now',
    lines: [
      { agent: false, t: 'Good evening, would you have a table for two tonight?' },
      { agent: true, t: 'Good evening! Yes, at nine o’clock. What name is it under?' },
      { agent: false, t: 'Lambert. Is there any parking?' },
      { agent: true, t: 'Yes, just behind. You’re booked, Mrs Lambert, see you tonight!' },
    ] as Line[],
  },
};

/** Le calendrier de la conversation: quand chaque réplique commence, et combien elle dure. */
function schedule(lines: Line[]) {
  let at = LEAD_MS;
  const starts = lines.map((l) => {
    const s = at;
    at += l.t.split(' ').length * WORD_MS + PAUSE_MS;
    return s;
  });
  return { starts, total: at };
}

const WALL = '/ios-kit/wallpaper.webp';
const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** L'app Qwillio pendant qu'elle répond: les répliques s'écrivent mot à mot, comme des sous-titres. */
function LiveCall({ who, lines, starts, ms, sec }: { who: string; lines: Line[]; starts: number[]; ms: number; sec: number }) {
  const shown = lines
    .map((l, k) => {
      const words = l.t.split(' ');
      const n = Math.min(words.length, Math.floor((ms - starts[k]) / WORD_MS) + 1);
      return { ...l, k, text: words.slice(0, n).join(' '), on: ms >= starts[k] };
    })
    .filter((l) => l.on)
    .slice(-3);
  return (
    <div style={{ position: 'relative', width: W, height: H, background: '#F2F2F7', overflow: 'hidden', ...sf }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 70, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 100, background: '#fff', fontSize: 13, fontWeight: 600, color: INDIGO }}>
          <span style={{ width: 8, height: 8, borderRadius: 8, background: '#30D158' }} />QWILLIO · {`0:${String(sec).padStart(2, '0')}`}
        </div>
        <div style={{ fontSize: 26, fontWeight: 600, marginTop: 14, color: '#000', letterSpacing: -0.4 }}>{who}</div>
      </div>
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 60, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* pas de `layout`: dans un téléphone mis à l'échelle, Framer recalcule la taille
            des bulles et déforme leurs arrondis */}
        <AnimatePresence initial={false}>
          {shown.map((l) => (
            <motion.div key={l.k} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0 } }}
              transition={{ duration: 0.35, ease: EASE }}
              style={{ alignSelf: l.agent ? 'flex-end' : 'flex-start', maxWidth: '86%', padding: '12px 16px', borderRadius: 22, fontSize: 21, lineHeight: '27px', background: l.agent ? INDIGO : '#fff', color: l.agent ? '#fff' : '#000' }}>
              {l.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

const pop = { initial: { opacity: 0, y: 24, scale: 0.95 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0 } };
const spring = { type: 'spring' as const, stiffness: 260, damping: 24 };

export default function HeroPhones({ isFr, className = '' }: { isFr: boolean; className?: string }) {
  const L = isFr ? TXT.fr : TXT.en;
  const { starts, total } = useMemo(() => schedule(L.lines), [L]);
  const STEPS = useMemo(() => [
    { key: 'idle' as const, ms: 1300 },
    { key: 'ring' as const, ms: 2300 },
    { key: 'live' as const, ms: total + 500 },
    { key: 'booked' as const, ms: 4800 },
  ], [total]);
  type Step = (typeof STEPS)[number]['key'];

  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: '0px 0px -10% 0px' });
  const running = visible && !reduce;
  const [i, setI] = useState(0);
  const [ms, setMs] = useState(0);
  const step: Step = reduce ? 'booked' : STEPS[i].key;

  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setI((n) => (n + 1) % STEPS.length), STEPS[i].ms);
    return () => clearTimeout(id);
  }, [i, running, STEPS]);
  /* une seule horloge par étape: la durée affichée et les mots viennent d'elle */
  useEffect(() => {
    setMs(0);
    if (!running || step !== 'live') return;
    const t0 = performance.now();
    const id = setInterval(() => setMs(performance.now() - t0), 50);
    return () => clearInterval(id);
  }, [step, running]);
  const sec = Math.floor(ms / 1000);
  const onCall = step === 'ring' || step === 'live';

  /* le flottement: deux périodes différentes, pour que les téléphones ne bougent jamais ensemble */
  const float = (dur: number, delay: number) => (reduce ? {} : { animate: { y: [0, -8, 0] }, transition: { duration: dur, repeat: Infinity, ease: 'easeInOut' as const, delay } });
  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.5, ease: EASE } };

  return (
    <div ref={ref} className={`relative ${className}`} role="img"
      aria-label={isFr
        ? 'Illustration: une cliente appelle le restaurant, Qwillio décroche, répond à ses questions et réserve sa table; elle reçoit la confirmation, le gérant la réservation et le résumé.'
        : 'Illustration: a customer calls the restaurant, Qwillio answers, handles her questions and books her table; she gets the confirmation, the owner gets the booking and the summary.'}>
      <div className="relative mx-auto flex w-full max-w-[520px] items-start justify-center gap-[7%] lg:mx-0" style={{ perspective: 1600 }}>
        {/* la rotation sur une enveloppe, le flottement dessous: Framer écrit `transform` en ligne */}
        <div className="w-[44%] mt-[8%]" style={{ transform: 'rotateY(14deg) rotateX(4deg) rotateZ(-3deg)', transformStyle: 'preserve-3d' }}>
          <motion.div {...float(6.5, 0)}>
            <ScaledDevice>
              {/* LA CLIENTE: elle appelle, puis reçoit sa confirmation */}
              <div style={{ position: 'relative', width: W, height: H }}>
                <AnimatePresence initial={false}>
                  {onCall ? (
                    <motion.div key="call" style={{ position: 'absolute', inset: 0 }} {...fade}>
                      <InCallScreen name={L.place} duration={step === 'ring' ? L.calling : clock(sec)} labels={L.keys} />
                    </motion.div>
                  ) : (
                    <motion.div key="lock" style={{ position: 'absolute', inset: 0 }} {...fade}>
                      <LockScreen time="19:02" date={L.date} wallpaper={WALL}>
                        <AnimatePresence>
                          {step === 'booked' && (
                            <motion.div key="sms" {...pop} transition={{ ...spring, delay: reduce ? 0 : 0.5 }}>
                              <Notification kind="messages" title={L.place} desc={L.sms} time={L.now} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </LockScreen>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScaledDevice>
          </motion.div>
        </div>
        <div className="w-[44%]" style={{ transform: 'rotateY(-14deg) rotateX(4deg) rotateZ(3deg)', transformStyle: 'preserve-3d' }}>
          <motion.div {...float(7.2, 1.1)}>
            <ScaledDevice>
              {/* LE GÉRANT: Qwillio décroche, la conversation s'écrit, le résultat tombe */}
              <div style={{ position: 'relative', width: W, height: H }}>
                <AnimatePresence initial={false}>
                  {step === 'live' ? (
                    <motion.div key="live" style={{ position: 'absolute', inset: 0 }} {...fade}>
                      <LiveCall who="Sophie Lambert" lines={L.lines} starts={starts} ms={ms} sec={sec + 3} />
                    </motion.div>
                  ) : (
                    <motion.div key="lock" style={{ position: 'absolute', inset: 0 }} {...fade}>
                      <LockScreen time="19:02" date={L.date} wallpaper={WALL}>
                        <AnimatePresence>
                          {step === 'ring' && (
                            <motion.div key="ring" {...pop} transition={spring}>
                              <Notification kind="qwillio" title={L.ringTitle} desc={L.ringDesc} time={L.now} />
                            </motion.div>
                          )}
                          {step === 'booked' && (
                            <motion.div key="summary" {...pop} transition={{ ...spring, delay: reduce ? 0 : 0.9 }}>
                              <Notification kind="qwillio" title={L.summary} desc={L.summaryDesc} time={L.now} />
                            </motion.div>
                          )}
                          {step === 'booked' && (
                            <motion.div key="booked" {...pop} transition={{ ...spring, delay: reduce ? 0 : 0.3 }}>
                              <Notification kind="qwillio" title={L.booked} desc={L.bookedDesc} time={L.now} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </LockScreen>
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
