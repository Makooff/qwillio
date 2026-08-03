import type { ReactNode, HTMLAttributes } from 'react';

/* Design V2 « Papier & Signal » — primitives de mise en page.
   Tokens et règles: DA/v2-direction.md. */

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`max-w-[1200px] mx-auto px-6 lg:px-10 ${className}`}>{children}</div>;
}

type SectionVariant = 'canvas' | 'band' | 'drenched-indigo' | 'drenched-violet';

const SECTION_BG: Record<SectionVariant, string> = {
  canvas: 'bg-q2-canvas',
  band: 'bg-q2-band',
  'drenched-indigo': 'q2-drenched',
  'drenched-violet': 'q2-drenched-violet',
};

interface SectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  variant?: SectionVariant;
  hairline?: boolean;
  className?: string;
}

export function Section({ children, variant = 'canvas', hairline = false, className = '', ...rest }: SectionProps) {
  const dark = variant.startsWith('drenched');
  return (
    <section
      {...rest}
      data-register={dark ? 'drenched' : 'light'}
      className={`${SECTION_BG[variant]} ${hairline ? 'q2-hairline' : ''} py-24 md:py-32 ${className}`}
    >
      {children}
    </section>
  );
}

export function Eyebrow({
  children,
  tone = 'indigo',
  onDark = false,
  className = '',
}: {
  children: ReactNode;
  /* indigo = inbound/réceptionniste, violet = outbound/agent (DA/couleurs.md) */
  tone?: 'indigo' | 'violet' | 'neutral';
  onDark?: boolean;
  className?: string;
}) {
  const color =
    tone === 'indigo'
      ? onDark
        ? 'text-q2-lift'
        : 'text-q2-indigo'
      : tone === 'violet'
        ? 'text-q2-violet'
        : onDark
          ? 'text-q2-fog'
          : 'text-q2-body';
  return <p className={`q2-eyebrow ${color} ${className}`}>{children}</p>;
}

export function Display({
  children,
  as: Tag = 'h1',
  onDark = false,
  className = '',
  ...rest
}: {
  children: ReactNode;
  as?: 'h1' | 'h2';
  onDark?: boolean;
  className?: string;
} & HTMLAttributes<HTMLHeadingElement>) {
  return (
    <Tag {...rest} className={`q2-display ${onDark ? 'text-white' : 'text-q2-ink'} ${className}`}>
      {children}
    </Tag>
  );
}

export function H2({
  children,
  onDark = false,
  className = '',
  ...rest
}: {
  children: ReactNode;
  onDark?: boolean;
  className?: string;
} & HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 {...rest} className={`q2-h2 ${onDark ? 'text-white' : 'text-q2-ink'} ${className}`}>
      {children}
    </h2>
  );
}

export function Lead({
  children,
  onDark = false,
  className = '',
}: {
  children: ReactNode;
  onDark?: boolean;
  className?: string;
}) {
  return <p className={`q2-lead ${onDark ? 'text-q2-mist' : 'text-q2-body'} ${className}`}>{children}</p>;
}

/* Le mot serif italic autorisé (un seul par titre, DA/typographie.md) */
export function SerifWord({ children }: { children: ReactNode }) {
  return <em className="q2-serif-word">{children}</em>;
}

export function Hairline({ onDark = false, className = '' }: { onDark?: boolean; className?: string }) {
  return (
    <hr
      aria-hidden="true"
      className={`border-0 border-t ${onDark ? 'border-q2-graphite-d' : 'border-q2-plate'} ${className}`}
    />
  );
}
