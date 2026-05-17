import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { pro, proShadow } from '../../styles/pro-theme';

/**
 * Reusable Dark Luxury AI building blocks shared by every dashboard
 * page (admin + client). Linear × Raycast × Vercel dark direction.
 */

type CardSize = 'sm' | 'md' | 'lg';

const cardRadius: Record<CardSize, number> = {
  sm: 12,
  md: 16,
  lg: 20,
};

export function Card({
  children, className = '', glow, size = 'md',
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  size?: CardSize;
}) {
  return (
    <div
      className={`pro-card border ${className}`}
      style={{
        background: pro.panel,
        borderColor: pro.border,
        borderRadius: cardRadius[size],
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: glow ? proShadow.glow : proShadow.card,
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      {children}
    </div>
  );
}

export function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <h2 className="flex items-center text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: pro.textSec }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: pro.accent,
            display: 'inline-block',
            marginRight: 8,
            flexShrink: 0,
            boxShadow: `0 0 6px ${pro.accentGlow}`,
          }}
        />
        {title}
      </h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title, subtitle, right, badge,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          {badge && (
            <Pill color="accent">{badge}</Pill>
          )}
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: pro.text,
            }}
          >
            {title}
          </h1>
        </div>
        {subtitle && (
          <p className="text-[12.5px] mt-0.5" style={{ color: pro.textSec }}>{subtitle}</p>
        )}
      </div>
      {right && <div className="flex items-center gap-2 flex-shrink-0">{right}</div>}
    </div>
  );
}

export function Stat({
  label, value, hint, icon: Icon, to,
  trend, accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  to?: string;
  trend?: { value: number; dir: 'up' | 'down' };
  accent?: boolean;
}) {
  const trendBg = trend
    ? trend.dir === 'up'
      ? 'rgba(34,197,94,0.12)'
      : 'rgba(239,68,68,0.12)'
    : undefined;
  const trendColor = trend
    ? trend.dir === 'up' ? pro.ok : pro.bad
    : undefined;

  const inner = (
    <Card
      glow={accent}
      className={to ? 'hover:border-white/[0.14] transition-colors' : ''}
    >
      <div className="p-4" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Ambient radial glow top-right */}
        <div
          style={{
            position: 'absolute',
            top: -24,
            right: -24,
            width: 80,
            height: 80,
            background: accent
              ? `radial-gradient(circle, ${pro.accentDim} 0%, transparent 70%)`
              : `radial-gradient(circle, ${pro.accentMid} 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Trend chip */}
        {trend && (
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 999,
              background: trendBg,
              color: trendColor,
            }}
          >
            {trend.dir === 'up' ? '↑' : '↓'}
            {Math.abs(trend.value)}%
          </div>
        )}

        {/* Icon badge */}
        {Icon && (
          <div
            className="mb-3"
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: pro.accentMid,
              border: `1px solid ${pro.accentGlow}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={14} style={{ color: pro.accent }} />
          </div>
        )}

        {/* Label */}
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: pro.textTer,
            marginBottom: 6,
          }}
        >
          {label}
        </p>

        {/* Value — solid color, no gradient */}
        <p
          className="stat-num"
          style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            lineHeight: 1,
            color: pro.text,
          }}
        >
          {value}
        </p>

        {hint && (
          <p className="text-[11.5px] mt-1.5" style={{ color: pro.textTer }}>{hint}</p>
        )}
      </div>
    </Card>
  );

  return to ? <Link to={to} className="block">{inner}</Link> : inner;
}

export function Row({
  icon: Icon, label, hint, badge, onClick, to, danger,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  hint?: string;
  badge?: React.ReactNode;
  onClick?: () => void;
  to?: string;
  danger?: boolean;
}) {
  const inner = (
    <div
      className={`flex items-center gap-3.5 px-4 h-[58px] group transition-colors ${danger ? 'hover:bg-red-500/[0.05]' : 'hover:bg-white/[0.02]'}`}
      style={{ position: 'relative' }}
    >
      {/* Left active indicator */}
      <span
        className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ width: 3, height: 20, background: danger ? pro.bad : pro.accent }}
      />

      <div
        className="w-8 h-8 flex items-center justify-center flex-shrink-0"
        style={{
          borderRadius: 10,
          background: danger ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.05)',
        }}
      >
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
  return <button type="button" onClick={onClick} className="w-full text-left cursor-pointer">{inner}</button>;
}

export function IconBtn({
  onClick, title, children, active,
}: {
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
      style={{ color: active ? pro.text : pro.textSec }}
    >
      {children}
    </button>
  );
}

export function PrimaryBtn({
  onClick, disabled, children, size = 'md',
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  size?: 'sm' | 'md';
}) {
  const h = size === 'sm' ? 'h-8 text-[12px]' : 'h-9 text-[12.5px]';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-4 ${h} font-medium rounded-xl disabled:opacity-40 cursor-pointer`}
      style={{
        background: pro.accentGrad,
        color: '#fff',
        boxShadow: proShadow.btn,
        transition: 'filter 0.15s ease',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.08)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = ''; }}
    >
      {children}
    </button>
  );
}

export function GhostBtn({
  onClick, disabled, children, size = 'md',
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  size?: 'sm' | 'md';
}) {
  const h = size === 'sm' ? 'h-8 text-[12px]' : 'h-9 text-[12.5px]';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-4 ${h} font-medium rounded-xl transition-colors disabled:opacity-40 hover:bg-white/[0.07] cursor-pointer`}
      style={{
        background: 'rgba(255,255,255,0.03)',
        color: pro.text,
        border: `1px solid ${pro.border}`,
      }}
    >
      {children}
    </button>
  );
}

export function Pill({ color = 'neutral', children }: {
  color?: 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';
  children: React.ReactNode;
}) {
  const map: Record<string, { bg: string; fg: string; shadow?: string }> = {
    neutral: { bg: 'rgba(255,255,255,0.05)',        fg: pro.textSec },
    ok:      { bg: `${pro.ok}1a`,                   fg: pro.ok,     shadow: `0 0 8px ${pro.okGlow}` },
    warn:    { bg: `${pro.warn}1a`,                 fg: pro.warn },
    bad:     { bg: `${pro.bad}1a`,                  fg: pro.bad,    shadow: `0 0 8px ${pro.badGlow}` },
    info:    { bg: `${pro.info}1a`,                 fg: pro.info },
    accent:  { bg: pro.accentDim,                   fg: pro.accent },
  };
  const m = map[color];
  return (
    <span
      className="text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
      style={{
        background: m.bg,
        color: m.fg,
        ...(m.shadow ? { textShadow: m.shadow } : {}),
      }}
    >
      {children}
    </span>
  );
}
