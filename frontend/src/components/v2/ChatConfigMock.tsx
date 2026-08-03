import { Check, Paperclip } from 'lucide-react';

/* Chat de configuration, mockup statique drenched (DA/v2-direction.md).
   Card carbon 12px, bordure hairline, zéro ombre. La pilule indigo est
   l'unique action chromatique de la section qui accueille ce bloc.
   La photo est une vignette abstraite: aucune image réelle n'est chargée. */

const NB = ' ';

interface Rate {
  name: string;
  price: string;
}

export default function ChatConfigMock({ isFr, className = '' }: { isFr: boolean; className?: string }) {
  const rates: Rate[] = isFr
    ? [
        { name: 'Coupe', price: `28${NB}€` },
        { name: 'Coupe et barbe', price: `39${NB}€` },
        { name: 'Coloration', price: `65${NB}€` },
      ]
    : [
        { name: 'Haircut', price: `€28` },
        { name: 'Cut and beard', price: `€39` },
        { name: 'Colour', price: `€65` },
      ];

  return (
    <figure
      className={`bg-q2-carbon border border-q2-graphite-d rounded-xl p-6 md:p-7 ${className}`}
    >
      <figcaption className="sr-only">
        {isFr
          ? 'Exemple de conversation dans le chat de configuration: un horaire modifié, puis des tarifs lus sur une photo et confirmés avant ajout.'
          : 'Example conversation in the configuration chat: an opening hour changed, then rates read from a photo and confirmed before they are added.'}
      </figcaption>

      <div className="flex items-baseline justify-between gap-4 pb-5 border-b border-q2-graphite-d">
        <p className="q2-eyebrow text-q2-fog">{isFr ? 'Chat de configuration' : 'Configuration chat'}</p>
        <span className="text-[11px] text-q2-fog tabular-nums">{isFr ? 'aujourd’hui' : 'today'}</span>
      </div>

      <div className="pt-6 space-y-5">
        {/* Tour 1: une phrase, un réglage changé */}
        <p className="ml-auto max-w-[80%] w-fit rounded-xl bg-q2-obsidian px-4 py-3 text-[14px] leading-snug text-q2-mist q2-body-text">
          {isFr ? `Ouvre le samedi de 9${NB}h à 13${NB}h.` : 'Open on Saturdays from 9 am to 1 pm.'}
        </p>

        <div className="max-w-[86%]">
          <p className="rounded-xl border border-q2-graphite-d px-4 py-3 text-[14px] leading-snug text-q2-mist q2-body-text">
            {isFr
              ? 'C’est fait. Samedi ajouté à vos horaires d’ouverture.'
              : 'Done. Saturday added to your opening hours.'}
          </p>
          <p className="mt-2.5 ml-1 flex items-center gap-2.5 text-[12.5px] text-q2-fog tabular-nums">
            <Check size={13} className="shrink-0 text-q2-lift" aria-hidden="true" />
            {isFr ? 'Samedi' : 'Saturday'}
            <span aria-hidden="true">·</span>
            09:00 – 13:00
          </p>
        </div>

        {/* Tour 2: la carte de prix arrive en photo, vignette abstraite */}
        <div className="ml-auto max-w-[80%] w-fit rounded-xl bg-q2-obsidian px-4 py-3.5">
          <div
            className="rounded-lg border border-q2-smoke-d bg-q2-carbon px-3 py-3 space-y-1.5"
            aria-hidden="true"
          >
            <span className="block h-1.5 w-2/3 rounded-full bg-q2-smoke-d" />
            <span className="block h-1 w-full rounded-full bg-q2-graphite-d" />
            <span className="block h-1 w-5/6 rounded-full bg-q2-graphite-d" />
            <span className="block h-1 w-4/6 rounded-full bg-q2-graphite-d" />
          </div>
          <p className="mt-2.5 flex items-center gap-2 text-[12px] text-q2-fog">
            <Paperclip size={12} className="shrink-0" aria-hidden="true" />
            {isFr ? 'ma-carte.jpg' : 'my-rate-card.jpg'}
          </p>
          <p className="mt-2 text-[14px] leading-snug text-q2-mist q2-body-text">
            {isFr ? 'Voilà mes tarifs.' : 'Here are my rates.'}
          </p>
        </div>

        <div className="max-w-[86%]">
          <p className="rounded-xl border border-q2-graphite-d px-4 py-3 text-[14px] leading-snug text-q2-mist q2-body-text">
            {isFr
              ? `Trois lignes lues. Confirmez avant que je les ajoute${NB}:`
              : 'Three lines read. Confirm before I add them:'}
          </p>
          <ul className="mt-3 border-t border-q2-graphite-d" role="list">
            {rates.map((rate) => (
              <li
                key={rate.name}
                className="flex items-baseline justify-between gap-4 border-b border-q2-graphite-d py-2.5 text-[13.5px]"
              >
                <span className="text-q2-mist q2-body-text">{rate.name}</span>
                <span className="text-white tabular-nums whitespace-nowrap">{rate.price}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center rounded-full bg-q2-indigo px-4 py-2 text-[13px] font-medium text-white">
              {isFr ? 'Ajouter' : 'Add'}
            </span>
            <span className="inline-flex items-center rounded-full border border-q2-smoke-d px-4 py-2 text-[13px] font-medium text-q2-mist">
              {isFr ? 'Annuler' : 'Cancel'}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-6 pt-5 border-t border-q2-graphite-d text-[12.5px] leading-relaxed text-q2-fog q2-body-text">
        {isFr
          ? 'Rien n’est écrit sans votre confirmation. Aucune image n’est conservée.'
          : 'Nothing is written without your confirmation. No image is kept.'}
      </p>
    </figure>
  );
}
