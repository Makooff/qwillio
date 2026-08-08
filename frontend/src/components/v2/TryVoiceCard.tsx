import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from '../icons';
import VapiLiveCall from '../client/VapiLiveCall';

/* Essai en direct, en carte.
 *
 * Remplace la page `/demo`: un formulaire à remplir avant d'entendre quoi que
 * ce soit est un péage, et personne ne le franchit pour une démonstration.
 * Ici il n'y a rien à configurer. Marie décroche, le scénario est tiré au
 * hasard, et il ne reste qu'un bouton.
 *
 * La carte NAÎT DU BOUTON: le contour de la pilule s'agrandit jusqu'à devenir
 * la carte (`layoutId` partagé), donc on ne perd jamais de vue d'où elle vient.
 * En mouvement réduit, elle apparaît simplement.
 */

export interface Scenario {
  /** Ce qu'on affiche: qui appelle-t-on. */
  fr: string;
  en: string;
  businessName: string;
  businessType: string;
  city: string;
}

/* Un scénario différent à chaque ouverture.
 *
 * C'est ce qui remplace la configuration: plutôt que de demander au visiteur
 * de décrire SON entreprise avant d'avoir entendu la voix, on lui en prête
 * une. Chaque entrée porte à la fois la phrase affichée et les champs envoyés
 * au serveur, si bien que ce qu'on lit et ce que Marie croit ne peuvent pas
 * diverger. Les métiers sont ceux de `config/niches.ts`. */
export const SCENARIOS: Scenario[] = [
  { fr: 'Vous appelez un cabinet dentaire pour un rendez-vous.',       en: 'You are calling a dental practice for an appointment.', businessName: 'Cabinet Dentaire du Parc', businessType: 'dental', city: 'Bruxelles' },
  { fr: 'Vous appelez un restaurant pour réserver une table.',          en: 'You are calling a restaurant to book a table.',        businessName: 'La Table d’Anvers',        businessType: 'restaurant', city: 'Anvers' },
  { fr: 'Vous appelez un garage: votre voiture fait un bruit suspect.', en: 'You are calling a garage: your car sounds wrong.',     businessName: 'Garage Verhoeven',         businessType: 'garage', city: 'Liège' },
  { fr: 'Vous appelez un salon de coiffure pour une couleur.',          en: 'You are calling a hair salon for a colour.',           businessName: 'Studio Lumen',             businessType: 'salon', city: 'Gand' },
  { fr: 'Vous appelez un plombier: une fuite sous l’évier.',            en: 'You are calling a plumber: a leak under the sink.',    businessName: 'Dupont Sanitaire',         businessType: 'home_services', city: 'Namur' },
  { fr: 'Vous appelez un cabinet vétérinaire pour votre chien.',        en: 'You are calling a vet for your dog.',                  businessName: 'Clinique des Quatre Pattes', businessType: 'veterinary', city: 'Louvain' },
];

/** Le diagramme, réactif à la voix de Marie et à rien d'autre. */
function VoiceRing({ level, active }: { level: number; active: boolean }) {
  /* Des poids FIXES appliqués au niveau réel: le profil reste stable et seule
     la hauteur bouge. Une animation aléatoire s'agiterait pareil quel que soit
     le niveau, donc ne montrerait rien. */
  const weights = useMemo(
    () => [0.35, 0.55, 0.75, 0.92, 1, 0.92, 0.75, 0.55, 0.35, 0.6, 0.85, 1, 0.85, 0.6, 0.35],
    [],
  );
  return (
    <div className="flex items-end justify-center gap-[3px] h-10" aria-hidden="true">
      {weights.map((w, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full"
          style={{
            height: `${active ? Math.max(8, Math.min(100, level * 170 * w)) : 8}%`,
            background: 'var(--q2-indigo)',
            opacity: active ? 0.45 + Math.min(level, 1) * 0.55 : 0.25,
            transition: 'height 90ms linear, opacity 140ms linear',
          }}
        />
      ))}
    </div>
  );
}

export default function TryVoiceCard({
  open,
  onClose,
  isFr,
  layoutId,
}: {
  open: boolean;
  onClose: () => void;
  isFr: boolean;
  /** Partagé avec le bouton: c'est lui qui fait grandir le contour en carte. */
  layoutId: string;
}) {
  const reduced = useReducedMotion();
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  /* Tiré à l'ouverture, pas au montage: deux essais de suite ne doivent pas
     rejouer la même scène. */
  const [scenario, setScenario] = useState<Scenario>(() => SCENARIOS[0]);
  useEffect(() => {
    if (open) setScenario(SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)]);
  }, [open]);

  const onLevel = useCallback((l: number, s: boolean) => { setLevel(l); setSpeaking(s); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    /* Le fond ne défile pas derrière une carte modale: sur téléphone, le
       moindre glissement l'emmène et on croit l'avoir fermée. */
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const body = useMemo(
    () => ({
      characterId: 'marie',
      agentName: 'Marie',
      businessName: scenario.businessName,
      businessType: scenario.businessType,
      city: scenario.city,
      lang: isFr ? 'fr' : 'en',
    }),
    [scenario, isFr],
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-q2-void/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            /* Le contour de la pilule DEVIENT ce cadre. Framer interpole la
               position et la taille entre les deux éléments qui partagent ce
               `layoutId`, il n'y a donc aucune apparition: c'est le même objet
               qui grandit. */
            layoutId={reduced ? undefined : layoutId}
            initial={reduced ? { opacity: 0 } : undefined}
            animate={reduced ? { opacity: 1 } : undefined}
            exit={reduced ? { opacity: 0 } : undefined}
            transition={{ type: 'spring', stiffness: 380, damping: 34, mass: 0.8 }}
            role="dialog"
            aria-modal="true"
            aria-label={isFr ? 'Essai en direct avec Marie' : 'Live trial with Marie'}
            className="relative w-full max-w-[360px] rounded-[28px] border border-q2-plate bg-q2-canvas p-6 shadow-[0_24px_70px_-20px_rgba(20,16,50,0.45)]"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={isFr ? 'Fermer' : 'Close'}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-q2-faint hover:bg-q2-band hover:text-q2-ink transition-colors"
            >
              <X size={15} />
            </button>

            {/* Marie, en grand. Son portrait est le sujet de la carte: c'est
                elle qu'on va entendre, pas une abstraction. */}
            <motion.div
              className="flex flex-col items-center pt-2"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="relative">
                {/* L'anneau respire avec sa voix, autour de son visage. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'var(--q2-indigo)',
                    transform: `scale(${1 + Math.min(level, 1) * 0.28})`,
                    opacity: speaking ? 0.10 + Math.min(level, 1) * 0.26 : 0,
                    transition: 'transform 90ms linear, opacity 160ms linear',
                  }}
                />
                <img
                  src="/characters/marie.webp"
                  alt="Marie"
                  width={120}
                  height={120}
                  className="relative block h-[120px] w-[120px] rounded-full object-cover border border-q2-plate bg-q2-band"
                />
              </span>

              <p className="mt-4 text-[19px] font-medium text-q2-ink">Marie</p>
              <p className="text-[12.5px] text-q2-faint">
                {isFr ? 'Réceptionniste · français' : 'Receptionist · French'}
              </p>

              <VoiceRing level={level} active={speaking} />

              {/* Le scénario: ce qu'on lit est exactement ce que Marie croit. */}
              <p className="mt-1 mb-5 text-center text-[13.5px] leading-relaxed text-q2-body q2-body-text">
                {isFr ? scenario.fr : scenario.en}
              </p>

              <div className="w-full">
                <VapiLiveCall
                  isFr={isFr}
                  endpoint="/public/demo/live-config"
                  body={body}
                  tone="site"
                  onLevel={onLevel}
                  /* Le diagramme est au-dessus, en grand: les cinq petites
                     barres du composant diraient la même chose deux fois. */
                  showBars={false}
                />
              </div>

              <p className="mt-3 text-center text-[11px] leading-relaxed text-q2-faint">
                {isFr
                  ? 'Elle utilise le micro de cet appareil. Rien n’est enregistré, et l’essai est limité à deux minutes par jour.'
                  : 'She uses this device’s microphone. Nothing is recorded, and the trial is capped at two minutes a day.'}
              </p>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
