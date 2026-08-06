import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import PublicShell from './PublicShell';
import { Container, Eyebrow, Display } from './Primitives';
import RevealV2 from './RevealV2';
import { useLang } from '../../stores/langStore';

/* Shell des pages légales V2 « Papier & Signal », voir DA/v2-direction.md.
   Header éditorial (eyebrow, display whisper, date), puis grille [TOC sticky | mesure 680px].
   Le scroll-spy reprend le mécanisme de la V1 (pages/legal/Privacy.tsx). */

export interface LegalSectionRef {
  id: string;
  label: string;
}

/* Liens en ligne: encre soulignée, jamais de mauve sur le canvas clair. */
export const LEGAL_LINK =
  'text-q2-ink underline decoration-1 decoration-q2-faint underline-offset-4 hover:decoration-q2-ink transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 rounded-sm';

interface LegalShellProps {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  /* Date de mise à jour: valeur machine + libellé lisible.
     Optionnelle: le SLA ne date pas ses révisions. */
  updatedISO?: string;
  updatedLabel?: string;
  meta?: ReactNode;
  sections: LegalSectionRef[];
  /* Bloc optionnel sous le sommaire (voir aussi, action rapide) */
  asideExtra?: ReactNode;
  children: ReactNode;
}

export default function LegalShell({
  eyebrow,
  title,
  lead,
  updatedISO,
  updatedLabel,
  meta,
  sections,
  asideExtra,
  children,
}: LegalShellProps) {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-25% 0px -65% 0px', threshold: 0 },
    );

    sections.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  const handleAnchorClick = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const target = document.getElementById(id);
    if (target) {
      const offset = 100;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
      window.history.replaceState(null, '', `#${id}`);
    }
  };

  return (
    <PublicShell>
      <div className="bg-q2-canvas pt-16 md:pt-24 pb-24">
        <Container>
          <RevealV2 as="header" className="mb-14 md:mb-20 max-w-[860px]">
            <Eyebrow tone="indigo" className="mb-6">
              {eyebrow}
            </Eyebrow>
            <Display className="mb-6">{title}</Display>
            {lead && (
              <p className="q2-lead text-q2-body max-w-[560px] mb-8 q2-body-text">{lead}</p>
            )}
            {(updatedLabel || meta) && (
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm text-q2-body border-t border-q2-plate pt-5">
                {updatedLabel && (
                  <>
                    <span className="text-q2-body">
                      {isFr ? 'Dernière mise à jour' : 'Last updated'}
                    </span>
                    <time className="font-medium text-q2-ink" dateTime={updatedISO}>
                      {updatedLabel}
                    </time>
                  </>
                )}
                {meta && <span className="text-q2-body">{meta}</span>}
              </div>
            )}
          </RevealV2>

          <div className="grid lg:grid-cols-[240px_1fr] gap-12 lg:gap-20">
            <aside
              aria-label={isFr ? 'Table des matières' : 'Table of contents'}
              className="lg:sticky lg:top-24 lg:self-start print:hidden"
            >
              <p className="q2-eyebrow text-q2-body mb-4">{isFr ? 'Sommaire' : 'Contents'}</p>
              <nav aria-label={isFr ? 'Navigation des sections' : 'Section navigation'}>
                <ol className="border-l border-q2-plate" role="list">
                  {sections.map((section) => {
                    const isActive = activeId === section.id;
                    return (
                      <li key={section.id}>
                        <a
                          href={`#${section.id}`}
                          onClick={(event) => handleAnchorClick(event, section.id)}
                          aria-current={isActive ? 'true' : undefined}
                          className={`block -ml-px pl-4 py-1.5 text-sm leading-snug border-l transition-colors duration-150 focus:outline-none focus-visible:text-q2-ink ${
                            isActive
                              ? 'border-q2-indigo text-q2-ink font-medium'
                              : 'border-transparent text-q2-body hover:text-q2-ink'
                          }`}
                        >
                          {section.label}
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              {asideExtra && <div className="mt-10 hidden lg:block">{asideExtra}</div>}
            </aside>

            <article
              id="legal-content"
              className="max-w-[680px] text-base leading-[1.6] text-q2-graphite q2-body-text print:max-w-none"
            >
              {children}
            </article>
          </div>
        </Container>
      </div>

      <style>{`
        @media print {
          aside[aria-label], .print\\:hidden { display: none !important; }
          article { max-width: 100% !important; }
          h1, h2, h3 { page-break-after: avoid; }
          h2 { margin-top: 1.5rem !important; }
          section { page-break-inside: avoid; }
          a { text-decoration: underline; }
        }
      `}</style>
    </PublicShell>
  );
}

/* ── Blocs de contenu partagés par les 4 documents ───────────────────── */

export function LegalSection({
  id,
  title,
  children,
  last = false,
}: {
  id: string;
  title: ReactNode;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`h-${id}`}
      className={`scroll-mt-24 ${last ? 'mb-8' : 'mb-16'}`}
    >
      <h2 id={`h-${id}`} className="q2-h3 text-q2-ink mb-5">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LegalP({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`mb-4 last:mb-0 ${className}`}>{children}</p>;
}

export function LegalH3({ children }: { children: ReactNode }) {
  return <h3 className="text-[15px] font-medium text-q2-ink mt-10 mb-4">{children}</h3>;
}

/* Liste éditoriale: hairlines, pas de puces décoratives ni de cards */
export function LegalList({ items }: { items: string[] }) {
  return (
    <ul role="list" className="border-t border-q2-plate">
      {items.map((item) => (
        <li key={item} className="border-b border-q2-plate py-3">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function LegalTable({
  head,
  rows,
  caption,
}: {
  head: ReactNode[];
  rows: ReactNode[][];
  caption: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-y border-q2-plate">
            {head.map((label, i) => (
              <th
                key={i}
                scope="col"
                className="text-left align-bottom font-medium text-q2-ink px-3 py-3 first:pl-0 last:pr-0 whitespace-nowrap"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-q2-plate">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-3 py-3 align-top first:pl-0 last:pr-0 ${
                    j === 0 ? 'text-q2-ink font-medium' : 'text-q2-body'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Encart d'information: bande taupe pleine, jamais de filet latéral ni de modal */
export function LegalNote({
  label,
  ariaLabel,
  children,
}: {
  label: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <aside role="note" aria-label={ariaLabel} className="mb-14 rounded-[20px] bg-q2-band p-8">
      <p className="q2-eyebrow text-q2-indigo mb-3">{label}</p>
      <div className="text-[15px] leading-[1.6] text-q2-graphite">{children}</div>
    </aside>
  );
}

export function LegalCloser({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  return (
    <div className="mt-20 pt-8 border-t border-q2-plate text-[13px] text-q2-body flex flex-wrap items-baseline gap-x-4 gap-y-1 print:hidden">
      <span className="q2-serif-word">{isFr ? 'Fin du document.' : 'End of document.'}</span>
      <span>{children}</span>
    </div>
  );
}
