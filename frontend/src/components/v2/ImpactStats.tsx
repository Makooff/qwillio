import type { ReactNode } from 'react';
import { Container, Section } from './Primitives';
import RevealV2 from './RevealV2';
import Counter from './motion/Counter';

/* Bande de chiffres: quatre propriétés du produit, séparées par des
   hairlines verticales. Registre taupe et non drenched, la règle DA plafonne
   la Home à deux sections sombres (conversation + clôture).

   Rien d'improuvable ici (DA/voix.md): aucune métrique de performance, aucun
   nombre de clients. Ce sont quatre faits vérifiables dans le code:
   disponibilité, bilinguisme, durée de clonage, taille du catalogue de voix. */

interface Stat {
  value: ReactNode;
  labelFr: string;
  labelEn: string;
  srFr: string;
  srEn: string;
}

const STATS: Stat[] = [
  {
    value: (
      <>
        <Counter value={24} />/<Counter value={7} />
      </>
    ),
    labelFr: 'Elle décroche, jour, nuit, week-end et jours fériés',
    labelEn: 'She answers, day, night, weekends and holidays',
    srFr: 'Disponibilité 24 heures sur 24, 7 jours sur 7',
    srEn: 'Availability 24 hours a day, 7 days a week',
  },
  {
    value: 'FR/EN',
    labelFr: 'Français et anglais, dans le même appel',
    labelEn: 'French and English, inside the same call',
    srFr: 'Langues prises en charge',
    srEn: 'Supported languages',
  },
  {
    value: (
      <>
        <Counter value={90} />
        &nbsp;s
      </>
    ),
    labelFr: 'D’enregistrement suffisent à cloner votre voix',
    labelEn: 'Of recording are enough to clone your voice',
    srFr: 'Durée maximale d’enregistrement pour le clonage de voix',
    srEn: 'Maximum recording length for voice cloning',
  },
  {
    value: <Counter value={10} />,
    labelFr: 'Réceptionnistes, chacune avec sa voix et son caractère',
    labelEn: 'Receptionists, each with her own voice and character',
    srFr: 'Nombre de réceptionnistes au catalogue',
    srEn: 'Number of receptionists in the catalogue',
  },
];

export default function ImpactStats({ isFr }: { isFr: boolean }) {
  return (
    <Section variant="band" hairline aria-label={isFr ? 'Qwillio en chiffres' : 'Qwillio in figures'}>
      <Container>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-y-8 sm:gap-y-10">
          {STATS.map((s, i) => (
            <RevealV2
              key={s.srEn}
              index={i}
              /* Hairline à gauche, sauf en tête de rangée: deux colonnes en
                 mobile, quatre à partir de md */
              className={`px-3 sm:px-6 md:px-8 ${
                i % 2 === 0 ? 'border-l-0' : 'border-l border-q2-plate'
              } ${i === 0 ? 'md:border-l-0' : 'md:border-l md:border-q2-plate'}`}
            >
              <dt className="sr-only">{isFr ? s.srFr : s.srEn}</dt>
              <dd>
                {/* Le chiffre est nu (demande utilisateur) : plus de lueur
                    derrière le glyphe, la bande taupe suffit à le porter. */}
                <span className="inline-block text-[clamp(2rem,5vw,3.4rem)] font-light tracking-[-0.03em] leading-none text-q2-ink tabular-nums">
                  {s.value}
                </span>
                <span className="block mt-3 sm:mt-4 text-[13.5px] sm:text-sm leading-relaxed text-q2-body q2-body-text max-w-[220px]">
                  {isFr ? s.labelFr : s.labelEn}
                </span>
              </dd>
            </RevealV2>
          ))}
        </dl>
      </Container>
    </Section>
  );
}
