import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Camera, Mic, Phone, PhoneOff, Plus, Volume2 } from '../icons';
import QwillioLogo from '../QwillioLogo';

/**
 * L'illustration qui referme le hero (demande utilisateur: « une illustration
 * qui remplace l'ancienne, avec deux iPhone animés en motion design smooth »,
 * sans texte autour ni effet mauve). Dessinée en DOM et animée par Framer
 * Motion, pas en vidéo: une vidéo à fond transparent s'affichait sur fond NOIR
 * sur iPhone, WebKit ignorant la couche alpha du WebM.
 *
 * À gauche, votre téléphone: vous êtes déjà en ligne. À droite, la ligne que
 * Qwillio tient: le deuxième appel arrive, elle le prend, la conversation
 * s'écrit, la réservation tombe. Puis la boucle recommence.
 */

const EASE = [0.16, 1, 0.3, 1] as const;
/* Les temps de la boucle, en millisecondes. Le dernier ramène au premier. */
const STEPS = [
  { key: 'idle', ms: 1400 },
  { key: 'ring', ms: 2400 },
  { key: 'took', ms: 1500 },
  { key: 'live', ms: 5600 },
  { key: 'booked', ms: 3200 },
] as const;
type Step = (typeof STEPS)[number]['key'];

const TXT = {
  fr: {
    incoming: 'Appel entrant', waiting: 'Sophie Lambert · en attente', took: 'Qwillio a répondu', tookDesc: 'Sophie Lambert',
    booked: 'Nouvelle réservation', bookedDesc: 'Sophie Lambert · 2 pers. · 21:00', now: 'maintenant', date: 'vendredi 14 novembre',
    lines: [
      { me: false, t: 'Bonsoir, vous auriez une table pour deux ce soir ?' },
      { me: true, t: 'Bonsoir ! Oui, à 21 h. À quel nom ?' },
      { me: false, t: 'Lambert. Sophie Lambert.' },
      { me: true, t: 'C’est noté, Madame Lambert. À tantôt !' },
    ],
  },
  en: {
    incoming: 'Incoming call', waiting: 'Sophie Lambert · waiting', took: 'Qwillio answered', tookDesc: 'Sophie Lambert',
    booked: 'New booking', bookedDesc: 'Sophie Lambert · 2 people · 21:00', now: 'now', date: 'Friday 14 November',
    lines: [
      { me: false, t: 'Good evening, do you have a table for two tonight?' },
      { me: true, t: 'Good evening! Yes, at 9 p.m. What name is it under?' },
      { me: false, t: 'Lambert. Sophie Lambert.' },
      { me: true, t: 'All set, Mrs Lambert. See you tonight!' },
    ],
  },
};

/** La coque: un liseré de titane, un verre noir, l'île dynamique. */
function Shell({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className="relative w-full aspect-[9/19] rounded-[16%/7.6%] bg-[#1d1d1f] p-[3.2%] shadow-[0_44px_70px_-34px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.06)_inset]">
      <div className={`relative h-full w-full overflow-hidden rounded-[13%/6.2%] ${dark ? 'bg-[#0b0b0c]' : 'bg-[#f2f2f7]'}`}>
        {children}
        <div className="absolute left-1/2 top-[1.6%] h-[3.4%] w-[31%] -translate-x-1/2 rounded-full bg-black" />
      </div>
    </div>
  );
}

function StatusBar({ time, light = false }: { time: string; light?: boolean }) {
  return (
    <div className={`absolute inset-x-0 top-[2%] flex items-center justify-between px-[9%] text-[clamp(8px,1.1vw,11px)] font-semibold ${light ? 'text-white' : 'text-black'}`}>
      <span>{time}</span>
      <span className="flex items-center gap-[3px]">
        <span className={`h-[6px] w-[14px] rounded-[2px] border ${light ? 'border-white/80' : 'border-black/70'} p-[1px]`}><span className={`block h-full w-3/4 rounded-[1px] ${light ? 'bg-white' : 'bg-black'}`} /></span>
      </span>
    </div>
  );
}

/** Le téléphone du gérant: un appel en cours, le minuteur avance. */
function YourPhone({ step, L, running }: { step: Step; L: (typeof TXT)['fr']; running: boolean }) {
  const [sec, setSec] = useState(134);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const keys = [Volume2, Camera, Mic, Plus, null];
  return (
    <Shell dark>
      <StatusBar time="19:02" light />
      <AnimatePresence>
        {step === 'ring' && (
          <motion.div key="wait" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.45, ease: EASE }}
            className="absolute left-[7%] right-[7%] top-[8%] rounded-full bg-white/[0.12] px-[6%] py-[3%] text-center text-[clamp(7px,0.95vw,10px)] font-medium text-white/85">
            {L.waiting}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute inset-x-0 top-[19%] text-center text-white">
        <div className="text-[clamp(8px,1vw,10px)] tabular-nums text-white/55">{`${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`}</div>
        <div className="mt-[2%] text-[clamp(13px,1.9vw,19px)] font-medium tracking-[-0.01em]">Marc Peeters</div>
      </div>
      <div className="absolute inset-x-[12%] top-[52%] grid grid-cols-3 gap-[9%]">
        {keys.map((K, i) => (
          <span key={i} className="mx-auto flex aspect-square w-full max-w-[44px] items-center justify-center rounded-full bg-white/[0.12] text-white">
            {K ? <K size={14} aria-hidden="true" /> : <span className="grid grid-cols-3 gap-[2px]">{Array.from({ length: 9 }, (_, j) => <span key={j} className="h-[3px] w-[3px] rounded-full bg-white" />)}</span>}
          </span>
        ))}
        <span className="mx-auto flex aspect-square w-full max-w-[44px] items-center justify-center rounded-full bg-[#ff3b30] text-white"><PhoneOff size={14} aria-hidden="true" /></span>
      </div>
      <div className="absolute bottom-[2%] left-1/2 h-[0.6%] w-[34%] -translate-x-1/2 rounded-full bg-white/80" />
    </Shell>
  );
}

function NotifCard({ title, desc, now }: { title: string; desc: string; now: string }) {
  return (
    <div className="flex items-center gap-[6%] rounded-[18px] bg-white/85 px-[6%] py-[5%] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)] backdrop-blur">
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-white"><QwillioLogo size={20} /></span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[clamp(8px,1vw,11px)] font-semibold text-black">{title}</span>
          <span className="shrink-0 text-[clamp(6px,0.8vw,9px)] text-black/45">{now}</span>
        </span>
        <span className="block truncate text-[clamp(7px,0.9vw,10px)] text-black/70">{desc}</span>
      </span>
    </div>
  );
}

/** La ligne que tient Qwillio: écran verrouillé, appel, conversation, réservation. */
function QwillioPhone({ step, L, lineCount }: { step: Step; L: (typeof TXT)['fr']; lineCount: number }) {
  const lock = step !== 'live';
  return (
    <Shell>
      <AnimatePresence mode="wait" initial={false}>
        {lock ? (
          <motion.div key="lock" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE }}
            className="absolute inset-0 bg-[linear-gradient(170deg,#f4f2ef_0%,#e4e0db_55%,#d4cfc8_100%)]">
            <StatusBar time="19:02" />
            <div className="absolute inset-x-0 top-[13%] text-center text-[#1d1d1f]">
              <div className="text-[clamp(7px,0.95vw,10px)] font-medium text-black/50">{L.date}</div>
              <div className="text-[clamp(30px,4.6vw,50px)] font-medium leading-none tracking-[-0.03em]">19:02</div>
            </div>
            <div className="absolute inset-x-[5%] bottom-[14%]">
              <AnimatePresence>
                {step === 'booked' && (
                  <motion.div key="booked" initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
                    <NotifCard title={L.booked} desc={L.bookedDesc} now={L.now} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="absolute inset-x-[5%] top-[6.5%]">
              <AnimatePresence mode="wait">
                {step === 'ring' && (
                  <motion.div key="ring" initial={{ opacity: 0, y: -14, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                    className="flex items-center gap-[5%] rounded-full bg-black px-[4%] py-[3.2%] text-white">
                    <span className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full bg-[#8e8e93] text-[9px] font-semibold">SL</span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[clamp(8px,1vw,11px)] font-medium">Sophie Lambert</span>
                      <span className="block text-[clamp(6px,0.8vw,9px)] text-white/55">{L.incoming}</span>
                    </span>
                    <motion.span animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 0.9, repeat: Infinity }} className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#34c759]"><Phone size={11} aria-hidden="true" /></motion.span>
                  </motion.div>
                )}
                {step === 'took' && (
                  <motion.div key="took" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.45, ease: EASE }}>
                    <NotifCard title={L.took} desc={L.tookDesc} now={L.now} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          <motion.div key="live" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE }} className="absolute inset-0 bg-[#f2f2f7]">
            <StatusBar time="19:02" />
            <div className="absolute inset-x-0 top-[9%] flex flex-col items-center gap-[2px]">
              <span className="flex items-center gap-1 rounded-full bg-white px-2 py-[2px] text-[clamp(6px,0.75vw,8px)] font-semibold uppercase tracking-[0.08em] text-black/60">
                <span className="h-[5px] w-[5px] rounded-full bg-[#34c759]" />Qwillio
              </span>
              <span className="text-[clamp(9px,1.15vw,12px)] font-semibold text-black">Sophie Lambert</span>
            </div>
            <div className="absolute inset-x-[5%] bottom-[5%] flex flex-col gap-[5px]">
              <AnimatePresence initial={false}>
                {L.lines.slice(0, lineCount).map((l, i) => (
                  <motion.div key={i} layout initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    className={`max-w-[84%] rounded-[12px] px-[7%] py-[4%] text-[clamp(7px,0.9vw,10px)] leading-snug ${l.me ? 'self-end bg-[#1d1d1f] text-white' : 'self-start bg-white text-black'}`}>
                    {l.t}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute bottom-[2%] left-1/2 h-[0.6%] w-[34%] -translate-x-1/2 rounded-full bg-black/70" />
    </Shell>
  );
}

export default function HeroPhones({ isFr, className = '' }: { isFr: boolean; className?: string }) {
  const L = isFr ? TXT.fr : TXT.en;
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: '0px 0px -10% 0px' });
  const [i, setI] = useState(reduce ? 4 : 0);
  const [lineCount, setLineCount] = useState(0);
  const step = STEPS[i].key;
  const running = visible && !reduce;

  // la boucle: on n'avance que si l'illustration est à l'écran
  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setI((n) => (n + 1) % STEPS.length), STEPS[i].ms);
    return () => clearTimeout(id);
  }, [i, running]);
  // la conversation s'écrit une réplique après l'autre
  useEffect(() => {
    if (step !== 'live') { setLineCount(0); return; }
    if (!running) { setLineCount(L.lines.length); return; }
    setLineCount(1);
    const ids = L.lines.slice(1).map((_, k) => setTimeout(() => setLineCount(k + 2), 1250 * (k + 1)));
    return () => ids.forEach(clearTimeout);
  }, [step, running, L.lines]);

  const float = (delay: number) => (reduce ? {} : { animate: { y: [0, -7, 0] }, transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' as const, delay } });
  return (
    <div ref={ref} className={`relative ${className}`} role="img"
      aria-label={isFr
        ? 'Illustration: vous êtes déjà en ligne, un deuxième appel arrive, Qwillio le prend, répond et la réservation arrive.'
        : 'Illustration: you are already on a call, a second call comes in, Qwillio takes it, answers and the booking arrives.'}>
      <div className="relative mx-auto flex w-full max-w-[520px] items-end justify-center gap-[6%] lg:mx-0">
        {/* l'inclinaison sur un enveloppe, le flottement dessous: Framer écrit
            `transform` en ligne et effacerait une rotation Tailwind posée au même endroit */}
        <div className="w-[42%] -rotate-[4deg] translate-y-[6%]">
          <motion.div {...float(0)}><YourPhone step={step} L={L} running={running} /></motion.div>
        </div>
        <div className="w-[42%] rotate-[3deg]">
          <motion.div {...float(1.2)}><QwillioPhone step={step} L={L} lineCount={lineCount} /></motion.div>
        </div>
      </div>
    </div>
  );
}
