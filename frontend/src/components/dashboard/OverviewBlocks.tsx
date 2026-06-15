import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, ChevronRight, type LucideIcon } from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, CartesianGrid, XAxis, YAxis,
} from 'recharts';
import { pro, proShadow } from '../../styles/pro-theme';

/**
 * Overview blocks — analytics primitives in the Qwillio monochrome register.
 * Frameless by design: each block is a bare section with its own padding, meant
 * to be grouped under hairline dividers (no card borders). Colour is reserved
 * for deltas only — green up, red down. Shared by client + admin overviews.
 */

export type Dir = 'up' | 'down' | 'flat';

// ── Delta tag — the only place colour appears ─────────────────────────────────
export function DeltaTag({ pct, dir, suffix }: { pct: number; dir: Dir; suffix?: string }) {
  if (dir === 'flat' || pct === 0) {
    return (
      <span className="text-[11.5px]" style={{ color: pro.textTer }}>
        Stable{suffix ? ` ${suffix}` : ''}
      </span>
    );
  }
  const up = dir === 'up';
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] font-medium" style={{ color: up ? pro.ok : pro.bad }}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {pct}%
      {suffix && <span className="font-normal ml-1" style={{ color: pro.textTer }}>{suffix}</span>}
    </span>
  );
}

// ── KPI split row — borderless figures divided by hairlines ───────────────────
export interface KpiCell {
  label: string;
  value: string | number;
  delta?: { pct: number; dir: Dir };
  deltaSuffix?: string;
  /** Plain secondary text, shown when there is no delta. */
  hint?: string;
}

export function KpiSplit({ items }: { items: KpiCell[] }) {
  const cols = items.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3';
  return (
    <div className={`grid grid-cols-1 ${cols} divide-y divide-white/[0.06] sm:divide-y-0 sm:divide-x sm:divide-white/[0.06]`}>
      {items.map((k, i) => (
        <div key={i} className="py-4 sm:py-1 sm:px-6 first:sm:pl-0 last:sm:pr-0">
          <p className="text-[12px]" style={{ color: pro.textSec }}>{k.label}</p>
          <p className="text-[26px] font-semibold tabular-nums leading-none mt-2" style={{ color: pro.text }}>
            {k.value}
          </p>
          {k.delta ? (
            <div className="mt-2.5">
              <DeltaTag pct={k.delta.pct} dir={k.delta.dir} suffix={k.deltaSuffix} />
            </div>
          ) : k.hint ? (
            <p className="text-[11.5px] mt-2.5" style={{ color: pro.textTer }}>{k.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ── Hero trend panel — big figure + monochrome area chart ─────────────────────
export interface SeriesPoint { label: string; value: number }

const LINE = 'oklch(90% 0 0)';

function HeroTooltip({ active, payload, label, unit }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-xl"
      style={{ background: pro.panelHi, border: `1px solid ${pro.borderHi}`, boxShadow: proShadow.float }}
    >
      <p className="text-[11px] mb-1" style={{ color: pro.textTer }}>{label}</p>
      <p className="text-[15px] font-bold tabular-nums" style={{ color: pro.text }}>
        {payload[0].value.toLocaleString('fr-FR')}
        {unit && <span className="text-[11px] font-normal ml-1" style={{ color: pro.textSec }}>{unit}</span>}
      </p>
    </div>
  );
}

function buildDemoSeries(): SeriesPoint[] {
  const shape = [62, 58, 65, 71, 68, 74, 70, 78, 82, 80, 86, 92];
  const today = new Date();
  return shape.map((v, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (shape.length - 1 - i) * 3);
    return { label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), value: v };
  });
}

export function HeroTrendPanel({
  value, label, delta, deltaSuffix, series, unit,
}: {
  value: string;
  label: string;
  delta?: { pct: number; dir: Dir };
  deltaSuffix?: string;
  series: SeriesPoint[];
  unit?: string;
}) {
  const demo = series.length === 0;
  const demoData = useMemo(buildDemoSeries, []);
  const data = demo ? demoData : series;

  return (
    <div className="py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[38px] font-semibold tabular-nums leading-none tracking-tight" style={{ color: pro.text }}>
            {value}
          </p>
          <p className="text-[12.5px] mt-2" style={{ color: pro.textSec }}>
            {label}{demo ? ' · données de démonstration' : ''}
          </p>
        </div>
        {delta && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <DeltaTag pct={delta.pct} dir={delta.dir} suffix={deltaSuffix} />
          </div>
        )}
      </div>

      <div style={{ height: 230 }} className="mt-5">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LINE} stopOpacity={0.22} />
                <stop offset="60%" stopColor={LINE} stopOpacity={0.06} />
                <stop offset="100%" stopColor={LINE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={pro.border} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: pro.textTer }}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={{ fontSize: 10, fill: pro.textTer }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={40}
            />
            <Tooltip content={<HeroTooltip unit={unit} />} cursor={{ stroke: pro.borderHi, strokeWidth: 1 }} />
            <Area
              type="natural"
              dataKey="value"
              stroke={LINE}
              strokeWidth={2}
              fill="url(#heroGrad)"
              dot={false}
              activeDot={{ r: 4, fill: LINE, strokeWidth: 0 }}
              isAnimationActive
              animationBegin={120}
              animationDuration={1100}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Radial tick gauge — speedometer of hairline ticks ─────────────────────────
export interface GaugeLegend { label: string; value: string; bright?: boolean }

export function RadialGauge({
  value, caption, fraction, icon: Icon, legend, action,
}: {
  value: string;
  caption: string;
  /** 0..1 share of ticks lit. */
  fraction: number;
  icon?: LucideIcon;
  legend?: GaugeLegend[];
  action?: { label: string; to: string };
}) {
  const N = 56;
  const span = 270;
  const start = -135;
  const cx = 130, cy = 130, rIn = 86, rOut = 104;
  const f = Math.max(0, Math.min(1, fraction));

  const ticks = Array.from({ length: N }, (_, i) => {
    const frac = i / (N - 1);
    const a = ((start + frac * span) * Math.PI) / 180;
    const sin = Math.sin(a), cos = Math.cos(a);
    return {
      x1: cx + rIn * sin, y1: cy - rIn * cos,
      x2: cx + rOut * sin, y2: cy - rOut * cos,
      on: frac <= f,
    };
  });

  return (
    <div className="py-6">
      <div className="relative mx-auto" style={{ width: 260, maxWidth: '100%', height: 200 }}>
        <svg viewBox="0 0 260 224" width="100%" height="100%" aria-hidden="true">
          {ticks.map((tk, i) => (
            <line
              key={i}
              x1={tk.x1} y1={tk.y1} x2={tk.x2} y2={tk.y2}
              stroke={tk.on ? pro.text : 'oklch(30% 0.01 265)'}
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingTop: 10 }}>
          {Icon && (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center mb-3"
              style={{ background: 'oklch(100% 0 0 / 0.05)', border: `1px solid ${pro.border}` }}
            >
              <Icon size={15} style={{ color: pro.textSec }} />
            </div>
          )}
          <p className="text-[11px] uppercase tracking-[0.08em]" style={{ color: pro.textTer }}>{caption}</p>
          <p className="text-[26px] font-semibold tabular-nums leading-none mt-2" style={{ color: pro.text }}>{value}</p>
        </div>
      </div>

      {legend && legend.length > 0 && (
        <div className="flex items-center justify-center gap-5 mt-1">
          {legend.map((l, i) => (
            <span key={i} className="inline-flex items-center gap-2 text-[11.5px]" style={{ color: pro.textSec }}>
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: l.bright ? pro.text : 'oklch(40% 0.01 265)' }}
              />
              {l.label}
              <span className="font-semibold tabular-nums" style={{ color: pro.text }}>{l.value}</span>
            </span>
          ))}
        </div>
      )}

      {action && (
        <Link
          to={action.to}
          className="mt-4 flex items-center justify-center gap-1.5 w-full h-9 rounded-xl text-[12.5px] font-medium transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          style={{ background: 'oklch(100% 0 0 / 0.03)', border: `1px solid ${pro.border}`, color: pro.text }}
        >
          {action.label} <ArrowUpRight size={13} />
        </Link>
      )}
    </div>
  );
}

// ── Tally meter — barcode bars with a lit share ───────────────────────────────
export function TallyMeter({
  value, caption, pct, legend,
}: {
  value: string;
  caption: string;
  pct: number;
  legend?: GaugeLegend[];
}) {
  const N = 56;
  const clamped = Math.max(0, Math.min(100, pct));
  const lit = Math.round((clamped / 100) * N);

  return (
    <div className="py-6">
      <p className="text-[11px] uppercase tracking-[0.08em]" style={{ color: pro.textTer }}>{caption}</p>
      <div className="flex items-end justify-between gap-3 mt-1.5">
        <p className="text-[26px] font-semibold tabular-nums leading-none" style={{ color: pro.text }}>{value}</p>
        <span className="text-[12px] font-medium tabular-nums" style={{ color: pro.textSec }}>{clamped}%</span>
      </div>

      <div className="flex items-end gap-[3px] mt-4" style={{ height: 44 }} aria-hidden="true">
        {Array.from({ length: N }, (_, i) => (
          <span
            key={i}
            className="flex-1 rounded-full"
            style={{
              height: i % 4 === 0 ? '100%' : '64%',
              background: i < lit ? pro.text : 'oklch(28% 0.01 265)',
            }}
          />
        ))}
      </div>

      {legend && legend.length > 0 && (
        <div className="flex items-center gap-5 mt-4">
          {legend.map((l, i) => (
            <span key={i} className="inline-flex items-center gap-2 text-[11.5px]" style={{ color: pro.textSec }}>
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: l.bright ? pro.text : 'oklch(40% 0.01 265)' }}
              />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Detail card — key/value rows + status + action ────────────────────────────
export type Tone = 'ok' | 'warn' | 'bad' | 'neutral';
const toneMap: Record<Tone, { bg: string; fg: string }> = {
  ok:      { bg: `${pro.ok}1a`,            fg: pro.ok },
  warn:    { bg: `${pro.warn}1a`,          fg: pro.warn },
  bad:     { bg: `${pro.bad}1a`,           fg: pro.bad },
  neutral: { bg: 'rgba(255,255,255,0.06)', fg: pro.textSec },
};

export function DetailCard({
  title, rows, action,
}: {
  title: string;
  rows: Array<{ k: string; v: string; status?: Tone }>;
  action?: { label: string; to: string };
}) {
  return (
    <div className="py-6">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: pro.textSec }}>{title}</h3>
      <dl className="mt-4 space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <dt className="text-[12.5px]" style={{ color: pro.textTer }}>{r.k}</dt>
            {r.status ? (
              <dd
                className="text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
                style={{ background: toneMap[r.status].bg, color: toneMap[r.status].fg }}
              >
                {r.v}
              </dd>
            ) : (
              <dd className="text-[12.5px] font-medium tabular-nums text-right" style={{ color: pro.text }}>{r.v}</dd>
            )}
          </div>
        ))}
      </dl>
      {action && (
        <Link
          to={action.to}
          className="mt-5 flex items-center justify-center gap-1.5 w-full h-9 rounded-xl text-[12.5px] font-medium transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          style={{ background: 'oklch(100% 0 0 / 0.03)', border: `1px solid ${pro.border}`, color: pro.text }}
        >
          {action.label} <ArrowUpRight size={13} />
        </Link>
      )}
    </div>
  );
}

// ── Needs attention list ──────────────────────────────────────────────────────
export interface AttnItem {
  icon: LucideIcon;
  label: string;
  to: string;
  count?: number;
  tone?: Tone;
}

export function AttentionList({ title, items, empty }: { title: string; items: AttnItem[]; empty?: string }) {
  return (
    <div className="py-6">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: pro.textSec }}>{title}</h3>
      {items.length === 0 ? (
        <p className="text-[12.5px] mt-3" style={{ color: pro.textTer }}>{empty ?? 'Rien à signaler.'}</p>
      ) : (
        <ul className="mt-2 -mx-2">
          {items.map((it, i) => {
            const tone = toneMap[it.tone ?? 'neutral'];
            return (
              <li key={i}>
                <Link
                  to={it.to}
                  className="flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 group"
                >
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: tone.bg }}
                  >
                    <it.icon size={14} style={{ color: tone.fg }} />
                  </span>
                  <span className="text-[12.5px] flex-1 min-w-0 truncate" style={{ color: pro.text }}>{it.label}</span>
                  {typeof it.count === 'number' && (
                    <span className="text-[11px] font-semibold tabular-nums" style={{ color: pro.textSec }}>{it.count}</span>
                  )}
                  <ChevronRight size={14} className="transition-colors flex-shrink-0" style={{ color: pro.textTer }} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Segment bar — usage broken into labelled segments ─────────────────────────
export interface Segment { label: string; pct: number; bright?: boolean }

export function SegmentBar({
  title, value, hint, segments, action,
}: {
  title: string;
  value: string;
  hint?: string;
  segments: Segment[];
  action?: { label: string; to: string };
}) {
  return (
    <div className="py-6 h-full">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: pro.textSec }}>{title}</h3>
        {action && (
          <Link
            to={action.to}
            className="text-[11.5px] font-medium transition-colors hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 rounded"
            style={{ color: pro.textSec }}
          >
            {action.label}
          </Link>
        )}
      </div>
      <p className="text-[28px] font-semibold tabular-nums leading-none mt-2" style={{ color: pro.text }}>{value}</p>
      {hint && <p className="text-[11.5px] mt-1.5" style={{ color: pro.textTer }}>{hint}</p>}

      <div className="flex items-center gap-1.5 mt-4">
        {segments.map((s, i) => (
          <div
            key={i}
            className="h-2 rounded-full"
            style={{
              width: `${s.pct}%`,
              background: s.bright ? pro.text : 'oklch(32% 0.01 265)',
              minWidth: s.pct > 0 ? 4 : 0,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3">
        {segments.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-[11.5px]" style={{ color: pro.textSec }}>
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: s.bright ? pro.text : 'oklch(40% 0.01 265)' }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Insight card — short generated sentence ───────────────────────────────────
export function InsightCard({
  kicker, icon: Icon, children, action,
}: {
  kicker: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  action?: { label: string; to: string };
}) {
  return (
    <div className="py-6 h-full flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: pro.textSec }}>
          {Icon && <Icon size={14} />}
          {kicker}
        </span>
        {action && (
          <Link
            to={action.to}
            className="text-[11.5px] font-medium transition-colors hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 rounded"
            style={{ color: pro.textSec }}
          >
            {action.label}
          </Link>
        )}
      </div>
      <p className="text-[18px] leading-snug mt-4 flex-1" style={{ color: pro.text }}>{children}</p>
    </div>
  );
}
