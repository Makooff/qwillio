import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import ScaledDevice from './ios/ScaledDevice';
import { H, InCallScreen, IncomingCall, LockScreen, Notification, W, sf } from './ios/IosKit';

/**
 * L'illustration du hero (demande utilisateur: « les mockups iOS de la pub »,
 * deux iPhones animés en motion design, sans texte autour ni effet mauve).
 * Les écrans sont ceux des publicités, repris de video-promo par `ios/IosKit`,
 * et la mise en scène est celle de la vidéo c01:
 *   1. vous êtes en ligne avec un client;
 *   2. un deuxième appel sonne, ligne occupée;
 *   3. Qwillio le prend;
 *   4. la conversation s'écrit dans l'app;
 *   5. la réservation tombe.
 * Dessinée en DOM et animée par Framer Motion: transparente partout, iPhone
 * compris (une vidéo WebM à fond transparent s'y affichait sur fond noir).
 */

const EASE = [0.16, 1, 0.3, 1] as const;
const INDIGO = '#7A5FFF';
const STEPS = [
  { key: 'idle', ms: 1500 },
  { key: 'ring', ms: 2600 },
  { key: 'took', ms: 1700 },
  { key: 'live', ms: 6200 },
  { key: 'booked', ms: 3400 },
] as const;
type Step = (typeof STEPS)[number]['key'];

const TXT = {
  fr: {
    date: 'vendredi 14 novembre', lineBusy: 'ligne occupée', took: 'Qwillio a pris le 2e appel', booked: 'Nouvelle réservation',
    bookedDesc: 'Sophie Lambert · 2 personnes · 21:00', now: 'maintenant',
    keys: ['haut-parleur', 'FaceTime', 'silence', 'ajouter', 'clavier', 'fin'] as [string, string, string, string, string, string],
    lines: [
      { agent: false, t: 'Bonsoir, vous auriez encore une table pour deux, ce soir ?' },
      { agent: true, t: 'Bonsoir ! Oui, à vingt et une heures. C’est à quel nom ?' },
      { agent: false, t: 'Lambert. Sophie Lambert.' },
      { agent: true, t: 'C’est noté, Madame Lambert. À tantôt !' },
    ],
  },
  en: {
    date: 'Friday 14 November', lineBusy: 'line busy', took: 'Qwillio took the 2nd call', booked: 'New booking',
    bookedDesc: 'Sophie Lambert · 2 people · 21:00', now: 'now',
    keys: ['speaker', 'FaceTime', 'mute', 'add', 'keypad', 'end'] as [string, string, string, string, string, string],
    lines: [
      { agent: false, t: 'Good evening, would you still have a table for two tonight?' },
      { agent: true, t: 'Good evening! Yes, at nine o’clock. What name is it under?' },
      { agent: false, t: 'Lambert. Sophie Lambert.' },
      { agent: true, t: 'All set, Mrs Lambert. See you tonight!' },
    ],
  },
};

const WALL = '/ios-kit/wallpaper.webp';
const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** L'écran de l'app Qwillio pendant qu'elle répond, comme dans la pub (campaign.tsx, LiveCall). */
function LiveCall({ who, lines, sec }: { who: string; lines: { agent: boolean; t: string }[]; sec: number }) {
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
          {lines.slice(-3).map((l) => (
            <motion.div key={l.t} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0 } }}
              transition={{ duration: 0.5, ease: EASE }}
              style={{ alignSelf: l.agent ? 'flex-end' : 'flex-start', maxWidth: '86%', padding: '12px 16px', borderRadius: 22, fontSize: 21, lineHeight: '27px', background: l.agent ? INDIGO : '#fff', color: l.agent ? '#fff' : '#000' }}>
              {l.t}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

const drop = { initial: { opacity: 0, y: -18, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -10, scale: 0.98 } };

export default function HeroPhones({ isFr, className = '' }: { isFr: boolean; className?: string }) {
  const L = isFr ? TXT.fr : TXT.en;
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: '0px 0px -10% 0px' });
  const running = visible && !reduce;
  const [i, setI] = useState(0);
  const [lineCount, setLineCount] = useState(0);
  const [sec, setSec] = useState(134);
  const [liveSec, setLiveSec] = useState(0);
  const step: Step = reduce ? 'booked' : STEPS[i].key;

  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setI((n) => (n + 1) % STEPS.length), STEPS[i].ms);
    return () => clearTimeout(id);
  }, [i, running]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => { setSec((s) => s + 1); setLiveSec((s) => s + 1); }, 1000);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => {
    if (step !== 'live') { setLineCount(0); setLiveSec(0); return; }
    setLineCount(1);
    const ids = L.lines.slice(1).map((_, k) => setTimeout(() => setLineCount(k + 2), 1450 * (k + 1)));
    return () => ids.forEach(clearTimeout);
  }, [step, L.lines]);

  const banner = (
    <AnimatePresence mode="wait">
      {step === 'ring' && (
        <motion.div key="ring" {...drop} transition={{ type: 'spring', stiffness: 320, damping: 26 }}>
          <IncomingCall name="Sophie Lambert" initials="SL" sub={L.lineBusy} />
        </motion.div>
      )}
      {step === 'took' && (
        <motion.div key="took" {...drop} transition={{ duration: 0.45, ease: EASE }}>
          <Notification kind="qwillio" title={L.took} desc="Sophie Lambert" time={L.now} />
        </motion.div>
      )}
    </AnimatePresence>
  );

  /* le flottement: deux périodes différentes, pour que les téléphones ne bougent jamais ensemble */
  const float = (dur: number, delay: number) => (reduce ? {} : { animate: { y: [0, -8, 0] }, transition: { duration: dur, repeat: Infinity, ease: 'easeInOut' as const, delay } });

  return (
    <div ref={ref} className={`relative ${className}`} role="img"
      aria-label={isFr
        ? 'Illustration: vous êtes déjà en ligne, un deuxième appel arrive, Qwillio le prend, répond et la réservation arrive.'
        : 'Illustration: you are already on a call, a second call comes in, Qwillio takes it, answers and the booking arrives.'}>
      <div className="relative mx-auto flex w-full max-w-[520px] items-start justify-center gap-[7%] lg:mx-0" style={{ perspective: 1600 }}>
        {/* la rotation sur une enveloppe, le flottement dessous: Framer écrit `transform` en ligne */}
        <div className="w-[44%] mt-[8%]" style={{ transform: 'rotateY(14deg) rotateX(4deg) rotateZ(-3deg)', transformStyle: 'preserve-3d' }}>
          <motion.div {...float(6.5, 0)}>
            <ScaledDevice>
              <InCallScreen name="Marc Peeters" duration={clock(sec)} labels={L.keys} />
            </ScaledDevice>
          </motion.div>
        </div>
        <div className="w-[44%]" style={{ transform: 'rotateY(-14deg) rotateX(4deg) rotateZ(3deg)', transformStyle: 'preserve-3d' }}>
          <motion.div {...float(7.2, 1.1)}>
            <ScaledDevice>
              <div style={{ position: 'relative', width: W, height: H }}>
                <AnimatePresence initial={false}>
                  {step === 'live' ? (
                    <motion.div key="live" style={{ position: 'absolute', inset: 0 }} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.55, ease: EASE }}>
                      <LiveCall who="Sophie Lambert" lines={L.lines.slice(0, lineCount)} sec={liveSec} />
                    </motion.div>
                  ) : (
                    <motion.div key="lock" style={{ position: 'absolute', inset: 0 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.55, ease: EASE }}>
                      <LockScreen time="19:02" date={L.date} wallpaper={WALL} banner={banner}>
                        <AnimatePresence>
                          {step === 'booked' && (
                            <motion.div key="booked" initial={{ opacity: 0, y: 24, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 240, damping: 24 }}>
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
