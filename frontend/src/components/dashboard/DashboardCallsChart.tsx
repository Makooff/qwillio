import { AreaChart, Area, ResponsiveContainer, Tooltip, CartesianGrid, XAxis, YAxis } from 'recharts';
import { pro, proShadow } from '../../styles/pro-theme';
import { Card, SectionHead } from '../pro/ProBlocks';
import type { CallDay } from '../../hooks/useDashboardData';

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-xl"
      style={{
        background: pro.panelHi,
        border: `1px solid ${pro.borderHi}`,
        boxShadow: proShadow.float,
      }}
    >
      <p className="text-[11px] mb-1" style={{ color: pro.textTer }}>{label}</p>
      <p className="text-[15px] font-bold tabular-nums" style={{ color: pro.text }}>
        {payload[0].value}
        <span className="text-[11px] font-normal ml-1" style={{ color: pro.textSec }}>appels</span>
      </p>
    </div>
  );
}

interface Props {
  data: CallDay[];
  className?: string;
}

export function DashboardCallsChart({ data, className }: Props) {
  const totalThisWeek = data.reduce((sum, d) => sum + d.calls, 0);

  return (
    <Card className={className}>
      <div className="p-4">
        <div className="flex items-baseline justify-between mb-3">
          <SectionHead title="Appels sur 7 jours" />
          {data.length > 0 && (
            <span className="text-[11px] tabular-nums" style={{ color: pro.textTer }}>
              <span className="font-semibold" style={{ color: pro.text }}>{totalThisWeek}</span> au total
            </span>
          )}
        </div>
        <div style={{ height: 190 }}>
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="callGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={pro.accent} stopOpacity={0.30} />
                    <stop offset="95%" stopColor={pro.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={pro.border} />
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
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: pro.accent, strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="calls"
                  stroke={pro.accent}
                  strokeWidth={2}
                  fill="url(#callGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: pro.accent, strokeWidth: 0 }}
                  animationDuration={700}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[12px]" style={{ color: pro.textTer }}>Aucun appel sur les 7 derniers jours</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
