import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Mic } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

/* Galerie interactive des receptionnistes. Les visages viennent des
   avatars du produit (frontend/public/characters/, PR #79), les
   personnalites des presets du dashboard. On ne promet une voix avec
   apercu audio que la ou elle existe dans le catalogue serveur
   (voice-characters.ts); les autres visages portent une personnalite,
   la voix se choisit dans le dashboard. La derniere carte est le
   clonage de voix (fonction reelle: VoiceCloner, 20-90 s). */

interface Preset {
  id: string;
  name: string;
  personalityFr: string;
  personalityEn: string;
  descFr: string;
  descEn: string;
  hasVoice: boolean;
}

const PRESETS: Preset[] = [
  { id: 'marie', name: 'Marie', personalityFr: 'Chaleureuse', personalityEn: 'Warm', descFr: 'Accueillante, le sourire dans la voix. Celle qui met vos clients à l’aise dès la première seconde.', descEn: 'Welcoming, a smile in her voice. She puts your customers at ease from the first second.', hasVoice: true },
  { id: 'camille', name: 'Camille', personalityFr: 'Premium', personalityEn: 'Premium', descFr: 'Soignée et raffinée, pour une image haut de gamme au téléphone.', descEn: 'Polished and refined, for an upscale image on the phone.', hasVoice: true },
  { id: 'lea', name: 'Léa', personalityFr: 'Énergique', personalityEn: 'Energetic', descFr: 'Dynamique et enthousiaste, elle donne du rythme à chaque appel.', descEn: 'Dynamic and enthusiastic, she keeps every call moving.', hasVoice: true },
  { id: 'lucas', name: 'Lucas', personalityFr: 'Professionnel', personalityEn: 'Professional', descFr: 'Posé et direct, rassurant. Le ton d’un cabinet qui inspire confiance.', descEn: 'Calm and direct, reassuring. The tone of a practice that inspires trust.', hasVoice: true },
  { id: 'sofia', name: 'Sofia', personalityFr: 'Décontractée', personalityEn: 'Casual', descFr: 'Naturelle, conversationnelle. On oublie qu’on parle à un accueil.', descEn: 'Natural and conversational. Callers forget they reached a front desk.', hasVoice: true },
  { id: 'nour', name: 'Nour', personalityFr: 'Bienveillante', personalityEn: 'Caring', descFr: 'Douce et attentive, pour les métiers où l’on appelle parfois inquiet.', descEn: 'Gentle and attentive, for trades where callers are sometimes worried.', hasVoice: false },
  { id: 'adrien', name: 'Adrien', personalityFr: 'Posé', personalityEn: 'Composed', descFr: 'Calme et précis, il va droit à l’essentiel sans jamais presser.', descEn: 'Calm and precise, straight to the point without ever rushing.', hasVoice: false },
  { id: 'hugo', name: 'Hugo', personalityFr: 'Direct', personalityEn: 'Direct', descFr: 'Souriant et efficace, des réponses nettes et un rendez-vous vite calé.', descEn: 'Friendly and efficient, crisp answers and a quickly booked slot.', hasVoice: false },
  { id: 'julien', name: 'Julien', personalityFr: 'Courtois', personalityEn: 'Courteous', descFr: 'Le sens du détail et des formules, pour un accueil très soigné.', descEn: 'A sense of detail and phrasing, for a very polished welcome.', hasVoice: false },
  { id: 'theo', name: 'Théo', personalityFr: 'Vif', personalityEn: 'Sharp', descFr: 'Réactif et concret, il aime les appels qui aboutissent.', descEn: 'Responsive and concrete, he likes calls that get somewhere.', hasVoice: false },
];

export default function ReceptionistGallery({ isFr }: { isFr: boolean }) {
  const [active, setActive] = useState(0);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.from(row.children, {
        opacity: 0,
        y: 16,
        duration: 0.5,
        stagger: 0.06,
        ease: 'power3.out',
        scrollTrigger: { trigger: row, start: 'top 82%', once: true },
      });
    }, row);
    return () => ctx.revert();
  }, []);

  const p = PRESETS[active];

  return (
    <div>
      {/* Rangée de visages, sélection au clic ou au clavier */}
      <div ref={rowRef} className="flex flex-wrap gap-2.5 sm:gap-3 mb-8" role="tablist" aria-label={isFr ? 'Réceptionnistes' : 'Receptionists'}>
        {PRESETS.map((preset, i) => (
          <button
            key={preset.id}
            type="button"
            role="tab"
            aria-selected={active === i}
            aria-label={`${preset.name}, ${isFr ? preset.personalityFr : preset.personalityEn}`}
            onClick={() => setActive(i)}
            className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden transition-transform duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo focus-visible:ring-offset-2 ${
              active === i ? 'ring-2 ring-q2-indigo ring-offset-2 ring-offset-q2-canvas' : 'hover:-translate-y-0.5'
            }`}
          >
            <img
              src={`/characters/${preset.id}.webp`}
              alt=""
              loading="lazy"
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      {/* Carte du preset sélectionné */}
      <div className="grid sm:grid-cols-[auto_1fr] gap-6 items-start bg-q2-band rounded-3xl p-6 sm:p-8 max-w-[640px]">
        <img
          key={p.id}
          src={`/characters/${p.id}.webp`}
          alt={p.name}
          width={96}
          height={96}
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover"
        />
        <div>
          <div className="flex items-baseline gap-3 mb-1.5 flex-wrap">
            <p className="text-xl text-q2-ink font-normal">{p.name}</p>
            <span className="q2-eyebrow text-q2-indigo">{isFr ? p.personalityFr : p.personalityEn}</span>
          </div>
          <p className="text-[15px] text-q2-body leading-relaxed q2-body-text mb-3">{isFr ? p.descFr : p.descEn}</p>
          <p className="text-[13px] text-q2-body q2-body-text">
            {p.hasVoice
              ? isFr
                ? 'Voix disponible avec aperçu audio dans le dashboard.'
                : 'Voice available with an audio preview in the dashboard.'
              : isFr
                ? 'Personnalité prête, la voix se choisit dans le dashboard.'
                : 'Personality ready, the voice is picked in the dashboard.'}
          </p>
        </div>
      </div>

      {/* Le onzième choix: la voix du patron */}
      <div className="flex items-center gap-4 mt-6 max-w-[640px]">
        <span className="w-12 h-12 shrink-0 rounded-full bg-q2-ink text-white flex items-center justify-center">
          <Mic size={18} aria-hidden="true" />
        </span>
        <p className="text-[15px] text-q2-body leading-relaxed q2-body-text">
          {isFr ? (
            <>
              Ou clonez votre propre voix : 20 à 90 secondes d’enregistrement, avec votre consentement explicite,
              et elle répond avec votre timbre.
            </>
          ) : (
            <>
              Or clone your own voice: 20 to 90 seconds of recording, with your explicit consent, and she answers
              with your timbre.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
