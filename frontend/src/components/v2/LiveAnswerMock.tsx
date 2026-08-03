import { CalendarCheck, CalendarPlus, MessageSquare } from 'lucide-react';

/* Fiche d'appel en cours, mockup statique (DA/v2-direction.md).
   Registre clair, hairlines, indigo comme seule couleur. Rien d'animé,
   aucune donnée de performance: seulement des actions que le produit exécute. */

const NB = '\u00A0';

interface Line {
  who: string;
  text: string;
}

export default function LiveAnswerMock({ isFr, className = '' }: { isFr: boolean; className?: string }) {
  const caller = isFr ? 'Mme Lefèvre' : 'Ms Lefèvre';

  const lines: Line[] = isFr
    ? [
        { who: caller, text: `«${NB}Bonjour, est-ce que vous auriez quelque chose mardi${NB}?${NB}»` },
        { who: 'Marie', text: `«${NB}Bonjour Madame Lefèvre. Mardi, il me reste 14${NB}h${NB}30 ou 17${NB}h.${NB}»` },
        { who: caller, text: `«${NB}14${NB}h${NB}30, ce sera parfait.${NB}»` },
      ]
    : [
        { who: caller, text: '"Hello, would you have anything on Tuesday?"' },
        { who: 'Marie', text: '"Hello Ms Lefèvre. On Tuesday I have 2:30 or 5 pm left."' },
        { who: caller, text: '"2:30 works perfectly."' },
      ];

  const actions = [
    {
      icon: CalendarCheck,
      label: isFr ? 'Créneau vérifié' : 'Slot checked',
      meta: isFr ? 'mardi 14:30' : 'Tuesday 2:30 pm',
    },
    {
      icon: CalendarPlus,
      label: isFr ? 'Rendez-vous inscrit à l’agenda' : 'Appointment written to the calendar',
      meta: '',
    },
    {
      icon: MessageSquare,
      label: isFr ? 'SMS de confirmation envoyé' : 'Confirmation text sent',
      meta: '',
    },
  ];

  return (
    <figure
      className={`bg-q2-canvas border border-q2-plate rounded-[28px] p-7 md:p-8 ${className}`}
      style={{ boxShadow: 'var(--q2-shadow-whisper)' }}
    >
      <figcaption className="sr-only">
        {isFr
          ? 'Exemple d’appel entrant traité par Qwillio, avec les actions accomplies pendant la conversation.'
          : 'Example of an inbound call handled by Qwillio, with the actions completed during the conversation.'}
      </figcaption>

      <div className="flex items-baseline justify-between gap-4 pb-5 border-b border-q2-plate">
        <p className="flex items-center gap-2.5 text-[13px] font-medium text-q2-ink">
          <span className="w-1.5 h-1.5 rounded-full bg-q2-indigo shrink-0" aria-hidden="true" />
          {isFr ? 'Appel entrant' : 'Incoming call'}
          <span className="text-q2-faint" aria-hidden="true">
            ·
          </span>
          {caller}
        </p>
        <span className="inline-flex items-center rounded-full border border-q2-plate bg-q2-band px-3 py-1 text-[11px] font-medium text-q2-graphite whitespace-nowrap">
          {isFr ? 'Habituée' : 'Regular'}
        </span>
      </div>

      <ol className="pt-5 space-y-4" role="list">
        {lines.map((line) => (
          <li key={line.text}>
            <p className="q2-eyebrow text-q2-faint mb-1.5">{line.who}</p>
            <p className="text-[14px] leading-relaxed text-q2-graphite q2-body-text">{line.text}</p>
          </li>
        ))}
      </ol>

      <ul className="mt-7 border-t border-q2-plate" role="list">
        {actions.map((action) => (
          <li
            key={action.label}
            className="flex items-center justify-between gap-4 border-b border-q2-plate py-3.5 last:border-0 last:pb-0"
          >
            <span className="flex items-center gap-3 text-[13.5px] text-q2-ink">
              <action.icon size={15} className="shrink-0 text-q2-indigo" aria-hidden="true" />
              {action.label}
            </span>
            {action.meta ? (
              <span className="text-[13px] text-q2-body tabular-nums whitespace-nowrap">{action.meta}</span>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="mt-5 text-[12.5px] leading-relaxed text-q2-faint q2-body-text">
        {isFr
          ? `Prise de rendez-vous en direct${NB}: agenda Google connecté.`
          : 'Live booking requires a connected Google calendar.'}
      </p>
    </figure>
  );
}
