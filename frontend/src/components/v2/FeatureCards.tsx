import RevealV2 from './RevealV2';
import ProductIllustration from './ProductIllustration';

/* Preserve the alternating editorial rows; explain each outcome rather than
   shrinking a complete dashboard into a marketing illustration. */
const FEATURES = [
  {
    kind: 'summary' as const,
    titleFr: 'Chaque appel documenté',
    titleEn: 'Every call documented',
    descFr: 'Résumé, transcription et coordonnées sont réunis dans votre tableau de bord après l’appel. L’enregistrement est accessible lorsqu’il est activé et disponible.',
    descEn: 'Summary, transcript and contact details are gathered in your dashboard after the call. Recordings are accessible when enabled and available.',
  },
  {
    kind: 'insight' as const,
    titleFr: 'Chaque semaine, elle vous dit ce qui coince',
    titleEn: 'Every week she tells you what is stuck',
    descFr: 'Réponses trop longues, agenda déconnecté, questions absentes de sa base : un bilan peut vous être envoyé par email et par SMS selon vos coordonnées et les canaux activés.',
    descEn: 'Long answers, calendar disconnected, questions missing from her knowledge base: a report can be sent by email and text depending on your contact details and enabled channels.',
  },
];

export default function FeatureCards({ isFr }: { isFr: boolean }) {
  return (
    <div className="mt-9 sm:mt-14 flex flex-col gap-12 sm:gap-20 md:gap-28">
      {FEATURES.map((feature, i) => (
        <RevealV2 key={feature.kind} index={i}>
          {i === 0 ? (
            <article className="grid items-center gap-7 sm:gap-10 lg:gap-16 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.35fr)]">
              <div className="min-w-0">
                <h3 className="text-[22px] lg:text-[24px] leading-[1.2] tracking-[-0.01em] text-q2-ink mb-4">{isFr ? feature.titleFr : feature.titleEn}</h3>
                <p className="text-[15px] leading-relaxed text-q2-body q2-body-text max-w-[440px]">{isFr ? feature.descFr : feature.descEn}</p>
              </div>
              <div className="min-w-0"><ProductIllustration kind={feature.kind} isFr={isFr} /></div>
            </article>
          ) : (
            <article className="border-t border-q2-plate pt-7 sm:pt-10 grid md:grid-cols-[minmax(0,.9fr)_minmax(0,1.35fr)] gap-4 md:gap-16">
              <h3 className="text-xl leading-snug text-q2-ink max-w-[360px]">{isFr ? feature.titleFr : feature.titleEn}</h3>
              <p className="text-[15px] leading-relaxed text-q2-body q2-body-text max-w-[600px]">{isFr ? feature.descFr : feature.descEn}</p>
            </article>
          )}
        </RevealV2>
      ))}
    </div>
  );
}
