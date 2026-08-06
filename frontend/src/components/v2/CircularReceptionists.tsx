import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import gsap from 'gsap';
import { Mic, Play, Square } from '../icons';
import { prefersReducedMotion } from './motion/reducedMotion';
import { useVoicePreview } from '../client/useVoicePreview';
import CircularCarousel from './ui/circular-carousel';

/* Sélection des réceptionnistes : le carrousel est le PORT VERBATIM du
   Circular Carousel de nexus-ui (components/v2/ui/circular-carousel.tsx,
   copié de DA/references/21st/circular-carousel/source.tsx) — ce fichier-ci
   ne fait plus que l'habiller : les 10 presets en items (avatar + nom + tag),
   la fiche de personnalité sous le carrousel, la note clonage, et l'aperçu
   des VRAIES voix ElevenLabs (hook partagé avec le dashboard, endpoint
   public, repli navigateur annoncé). En reduced-motion : rangée statique. */

interface Preset {
  id: string;
  name: string;
  personalityFr: string;
  personalityEn: string;
  descFr: string;
  descEn: string;
}

/* Les dix visages du catalogue. Le carrousel les tient depuis que son pas
   angulaire est calé sur dix (VISIBLE_COUNT 7) et que les cartes lointaines
   s'effacent complètement : le repli se fait à l'écart maximal, donc on ne voit
   plus une carte de gauche réapparaître à droite. */
const PRESETS: Preset[] = [
  { id: 'marie', name: 'Marie', personalityFr: 'Chaleureuse', personalityEn: 'Warm', descFr: 'Accueillante, le sourire dans la voix. Celle qui met vos clients à l’aise dès la première seconde.', descEn: 'Welcoming, a smile in her voice. She puts your customers at ease from the first second.' },
  { id: 'camille', name: 'Camille', personalityFr: 'Premium', personalityEn: 'Premium', descFr: 'Soignée et raffinée, pour une image haut de gamme au téléphone.', descEn: 'Polished and refined, for an upscale image on the phone.' },
  { id: 'nour', name: 'Nour', personalityFr: 'Bienveillante', personalityEn: 'Caring', descFr: 'Douce et attentive, pour les métiers où l’on appelle parfois inquiet.', descEn: 'Gentle and attentive, for trades where callers are sometimes worried.' },
  { id: 'lucas', name: 'Lucas', personalityFr: 'Professionnel', personalityEn: 'Professional', descFr: 'Posé et direct, rassurant. Le ton d’un cabinet qui inspire confiance.', descEn: 'Calm and direct, reassuring. The tone of a practice that inspires trust.' },
  { id: 'theo', name: 'Théo', personalityFr: 'Énergique', personalityEn: 'Energetic', descFr: 'Motivé et concret, ça s’entend au téléphone. Il aime les appels qui aboutissent.', descEn: 'Driven and concrete, you can hear it on the line. He likes calls that get somewhere.' },
  { id: 'hugo', name: 'Hugo', personalityFr: 'Décontracté', personalityEn: 'Casual', descFr: 'Détendu et direct, comme un collègue au comptoir. Réponses nettes, rendez-vous vite calé.', descEn: 'Relaxed and direct, like a colleague at the desk. Crisp answers, a quickly booked slot.' },
  { id: 'lea', name: 'Léa', personalityFr: 'Efficace', personalityEn: 'Efficient', descFr: 'Droit au but, sans jamais bousculer. Elle qualifie vite et note l’essentiel.', descEn: 'Straight to the point, never rushing anyone. She qualifies fast and notes what matters.' },
  { id: 'sofia', name: 'Sofia', personalityFr: 'Posée', personalityEn: 'Composed', descFr: 'Calme et claire, à l’aise avec les appels longs et les demandes détaillées.', descEn: 'Calm and clear, at ease with long calls and detailed requests.' },
  { id: 'adrien', name: 'Adrien', personalityFr: 'Direct', personalityEn: 'Direct', descFr: 'Franc et efficace, pour les métiers où l’on va à l’essentiel.', descEn: 'Frank and efficient, for trades that get to the point.' },
  { id: 'julien', name: 'Julien', personalityFr: 'Cordial', personalityEn: 'Cordial', descFr: 'Aimable et méthodique, il vérifie deux fois plutôt qu’une avant de conclure.', descEn: 'Friendly and methodical, he double-checks before wrapping up.' },
];

/* URL du clip public (mêmes voix que le dashboard, cache serveur + ETag) et
   phrase de repli pour la voix du navigateur si l'audio réel échoue. */
function previewUrl(id: string, isFr: boolean) {
  return `/public/characters/${id}/preview?lang=${isFr ? 'fr' : 'en'}`;
}

function fallbackLine(name: string, isFr: boolean) {
  return isFr
    ? `Bonjour, ici ${name}, merci d’appeler ! Comment puis-je vous aider ?`
    : `Hello, this is ${name}, thanks for calling! How can I help you?`;
}

function VoicePreviewButton({
  speaking,
  onToggle,
  isFr,
  name,
  className = '',
}: {
  speaking: boolean;
  onToggle: () => void;
  isFr: boolean;
  name: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={
        speaking
          ? isFr
            ? `Arrêter l’aperçu de la voix de ${name}`
            : `Stop the voice preview for ${name}`
          : isFr
            ? `Écouter un aperçu de la voix de ${name}`
            : `Hear a voice preview for ${name}`
      }
      /* Pastille de 32px visuels, mais une zone tactile de 44px étendue par
         un pseudo-élément: le doigt n'a pas à viser le glyphe. */
      className={`relative w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-full bg-q2-ink text-white ring-2 ring-q2-canvas hover:bg-q2-indigo transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo after:absolute after:-inset-1.5 after:content-[''] ${className}`}
    >
      {speaking ? (
        <Square size={10} fill="currentColor" aria-hidden="true" />
      ) : (
        <Play size={10} fill="currentColor" aria-hidden="true" />
      )}
    </button>
  );
}

function PersonaCard({
  preset,
  isFr,
  preview,
}: {
  preset: Preset;
  isFr: boolean;
  preview?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.36, ease: 'power3.out' });
    }, el);
    return () => ctx.revert();
  }, [preset.id]);

  return (
    <div
      ref={ref}
      id="recep-panel"
      role="tabpanel"
      aria-label={preset.name}
      tabIndex={0}
      className="bg-q2-band rounded-3xl p-6 sm:p-8 max-w-[640px] mx-auto text-center sm:text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40"
    >
      <div className="flex items-center gap-3 mb-1.5 flex-wrap justify-center sm:justify-start">
        <p className="text-xl text-q2-ink font-normal">{preset.name}</p>
        <span className="q2-eyebrow text-q2-indigo">
          {isFr ? preset.personalityFr : preset.personalityEn}
        </span>
        {preview}
      </div>
      <p className="text-[15px] text-q2-body leading-relaxed q2-body-text mb-3">
        {isFr ? preset.descFr : preset.descEn}
      </p>
      <p className="text-[13px] text-q2-body q2-body-text">
        {isFr
          ? 'Voix dédiée, avec aperçu audio dans le dashboard. Français et anglais : la langue vient de vos appels, pas du personnage.'
          : 'A dedicated voice, with an audio preview in the dashboard. French and English: the language comes from your calls, not from the character.'}
      </p>
    </div>
  );
}

function VoiceCloneNote({ isFr }: { isFr: boolean }) {
  return (
    <div className="flex items-center gap-4 mt-5 sm:mt-6 max-w-[640px] mx-auto">
      <span className="w-12 h-12 shrink-0 rounded-full bg-q2-ink text-white flex items-center justify-center">
        <Mic size={18} aria-hidden="true" />
      </span>
      <p className="text-[15px] text-q2-body leading-relaxed q2-body-text">
        {isFr
          ? 'Ou clonez votre propre voix : 20 à 90 secondes d’enregistrement, avec votre consentement explicite, et elle répond avec votre timbre.'
          : 'Or clone your own voice: 20 to 90 seconds of recording, with your explicit consent, and she answers with your timbre.'}
      </p>
    </div>
  );
}

export default function CircularReceptionists({ isFr }: { isFr: boolean }) {
  const [active, setActive] = useState(0);
  const [reduced] = useState(prefersReducedMotion);

  const preset = PRESETS[active];
  const { playing, notice, toggle, prefetch, stop } = useVoicePreview(isFr);
  const speaking = playing === preset.id;
  const onTogglePreview = useCallback(() => {
    toggle(preset.id, previewUrl(preset.id, isFr), fallbackLine(preset.name, isFr));
  }, [toggle, preset.id, preset.name, isFr]);

  /* Changer de personnage coupe l'aperçu en cours et précharge le clip du
     nouveau, pour que ▶ parte sans attente. */
  useEffect(() => {
    stop();
    prefetch(previewUrl(preset.id, isFr));
  }, [preset.id, isFr, stop, prefetch]);

  const items = useMemo(
    () =>
      PRESETS.map((p) => ({
        id: p.id,
        title: p.name,
        description: isFr ? p.descFr : p.descEn,
        tag: isFr ? p.personalityFr : p.personalityEn,
        avatar: `/characters/${p.id}.webp`,
      })),
    [isFr],
  );

  const label = isFr ? 'Réceptionnistes' : 'Receptionists';

  /* Repli reduced-motion: la rangée simple, sans arc ni animation. La fiche et
     l'aperçu de voix restent là, l'aperçu passe dans l'en-tête de la fiche. */
  if (reduced) {
    return (
      <div>
        <div className="flex flex-wrap gap-2.5 sm:gap-3 mb-8" role="tablist" aria-label={label}>
          {PRESETS.map((p, i) => (
            <button
              key={p.id}
              id={`recep-tab-${p.id}`}
              type="button"
              role="tab"
              aria-selected={active === i}
              aria-controls="recep-panel"
              aria-label={`${p.name}, ${isFr ? p.personalityFr : p.personalityEn}`}
              onClick={() => setActive(i)}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo focus-visible:ring-offset-2 ${
                active === i ? 'ring-2 ring-q2-indigo ring-offset-2 ring-offset-q2-canvas' : ''
              }`}
            >
              <img
                src={`/characters/${p.id}.webp`}
                alt=""
                loading="lazy"
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
        <PersonaCard
          preset={preset}
          isFr={isFr}
          preview={
            <VoicePreviewButton
              speaking={speaking}
              onToggle={onTogglePreview}
              isFr={isFr}
              name={preset.name}
            />
          }
        />
        {notice && (
          <p role="status" className="text-[12px] text-q2-body q2-body-text max-w-[640px] mx-auto mt-3">
            {notice}
          </p>
        )}
        <VoiceCloneNote isFr={isFr} />
      </div>
    );
  }

  return (
    <div>
      <CircularCarousel
        items={items}
        activeIndex={active}
        onActiveChange={setActive}
        pauseSignal={playing !== null}
        className="mb-6 sm:mb-8"
      />

      {notice && (
        <p role="status" className="text-[12px] text-q2-body q2-body-text max-w-[640px] mx-auto -mt-3 mb-4 text-center sm:text-left">
          {notice}
        </p>
      )}
      <PersonaCard
        preset={preset}
        isFr={isFr}
        preview={
          <VoicePreviewButton
            speaking={speaking}
            onToggle={onTogglePreview}
            isFr={isFr}
            name={preset.name}
          />
        }
      />
      <VoiceCloneNote isFr={isFr} />
    </div>
  );
}
