import { ReactNode, useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface MetricCardProps {
  label: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  delta?: number;           // percent change vs last period
  sparkData?: number[];     // 7 data points for sparkline
  loading?: boolean;
  icon?: ReactNode;
  colorClass?: string;      // e.g. 'text-[#22C55E]'
  format?: 'number' | 'currency' | 'percent';
}

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const startRef = useRef(Date.now());
  const rafRef = useRef(0);

  useEffect(() => {
    if (typeof target !== 'number' || isNaN(target)) return;
    startRef.current = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

export default function MetricCard({
  label, value, prefix = '', suffix = '', delta, sparkData, loading, icon, colorClass, format = 'number',
}: MetricCardProps) {
  const numValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
  const animated = useCountUp(numValue);

  const formatValue = (v: number) => {
    if (format === 'currency') return `$${v.toLocaleString()}`;
    if (format === 'percent') return `${v.toFixed(1)}%`;
    return v.toLocaleString();
  };

  const displayValue = typeof value === 'string' && isNaN(parseFloat(value))
    ? value
    : `${prefix}${formatValue(animated)}${suffix}`;

  const sparkSeries = (sparkData ?? [0, 0, 0, 0, 0, 0, 0]).map((v, i) => ({ v, i }));
  const sparkColor = delta === undefined ? '#7B5CF0' : delta >= 0 ? '#22C55E' : '#EF4444';

  if (loading) {
    return (
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5 animate-pulse">
        <div className="h-3 bg-white/[0.08] rounded w-20 mb-4" />
        <div className="h-8 bg-white/[0.08] rounded w-24 mb-2" />
        <div className="h-2 bg-white/[0.06] rounded w-16" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5
      hover:border-[#7B5CF0]/30 hover:bg-[#14141E] transition-all duration-200 group relative overflow-hidden">

      {/* Subtle gradient on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300
        bg-gradient-to-br from-[#7B5CF0]/[0.04] to-transparent pointer-events-none" />

      <div className="relative">
        {/* Top row: label + delta */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {icon && <span className="text-[#8B8BA7]">{icon}</span>}
            <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#8B8BA7]">{label}</p>
          </div>
          {delta !== undefined && (
            <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full
              ${delta > 0
                ? 'bg-[#22C55E]/10 text-[#22C55E]'
                : delta < 0
                ? 'bg-[#EF4444]/10 text-[#EF4444]'
                : 'bg-white/[0.06] text-[#8B8BA7]'
              }`}>
              {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>

        {/* Value + sparkline */}
        <div className="flex items-end justify-between">
          <div>
            <p className={`text-3xl font-bold tracking-tight tabular-nums ${colorClass ?? 'text-[#F8F8FF]'}`}>
              {displayValue}
            </p>
          </div>

          {sparkData && sparkData.length > 0 && (
            <div className="w-20 h-10 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkSeries}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke={sparkColor}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
