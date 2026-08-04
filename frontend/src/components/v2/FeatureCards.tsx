import RevealV2 from './RevealV2';

/* Cartes « produit » du registre clair: l'illustration se pose EN HAUT, dans
   un liseré arrondi qui déborde légèrement du bord supérieur de la carte, le
   titre et la description suivent dessous. Les visuels sont de VRAIES captures
   du dashboard (public/screens/), jamais des illustrations.

   Deux colonnes sur desktop, une sur mobile. La carte est une plate taupe
   (bg-q2-band, radius 24) sans bordure ni ombre au repos: l'élévation
   n'apparaît qu'au survol (q2-card-hover: translateY(-2px) + ombre
   éditoriale). Pas de grille de cards identiques: le liseré, le cadrage et la
   longueur de texte diffèrent d'une carte à l'autre. */

interface Feature {
  src: string;
  /* Cadrage de la capture dans le liseré */
  ratio: string;
  position: string;
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
  altFr: string;
  altEn: string;
}

const FEATURES: Feature[] = [
  {
    src: '/screens/appels.webp',
    ratio: '16 / 10',
    position: 'center top',
    titleFr: 'Chaque appel documenté',
    titleEn: 'Every call documented',
    descFr:
      'Résumé, transcript, enregistrement, lead qualifié : tout arrive dans votre dashboard à la seconde où l’appel se termine. Rien ne se perd, rien n’est à ressaisir.',
    descEn:
      'Summary, transcript, recording, qualified lead: everything lands in your dashboard the second the call ends. Nothing gets lost, nothing needs retyping.',
    altFr: 'Liste des appels dans le dashboard Qwillio',
    altEn: 'Call list in the Qwillio dashboard',
  },
  {
    src: '/screens/chat-config.webp',
    ratio: '16 / 11',
    position: 'center top',
    titleFr: 'Ce qui cloche se corrige en parlant',
    titleEn: 'What needs fixing gets fixed by talking',
    descFr:
      'Chaque semaine, elle vous dit ce qui coince : réponses trop longues, agenda déconnecté, questions absentes de votre FAQ. Vous le réglez dans le chat, en une phrase.',
    descEn:
      'Every week she tells you what is stuck: answers too long, calendar disconnected, questions missing from your FAQ. You fix it in the chat, in one sentence.',
    altFr: 'Chat de configuration du réceptionniste Qwillio',
    altEn: 'Qwillio receptionist configuration chat',
  },
];

export default function FeatureCards({ isFr }: { isFr: boolean }) {
  return (
    <div className="grid md:grid-cols-2 gap-6 md:gap-8 mt-14">
      {FEATURES.map((f, i) => (
        <RevealV2 key={f.src} index={i} className="h-full">
          {/* flex-col, pas un bloc simple: sans contexte de formatage la marge
              négative du liseré remonterait la carte au lieu de la déborder */}
          {/* Carte canvas + hairline: la section qui l'accueille est déjà une
              bande taupe, une plate sur une plate ne se verrait pas */}
          <article className="q2-card-hover flex h-full flex-col bg-q2-canvas border border-q2-plate rounded-[24px] px-6 pb-6 pt-0">
            {/* Le liseré remonte de 40px: la capture déborde du haut de la carte */}
            <div className="-mt-10 mb-6 rounded-[18px] border border-q2-plate bg-q2-band p-1.5 shadow-[var(--q2-shadow-whisper)]">
              <div className="rounded-[13px] overflow-hidden bg-q2-carbon">
                <img
                  src={f.src}
                  alt={isFr ? f.altFr : f.altEn}
                  loading="lazy"
                  width={1600}
                  height={930}
                  className="block w-full h-full object-cover"
                  style={{ aspectRatio: f.ratio, objectPosition: f.position }}
                />
              </div>
            </div>
            <h3 className="text-[17px] font-medium text-q2-ink mb-2">{isFr ? f.titleFr : f.titleEn}</h3>
            <p className="text-sm leading-relaxed text-q2-body q2-body-text">
              {isFr ? f.descFr : f.descEn}
            </p>
          </article>
        </RevealV2>
      ))}
    </div>
  );
}
