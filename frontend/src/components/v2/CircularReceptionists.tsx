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

/* Les phrases RÉELLEMENT enregistrées, reprises telles quelles de
   `backend/src/config/voice-characters.ts`. Elles ne sont plus prononcées par
   le navigateur (la voix de lecture de Safari ne ressemblait à aucune voix du
   produit) : elles s'affichent pendant que le vrai clip ElevenLabs joue, si
   bien qu'on lit ce qu'on entend. Un écart avec le serveur se voit donc à
   l'oreille, ce qui est la bonne façon de s'en apercevoir. */
const SPOKEN: Record<string, { fr: string; en: string }> = {
  marie:   { fr: 'Bonjour, merci d’appeler ! Comment puis-je vous aider aujourd’hui ?', en: 'Hello, thanks for calling! How can I help you today?' },
  camille: { fr: 'Bonjour et bienvenue. Je vous écoute, en quoi puis-je vous être utile ?', en: 'Good day and welcome. I’m listening — how may I assist you?' },
  lea:     { fr: 'Salut ! Super de vous avoir au téléphone, dites-moi tout !', en: 'Hi there! Great to have you on the line, tell me everything!' },
  sofia:   { fr: 'Bonjour, ravie de vous entendre. Comment puis-je vous aider ?', en: 'Hi, lovely to hear from you. How can I help?' },
};

function spokenLine(id: string, isFr: boolean): string | undefined {
  const entry = SPOKEN[id];
  return entry ? (isFr ? entry.fr : entry.en) : undefined;
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
      className={`relative w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-full bg-q2-ink text-q2-canvas ring-2 ring-q2-canvas hover:bg-q2-indigo transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo after:absolute after:-inset-1.5 after:content-[''] ${className}`}
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
      {/* LA CAUSE DU SAUT DE PAGE, et le seul endroit où il fallait la traiter.
          Le carrousel avance tout seul toutes les quatre secondes et remplace
          cette description. Les dix personnages n'ont pas des textes de la même
          longueur: la carte passait de deux lignes à trois, sa hauteur changeait,
          et TOUTE la page en dessous descendait puis remontait, en boucle
          (retour utilisateur: « tout se décale et redescend toutes les 5 s »).
          Réserver une hauteur en dur aurait été un chiffre à maintenir à chaque
          texte modifié. Ici les DIX descriptions sont posées dans la même
          cellule de grille: la carte fait donc toujours la hauteur de la plus
          longue, quelle que soit celle qui est visible, et le jour où l'on
          ajoute un personnage plus bavard la réserve s'ajuste seule.
          Les inactives sont invisibles ET retirées de l'accessibilité: elles
          occupent la place sans être lues ni annoncées. */}
      <div className="grid mb-3">
        {PRESETS.map((p) => (
          <p
            key={p.id}
            aria-hidden={p.id !== preset.id}
            className={`col-start-1 row-start-1 text-[15px] text-q2-body leading-relaxed q2-body-text transition-opacity duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              p.id === preset.id ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {isFr ? p.descFr : p.descEn}
          </p>
        ))}
      </div>
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
      <span className="w-12 h-12 shrink-0 rounded-full bg-q2-ink text-q2-canvas flex items-center justify-center">
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
  const { playing, notice, line, toggle, prefetch, stop } = useVoicePreview(isFr);
  const speaking = playing === preset.id;
  const onTogglePreview = useCallback(() => {
    toggle(preset.id, previewUrl(preset.id, isFr), spokenLine(preset.id, isFr));
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
        {/* La phrase qu'on entend, écrite. Elle vient du catalogue serveur,
            donc c'est le texte réellement enregistré, pas une paraphrase. */}
        {speaking && line && (
          <p className="text-[13px] italic text-q2-body q2-body-text max-w-[560px] mx-auto mt-3 text-center">
            « {line} »
          </p>
        )}
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

      {speaking && line && (
        <p className="text-[13px] italic text-q2-body q2-body-text max-w-[560px] mx-auto -mt-2 mb-4 text-center">
          « {line} »
        </p>
      )}
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
