import { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, CartesianGrid, XAxis, YAxis } from 'recharts';
import { pro, proShadow } from '../../styles/pro-theme';
import { Card, Pill } from '../pro/ProBlocks';
import type { CallDay } from '../../hooks/useDashboardData';

// Monochrome line/fill (black/white/grey direction, like the reference).
const LINE = 'oklch(90% 0 0)';

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-xl"
      style={{ background: pro.panelHi, border: `1px solid ${pro.borderHi}`, boxShadow: proShadow.float }}
    >
      <p className="text-[11px] mb-1" style={{ color: pro.textTer }}>{label}</p>
      <p className="text-[15px] font-bold tabular-nums" style={{ color: pro.text }}>
        {payload[0].value}
        <span className="text-[11px] font-normal ml-1" style={{ color: pro.textSec }}>appels</span>
      </p>
    </div>
  );
}

/** Sample 7-day series so the chart is visible before real calls land. */
function buildDemo(): CallDay[] {
  const today = new Date();
  const shape = [8, 11, 9, 14, 12, 18, 22];
  return shape.map((base, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return { date: d.toISOString().slice(0, 10), calls: base + Math.floor(Math.random() * 4) };
  });
}

interface Props {
  data: CallDay[];
  className?: string;
}

export function DashboardCallsChart({ data, className }: Props) {
  const demo = data.length === 0;
  const demoData = useMemo(buildDemo, []);
  const chartData = demo ? demoData : data;

  const total = chartData.reduce((sum, d) => sum + d.calls, 0);
  const mid = Math.floor(chartData.length / 2);
  const firstHalf = chartData.slice(0, mid).reduce((s, d) => s + d.calls, 0);
  const secondHalf = chartData.slice(mid).reduce((s, d) => s + d.calls, 0);
  const trendPct = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : 0;

  return (
    <Card className={className}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[28px] font-bold tabular-nums leading-none" style={{ color: pro.text }}>{total}</p>
              {demo
                ? <Pill color="neutral">Démo</Pill>
                : (chartData.length > 1 && firstHalf > 0 && (
                    <Pill color={trendPct >= 0 ? 'ok' : 'bad'}>{trendPct >= 0 ? '↑' : '↓'} {Math.abs(trendPct)}%</Pill>
                  ))}
            </div>
            <p className="text-[12px] mt-1" style={{ color: pro.textSec }}>
              Appels sur 7 jours{demo ? ' · données de démonstration' : ''}
            </p>
          </div>
        </div>
        <div style={{ height: 210 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="callGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={LINE} stopOpacity={0.28} />
                  <stop offset="60%" stopColor={LINE} stopOpacity={0.08} />
                  <stop offset="100%" stopColor={LINE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={pro.border} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: pro.textTer }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis
                tick={{ fontSize: 10, fill: pro.textTer }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={36}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: pro.borderHi, strokeWidth: 1 }} />
              <Area
                type="natural"
                dataKey="calls"
                stroke={LINE}
                strokeWidth={2}
                fill="url(#callGrad)"
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
    </Card>
  );
}
