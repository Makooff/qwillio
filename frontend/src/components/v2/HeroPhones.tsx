import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import ScaledDevice from './ios/ScaledDevice';
import { H, LockScreen, Notification, W, sf } from './ios/IosKit';

/**
 * L'illustration du hero de l'accueil: « une journée de votre ligne »
 * (stratégie marketing du 23/11: montrer tout ce que fait un appel, pas
 * seulement le rendez-vous, et pas seulement la restauration).
 *   - à gauche, l'app Qwillio pendant l'appel: ce que dit l'appelant puis ce
 *     qu'elle répond, mot à mot comme des sous-titres;
 *   - à droite, l'écran verrouillé du gérant: l'issue de chaque appel tombe en
 *     notification et s'empile, un métier et une issue différents à chaque fois
 *     (urgence transférée, rendez-vous déplacé, message, question répondue,
 *     demande de devis).
 * Les écrans sont ceux des pubs (`ios/IosKit`); les notifications vivent dans
 * la pile de l'écran verrouillé, là où iOS les pose.
 */

const EASE = [0.16, 1, 0.3, 1] as const;
const INDIGO = '#7A5FFF';
const WORD_MS = 115;
const GAP_MS = 550;     // le silence entre la question et la réponse
const HOLD_MS = 1500;   // la notification posée, avant l'appel suivant
const STACK = 4;        // notifications visibles en même temps

type Scene = { biz: string; who: string; caller: string; agent: string; title: string; desc: string };

const SCENES: Record<'fr' | 'en', Scene[]> = {
  fr: [
    { biz: 'Plomberie Dubois', who: 'Anne Peeters', caller: 'J’ai une fuite sous l’évier, l’eau coule partout !', agent: 'Je vous passe M. Dubois tout de suite, je lui résume la situation.', title: 'Urgence transférée', desc: 'Anne Peeters · fuite sous l’évier' },
    { biz: 'Kiné Lemaire', who: 'Marc Janssens', caller: 'Je ne peux pas venir mardi, on peut décaler ?', agent: 'Bien sûr. Jeudi à 17 h 30, ça vous convient ?', title: 'Rendez-vous déplacé', desc: 'Marc Janssens · mar. 9:00 → jeu. 17:30' },
    { biz: 'Fiduciaire Martin', who: 'Paul Lambert', caller: 'Je voudrais parler à Marie, c’est pour ma TVA.', agent: 'Elle est en rendez-vous. Je lui laisse le message, elle vous rappelle après 17 h.', title: 'Message pour Marie', desc: 'Paul Lambert · TVA · rappeler après 17 h' },
    { biz: 'Le Comptoir', who: 'Sophie Laurent', caller: 'Vous êtes ouverts dimanche midi ?', agent: 'Oui, de midi à quatorze heures. Je vous réserve une table ?', title: 'Question répondue', desc: 'Ouvert dimanche midi ? Oui, 12:00 à 14:00' },
    { biz: 'Garage Renard', who: 'Tom Wouters', caller: 'Il me faudrait des pneus hiver pour une Golf.', agent: 'Je note la demande de devis, l’atelier vous rappelle demain matin.', title: 'Demande de devis', desc: 'Tom Wouters · pneus hiver, Golf' },
  ],
  en: [
    { biz: 'Dubois Plumbing', who: 'Anne Peeters', caller: 'There’s a leak under my sink, water everywhere!', agent: 'I’m putting you through to Mr Dubois now, with a quick summary.', title: 'Urgent call transferred', desc: 'Anne Peeters · leak under the sink' },
    { biz: 'Lemaire Physio', who: 'Marc Janssens', caller: 'I can’t make Tuesday, can we move it?', agent: 'Of course. Thursday at 5:30 pm, does that work?', title: 'Appointment moved', desc: 'Marc Janssens · Tue 9:00 → Thu 17:30' },
    { biz: 'Martin Accountants', who: 'Paul Lambert', caller: 'I’d like to speak to Marie, it’s about my VAT.', agent: 'She’s with a client. I’ll pass it on, she’ll call you back after 5 pm.', title: 'Message for Marie', desc: 'Paul Lambert · VAT · call back after 5 pm' },
    { biz: 'Le Comptoir', who: 'Sophie Laurent', caller: 'Are you open for Sunday lunch?', agent: 'Yes, from noon to two. Shall I book you a table?', title: 'Question answered', desc: 'Open Sunday lunch? Yes, 12:00 to 14:00' },
    { biz: 'Renard Garage', who: 'Tom Wouters', caller: 'I need winter tyres for a Golf.', agent: 'I’ve noted the quote request, the workshop will call you tomorrow morning.', title: 'Quote request', desc: 'Tom Wouters · winter tyres, Golf' },
  ],
};

const words = (s: string) => s.split(' ').length;
/** Quand la réponse commence, quand la notification tombe, quand l'appel suivant démarre. */
function timing(s: Scene) {
  const agentAt = words(s.caller) * WORD_MS + GAP_MS;
  const doneAt = agentAt + words(s.agent) * WORD_MS + 350;
  return { agentAt, doneAt, total: doneAt + HOLD_MS };
}

const WALL = '/ios-kit/wallpaper.webp';
const typed = (text: string, ms: number) => {
  if (ms < 0) return '';
  const w = text.split(' ');
  return w.slice(0, Math.min(w.length, Math.floor(ms / WORD_MS) + 1)).join(' ');
};

/** L'app Qwillio pendant l'appel: les deux répliques s'écrivent mot à mot, comme des sous-titres. */
function LiveCall({ scene, ms }: { scene: Scene; ms: number }) {
  const { agentAt } = timing(scene);
  const bubbles = [
    { agent: false, text: typed(scene.caller, ms) },
    { agent: true, text: typed(scene.agent, ms - agentAt) },
  ].filter((b) => b.text);
  return (
    <div style={{ position: 'relative', width: W, height: H, background: '#F2F2F7', overflow: 'hidden', ...sf }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 70, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 100, background: '#fff', fontSize: 13, fontWeight: 600, color: INDIGO }}>
          <span style={{ width: 8, height: 8, borderRadius: 8, background: '#30D158' }} />QWILLIO · {scene.biz.toUpperCase()}
        </div>
        <div style={{ fontSize: 26, fontWeight: 600, marginTop: 14, color: '#000', letterSpacing: -0.4 }}>{scene.who}</div>
      </div>
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 60, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* pas de `layout`: dans un téléphone mis à l'échelle, Framer recalcule la taille
            des bulles et déforme leurs arrondis */}
        {bubbles.map((b) => (
          <motion.div key={`${scene.who}-${b.agent}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}
            style={{ alignSelf: b.agent ? 'flex-end' : 'flex-start', maxWidth: '86%', padding: '12px 16px', borderRadius: 22, fontSize: 21, lineHeight: '27px', background: b.agent ? INDIGO : '#fff', color: b.agent ? '#fff' : '#000' }}>
            {b.text}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function HeroPhones({ isFr, className = '' }: { isFr: boolean; className?: string }) {
  const scenes = SCENES[isFr ? 'fr' : 'en'];
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: '0px 0px -10% 0px' });
  const running = visible && !reduce;
  const [k, setK] = useState(0);     // l'appel en cours, compté depuis le début de la boucle
  const [ms, setMs] = useState(0);   // le temps écoulé dans cet appel
  const scene = scenes[k % scenes.length];
  const { doneAt, total } = timing(scene);

  /* une horloge par appel: les mots et la notification viennent d'elle */
  useEffect(() => {
    if (!running) return;
    const t0 = performance.now();
    setMs(0);
    const id = setInterval(() => {
      const t = performance.now() - t0;
      if (t >= total) { clearInterval(id); setK((n) => n + 1); } else setMs(t);
    }, 50);
    return () => clearInterval(id);
  }, [k, running, total]);

  /* l'issue de chaque appel déjà terminé, la plus récente en haut; la pile se vide en début de boucle */
  const doneCount = reduce ? scenes.length : (k % scenes.length) + (ms >= doneAt ? 1 : 0);
  const stack = scenes.slice(0, doneCount).map((s, i) => ({ s, i })).reverse().slice(0, STACK);

  /* le flottement: deux périodes différentes, pour que les téléphones ne bougent jamais ensemble */
  const float = (dur: number, delay: number) => (reduce ? {} : { animate: { y: [0, -8, 0] }, transition: { duration: dur, repeat: Infinity, ease: 'easeInOut' as const, delay } });

  return (
    <div ref={ref} className={`relative ${className}`} role="img"
      aria-label={isFr
        ? 'Illustration: une journée d’appels. Qwillio transfère une urgence au plombier, déplace un rendez-vous chez le kiné, prend un message pour la fiduciaire, répond à une question au restaurant et note une demande de devis au garage.'
        : 'Illustration: a day of calls. Qwillio puts an emergency through to the plumber, moves a physio appointment, takes a message at the accountants, answers a question at the restaurant and notes a quote request at the garage.'}>
      <div className="relative mx-auto flex w-full max-w-[520px] items-start justify-center gap-[7%] lg:mx-0" style={{ perspective: 1600 }}>
        {/* la rotation sur une enveloppe, le flottement dessous: Framer écrit `transform` en ligne */}
        <div className="w-[44%] mt-[8%]" style={{ transform: 'rotateY(14deg) rotateX(4deg) rotateZ(-3deg)', transformStyle: 'preserve-3d' }}>
          <motion.div {...float(6.5, 0)}>
            <ScaledDevice>
              {/* L'APPEL EN COURS, dans l'app Qwillio */}
              <div style={{ position: 'relative', width: W, height: H }}>
                <AnimatePresence initial={false}>
                  <motion.div key={k} style={{ position: 'absolute', inset: 0 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: EASE }}>
                    <LiveCall scene={scene} ms={reduce ? 1e6 : ms} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </ScaledDevice>
          </motion.div>
        </div>
        <div className="w-[44%]" style={{ transform: 'rotateY(-14deg) rotateX(4deg) rotateZ(3deg)', transformStyle: 'preserve-3d' }}>
          <motion.div {...float(7.2, 1.1)}>
            <ScaledDevice>
              {/* LE GÉRANT: l'issue de chaque appel tombe et s'empile */}
              <LockScreen time="14:32" date={isFr ? 'mardi 24 novembre' : 'Tuesday 24 November'} wallpaper={WALL}>
                <AnimatePresence initial={false}>
                  {stack.map(({ s, i }, pos) => (
                    <motion.div key={`${Math.floor(k / scenes.length)}-${i}`}
                      initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }}
                      transition={{ type: 'spring', stiffness: 280, damping: 26 }}>
                      <Notification kind="qwillio" top={s.biz} title={s.title} desc={s.desc}
                        time={pos === 0 ? (isFr ? 'maintenant' : 'now') : isFr ? `il y a ${pos * 4} min` : `${pos * 4}m ago`} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </LockScreen>
            </ScaledDevice>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
