import type { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';

/* Pilules V2 — 9999px non négociable (DA/v2-direction.md).
   Sur canvas clair le CTA primaire est encre pleine, jamais mauve.
   Sur drenched, `chromatic` est LA seule action colorée de la section. */

type Variant = 'primary' | 'outline' | 'ghost' | 'onDark' | 'chromatic';

const STYLES: Record<Variant, string> = {
  primary:
    'bg-q2-ink text-white hover:bg-black focus-visible:ring-q2-indigo/40',
  outline:
    'bg-q2-canvas text-q2-ink border border-q2-plate hover:border-q2-faint focus-visible:ring-q2-indigo/40',
  ghost:
    'bg-transparent text-q2-ink hover:bg-q2-band focus-visible:ring-q2-indigo/40',
  onDark:
    'bg-white text-q2-void hover:bg-q2-mist focus-visible:ring-white/50',
  chromatic:
    'bg-q2-indigo text-white hover:bg-q2-deep focus-visible:ring-q2-lift/60',
};

const SIZES = {
  md: 'text-sm font-medium px-5 py-2.5',
  lg: 'text-[15px] font-medium px-7 py-3.5',
};

/* `q2-pill` (v2.css) porte le survol (translateY -1px, 120ms), le press
   composé avec le scale(0.97) global, et le glissement de la flèche finale. */
const BASE =
  'q2-pill inline-flex items-center justify-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 min-h-[44px]';

interface CommonProps {
  variant?: Variant;
  size?: keyof typeof SIZES;
  className?: string;
  children: ReactNode;
}

type PillLinkProps = CommonProps & { to: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>;

export function PillLink({ to, variant = 'primary', size = 'md', className = '', children, ...rest }: PillLinkProps) {
  const cls = `${BASE} ${STYLES[variant]} ${SIZES[size]} ${className}`;
  const external = to.startsWith('http') || to.endsWith('.html') || to.startsWith('mailto:');
  if (external) {
    return (
      <a href={to} className={cls} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={cls} {...rest}>
      {children}
    </Link>
  );
}

type PillButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function PillButton({ variant = 'primary', size = 'md', className = '', children, ...rest }: PillButtonProps) {
  return (
    <button className={`${BASE} ${STYLES[variant]} ${SIZES[size]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
