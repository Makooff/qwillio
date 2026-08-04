import RevealV2 from './RevealV2';

/* Rangées « produit » du registre clair: plus de grille de deux cartes
   étroites côte à côte. Chaque rangée occupe toute la largeur, le texte tient
   sur environ 40 pour cent et la capture sur environ 60, le côté de
   l'illustration s'inverse d'une rangée à l'autre.

   L'illustration se pose sur une plate douce (radius 28) dont le cadre de la
   capture DÉBORDE par le haut, et par le côté extérieur au-delà de lg: le
   visuel sort de son conteneur au lieu d'y être enfermé. Les visuels sont de
   VRAIES captures recadrées du dashboard (public/screens/).

   La section d'accueil est déjà une bande taupe: la plate prend donc le ton
   au-dessus (bg-q2-plate), sinon elle disparaîtrait dans le fond.

   Mobile: texte puis image empilés, image pleine largeur. */

interface Feature {
  src: string;
  /* Ratio réel du fichier, réservé pour éviter tout décalage au chargement */
  width: number;
  height: number;
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
  altFr: string;
  altEn: string;
}

const FEATURES: Feature[] = [
  {
    src: '/screens/crop-appels.webp',
    width: 1600,
    height: 930,
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
    src: '/screens/crop-chat.webp',
    width: 1600,
    height: 1196,
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
    <div className="mt-9 sm:mt-14 flex flex-col gap-12 sm:gap-20 md:gap-28">
      {FEATURES.map((f, i) => {
        const flipped = i % 2 === 1;
        return (
          <RevealV2 key={f.src} index={i}>
            <article
              className={`grid items-center gap-7 sm:gap-10 lg:gap-16 ${
                flipped
                  ? 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]'
                  : 'lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]'
              }`}
            >
              <div className={flipped ? 'lg:order-2' : ''}>
                <h3 className="text-[22px] lg:text-[24px] leading-[1.2] tracking-[-0.01em] text-q2-ink mb-4">
                  {isFr ? f.titleFr : f.titleEn}
                </h3>
                <p className="text-[15px] leading-relaxed text-q2-body q2-body-text max-w-[440px]">
                  {isFr ? f.descFr : f.descEn}
                </p>
              </div>

              {/* La plate, et la capture qui en sort par le haut */}
              <div
                className={`q2-card-hover rounded-[24px] sm:rounded-[28px] bg-q2-plate px-4 pb-4 pt-0 sm:px-8 sm:pb-8 lg:px-10 lg:pb-10 ${
                  flipped ? 'lg:order-1' : ''
                }`}
              >
                <div
                  className={`-mt-6 lg:-mt-10 rounded-[16px] border border-q2-plate bg-q2-carbon overflow-hidden shadow-[var(--q2-shadow-whisper)] ${
                    flipped ? 'lg:-ml-6' : 'lg:-mr-6'
                  }`}
                >
                  <img
                    src={f.src}
                    alt={isFr ? f.altFr : f.altEn}
                    loading="lazy"
                    width={f.width}
                    height={f.height}
                    className="block w-full h-auto"
                  />
                </div>
              </div>
            </article>
          </RevealV2>
        );
      })}
    </div>
  );
}
