import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, type LucideIcon } from 'lucide-react';

/* Kit produit V2 « instrument » — remplace ProBlocks/OverviewBlocks et les
   primitives locales dupliquées, côté client uniquement. Règles:
   DA/v2-direction.md (addendum registre produit). Surfaces carbon, bordures
   hairline #23252A, zéro ombre, un accent indigo par vue. */

/* ── Surfaces ── */

export function Card({
  children,
  className = '',
  pad = true,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={`bg-q2-carbon border border-q2-graphite-d rounded-xl ${pad ? 'p-5' : ''} ${className}`}>
      {children}
    </section>
  );
}

export function SectionHead({
  title,
  action,
  className = '',
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 mb-3 ${className}`}>
      <h2 className="q2-eyebrow text-q2-fog">{title}</h2>
      {action}
    </div>
  );
}

/* Barre d'actions sous le titre de page (le h1 vit dans AppShell) */
export function PageActions({
  children,
  subtitle,
  className = '',
}: {
  children?: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 flex-wrap mb-6 ${className}`}>
      {subtitle ? <p className="text-[13px] text-q2-fog q2-body-text">{subtitle}</p> : <span />}
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

/* ── KPI ── */

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  to,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  to?: string;
  tone?: 'ok' | 'warn' | 'bad' | 'accent';
}) {
  const toneColor =
    tone === 'ok'
      ? 'var(--q2p-ok)'
      : tone === 'warn'
        ? 'var(--q2p-warn)'
        : tone === 'bad'
          ? 'var(--q2p-bad)'
          : tone === 'accent'
            ? 'var(--q2-lift)'
            : undefined;
  const body = (
    <>
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon size={13} className="text-q2-fog" aria-hidden="true" />}
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog">{label}</p>
      </div>
      <p className="text-[26px] font-light tracking-tight text-white tabular-nums leading-none" style={toneColor ? { color: toneColor } : undefined}>
        {value}
      </p>
      {hint && <p className="text-[11.5px] text-q2-fog mt-2">{hint}</p>}
    </>
  );
  if (to) {
    return (
      <Link
        to={to}
        className="block bg-q2-carbon border border-q2-graphite-d rounded-xl p-4 hover:border-q2-smoke-d transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
      >
        {body}
      </Link>
    );
  }
  return <div className="bg-q2-carbon border border-q2-graphite-d rounded-xl p-4">{body}</div>;
}

/* ── Rangée de réglages/navigation 56px (l'ex-Row dupliqué 3×) ── */

export function Row({
  icon: Icon,
  label,
  hint,
  right,
  to,
  onClick,
  danger = false,
  first = false,
}: {
  icon?: LucideIcon;
  label: ReactNode;
  hint?: ReactNode;
  right?: ReactNode;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
  first?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-3.5 min-w-0">
        {Icon && (
          <span className="w-8 h-8 shrink-0 rounded-lg bg-q2-obsidian flex items-center justify-center">
            <Icon size={15} aria-hidden="true" className={danger ? 'text-[color:var(--q2p-bad)]' : 'text-q2-lift'} />
          </span>
        )}
        <div className="min-w-0 text-left">
          <p className={`text-[13.5px] font-medium truncate ${danger ? 'text-[color:var(--q2p-bad)]' : 'text-white'}`}>{label}</p>
          {hint && <p className="text-[11.5px] text-q2-fog truncate">{hint}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {right}
        {(to || onClick) && <ChevronRight size={14} className="text-q2-fog" aria-hidden="true" />}
      </div>
    </>
  );
  const cls = `w-full min-h-[56px] flex items-center justify-between gap-3 px-4 ${
    first ? '' : 'border-t border-q2-graphite-d'
  } ${to || onClick ? 'hover:bg-q2-obsidian/60 transition-colors duration-100 focus:outline-none focus-visible:bg-q2-obsidian' : ''}`;
  if (to) {
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

/* ── Boutons pilule ── */

const BTN_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-full text-[13px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 disabled:opacity-50 disabled:pointer-events-none';

export function PrimaryBtn({ className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} className={`${BTN_BASE} bg-q2-indigo text-white hover:bg-q2-deep h-9 px-4 ${className}`} />;
}

export function GhostBtn({ className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`${BTN_BASE} bg-transparent text-q2-mist border border-q2-graphite-d hover:border-q2-smoke-d h-9 px-4 ${className}`}
    />
  );
}

export function DangerBtn({ className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`${BTN_BASE} bg-transparent border h-9 px-4 ${className}`}
      style={{ color: 'var(--q2p-bad)', borderColor: 'color-mix(in oklch, var(--q2p-bad) 40%, transparent)' }}
    />
  );
}

/* ── Formulaires ── */

export const inputCls =
  'w-full bg-q2-obsidian border border-q2-graphite-d rounded-xl px-3.5 py-2.5 text-[13px] text-white placeholder:text-q2-fog focus:outline-none focus:border-q2-indigo/60 focus:ring-2 focus:ring-q2-indigo/25 transition-colors duration-150';

export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[12px] font-medium text-q2-mist mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-q2-fog mt-1.5">{hint}</span>}
    </label>
  );
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${inputCls} ${className}`} />;
}

export function Select({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...rest} className={`${inputCls} ${className}`} />;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={`${inputCls} ${className}`} />;
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-[38px] h-[22px] rounded-full transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 disabled:opacity-50 ${
        checked ? 'bg-q2-indigo' : 'bg-q2-graphite-d'
      }`}
    >
      <span
        className="absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform duration-150"
        style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
      />
    </button>
  );
}

/* ── Statuts ── */

export function Pill({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';
  className?: string;
}) {
  const color =
    tone === 'ok'
      ? 'var(--q2p-ok)'
      : tone === 'warn'
        ? 'var(--q2p-warn)'
        : tone === 'bad'
          ? 'var(--q2p-bad)'
          : tone === 'info'
            ? 'var(--q2p-info)'
            : tone === 'accent'
              ? 'var(--q2-lift)'
              : undefined;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-q2-obsidian border border-q2-graphite-d px-2.5 py-0.5 text-[11px] font-medium ${
        color ? '' : 'text-q2-mist'
      } ${className}`}
      style={color ? { color } : undefined}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {Icon && (
        <span className="w-10 h-10 rounded-full bg-q2-obsidian flex items-center justify-center mb-4">
          <Icon size={18} className="text-q2-fog" aria-hidden="true" />
        </span>
      )}
      <p className="text-[14px] font-medium text-white mb-1">{title}</p>
      {description && <p className="text-[12.5px] text-q2-fog max-w-[320px] q2-body-text">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── Table ── */

export const tableCls = {
  wrap: 'overflow-x-auto',
  table: 'w-full text-left',
  th: 'text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog py-2.5 px-3 border-b border-q2-graphite-d whitespace-nowrap',
  td: 'text-[13px] text-q2-mist py-3 px-3 border-b border-q2-graphite-d tabular-nums',
  tr: 'hover:bg-q2-obsidian/50 transition-colors duration-100',
};

/* ── Jauge linéaire (quota minutes, etc.) ── */

export function Meter({
  value,
  max,
  label,
  warnAt = 0.8,
}: {
  value: number;
  max: number;
  label: string;
  warnAt?: number;
}) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const color = ratio >= 1 ? 'var(--q2p-bad)' : ratio >= warnAt ? 'var(--q2p-warn)' : 'var(--q2-indigo)';
  return (
    <div role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className="h-1.5 rounded-full bg-q2-obsidian overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: color }} />
      </div>
    </div>
  );
}
