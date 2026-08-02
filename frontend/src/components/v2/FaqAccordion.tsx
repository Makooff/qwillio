import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/* Accordéon FAQ V2 — remplace le mur de texte déplié de la V1.
   Pas de modal, pas de grille: liste hairline, un item ouvert à la fois.
   Le JSON-LD reste géré par la page (contenu complet, indépendant de l'état UI). */

export interface FaqEntry {
  q: string;
  a: string;
}

export default function FaqAccordion({
  items,
  onDark = false,
  className = '',
}: {
  items: FaqEntry[];
  onDark?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();
  const border = onDark ? 'border-q2-graphite-d' : 'border-q2-plate';
  const question = onDark ? 'text-white' : 'text-q2-ink';
  const answer = onDark ? 'text-q2-mist' : 'text-q2-body';

  return (
    <dl className={`border-t ${border} ${className}`}>
      {items.map((item, i) => {
        const isOpen = open === i;
        const panelId = `${baseId}-faq-${i}`;
        return (
          <div key={item.q} className={`border-b ${border}`}>
            <dt>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className={`w-full flex items-center justify-between gap-4 py-5 text-left text-[15px] font-medium ${question} focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 rounded-md`}
              >
                {item.q}
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${onDark ? 'text-q2-fog' : 'text-q2-body'}`}
                />
              </button>
            </dt>
            <dd
              id={panelId}
              className={`grid transition-[grid-template-rows] duration-300 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
            >
              <div className="overflow-hidden">
                <p className={`pb-5 text-sm leading-relaxed q2-body-text ${answer} max-w-[560px]`}>{item.a}</p>
              </div>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
