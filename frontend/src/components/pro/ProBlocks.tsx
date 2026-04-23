import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { pro } from '../../styles/pro-theme';

/**
 * Reusable Stripe/Vercel-style building blocks shared by every dashboard
 * page (admin + client).
 */

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border ${className}`}
         style={{ background: pro.panel, borderColor: pro.border }}>
      {children}
    </div>
  );
}

export function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: pro.textSec }}>
        {title}
      </h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title, subtitle, right,
}: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: pro.text }}>{title}</h1>
        {subtitle && <p className="text-[12.5px] mt-0.5" style={{ color: pro.textSec }}>{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2 flex-shrink-0">{right}</div>}
    </div>
  );
}

export function Stat({
  label, value, hint, icon: Icon, to,
}: {
  label: string; value: string | number; hint?: string;
  icon?: any; to?: string;
}) {
  const inner = (
    <Card className={to ? 'hover:border-white/[0.14] transition-colors' : ''}>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          {Icon && <Icon size={14} style={{ color: pro.textSec }} />}
          <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: pro.textTer }}>{label}</p>
        </div>
        <p className="text-[26px] font-semibold tabular-nums leading-none" style={{ color: pro.text }}>{value}</p>
        {hint && <p className="text-[11.5px] mt-1.5" style={{ color: pro.textTer }}>{hint}</p>}
      </div>
    </Card>
  );
  return to ? <Link to={to} className="block">{inner}</Link> : inner;
}

export function Row({
  icon: Icon, label, hint, badge, onClick, to, danger,
}: {
  icon: any; label: string; hint?: string; badge?: React.ReactNode;
  onClick?: () => void; to?: string; danger?: boolean;
}) {
  const inner = (
    <div className={`flex items-center gap-3.5 px-4 h-[58px] group transition-colors ${danger ? 'hover:bg-red-500/[0.05]' : 'hover:bg-white/[0.02]'}`}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
           style={{ background: danger ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.05)' }}>
        <Icon size={14} style={{ color: danger ? pro.bad : pro.text }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate" style={{ color: danger ? pro.bad : pro.text }}>{label}</p>
        {hint && <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>{hint}</p>}
      </div>
      {badge}
      {(onClick || to) && <ChevronRight size={14} style={{ color: pro.textTer }} />}
    </div>
  );
  if (to) return <Link to={to} className="block">{inner}</Link>;
  return <button type="button" onClick={onClick} className="w-full text-left">{inner}</button>;
}

export function IconBtn({
  onClick, title, children, active,
}: { onClick?: () => void; title?: string; children: React.ReactNode; active?: boolean }) {
  return (
    <button onClick={onClick} title={title}
      className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
      style={{ color: active ? pro.text : pro.textSec }}>
      {children}
    </button>
  );
}

export function PrimaryBtn({
  onClick, disabled, children, size = 'md',
}: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-8 text-[12px]' : 'h-9 text-[12.5px]';
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-2 px-4 ${h} font-medium rounded-xl disabled:opacity-50 transition-colors`}
      style={{ background: pro.text, color: '#0B0B0D' }}>
      {children}
    </button>
  );
}

export function GhostBtn({
  onClick, disabled, children, size = 'md',
}: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-8 text-[12px]' : 'h-9 text-[12.5px]';
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-2 px-4 ${h} font-medium rounded-xl transition-colors disabled:opacity-50 hover:bg-white/[0.06]`}
      style={{ background: pro.panel, color: pro.text, border: `1px solid ${pro.border}` }}>
      {children}
    </button>
  );
}

export function Pill({ color = 'neutral', children }: {
  color?: 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent'; children: React.ReactNode;
}) {
  const map = {
    neutral: { bg: 'rgba(255,255,255,0.05)', fg: pro.textSec },
    ok:      { bg: 'rgba(34,197,94,0.10)',   fg: pro.ok },
    warn:    { bg: 'rgba(245,158,11,0.10)',  fg: pro.warn },
    bad:     { bg: 'rgba(239,68,68,0.10)',   fg: pro.bad },
    info:    { bg: 'rgba(96,165,250,0.10)',  fg: pro.info },
    accent:  { bg: 'rgba(123,92,240,0.12)',  fg: pro.accent },
  }[color];
  return (
    <span className="text-[10.5px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: map.bg, color: map.fg }}>
      {children}
    </span>
  );
}
