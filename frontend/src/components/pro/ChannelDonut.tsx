import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, Pill } from './ProBlocks';
import { pro } from '../../styles/pro-theme';

/**
 * Channel breakdown donut — original Qwillio component (recharts + ProBlocks).
 * Same idea as a typical dashboard "traffic by channel" chart, built in the
 * Qwillio dark register: flat, hairline, tabular legend, restrained palette.
 */

export interface ChannelSlice {
  /** Channel label, e.g. "Entrants". */
  label: string;
  /** Share value (0-100). */
  value: number;
  /** oklch colour. */
  color: string;
}

const DEFAULT_DATA: ChannelSlice[] = [
  { label: 'Appels entrants', value: 52, color: 'oklch(56% 0.22 264)' }, // indigo
  { label: 'Sortants',        value: 31, color: 'oklch(67% 0.26 299)' }, // violet
  { label: 'Web / démo',      value: 17, color: 'oklch(72% 0.18 195)' }, // teal
];

export function ChannelDonut({
  title = 'Répartition par canal',
  subtitle = 'Part des nouvelles conversations, 7 derniers jours',
  data = DEFAULT_DATA,
  deltaPp,
}: {
  title?: string;
  subtitle?: string;
  data?: ChannelSlice[];
  /** Optional trend in percentage points, e.g. +2.4. */
  deltaPp?: number;
}) {
  const sum = data.reduce((s, d) => s + d.value, 0);
  const hasData = sum > 0;
  const total = sum || 1;

  return (
    <Card>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-semibold" style={{ color: pro.text }}>{title}</h3>
              {hasData && typeof deltaPp === 'number' && (
                <Pill color={deltaPp >= 0 ? 'ok' : 'bad'}>
                  {deltaPp >= 0 ? '↑' : '↓'} {Math.abs(deltaPp)} pp
                </Pill>
              )}
            </div>
            <p className="text-[12px] mt-0.5" style={{ color: pro.textSec }}>{subtitle}</p>
          </div>
        </div>

        {!hasData ? (
          <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: 180 }}>
            <div
              className="w-12 h-12 rounded-full mb-3"
              style={{ border: `2px dashed ${pro.border}` }}
              aria-hidden="true"
            />
            <p className="text-[13px]" style={{ color: pro.textTer }}>Pas encore de données</p>
          </div>
        ) : (
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-5">
          {/* Donut */}
          <div className="relative w-[180px] h-[180px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={54}
                  outerRadius={84}
                  paddingAngle={2}
                  cornerRadius={6}
                  stroke="none"
                  isAnimationActive
                  animationBegin={120}
                  animationDuration={1100}
                  animationEasing="ease-out"
                >
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Centre total */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[22px] font-bold leading-none" style={{ color: pro.text, fontVariantNumeric: 'tabular-nums' }}>
                {total}%
              </span>
              <span className="text-[10px] uppercase tracking-[0.08em] mt-1" style={{ color: pro.textTer }}>Total</span>
            </div>
          </div>

          {/* Legend — tabular */}
          <ul className="flex-1 w-full space-y-2.5">
            {data.map((d) => (
              <li key={d.label} className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{ background: d.color }} aria-hidden="true" />
                <span className="text-[13px] flex-1 truncate" style={{ color: pro.textSec }}>{d.label}</span>
                <span className="text-[13px] font-semibold" style={{ color: pro.text, fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round((d.value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
        )}
      </div>
    </Card>
  );
}

export default ChannelDonut;
