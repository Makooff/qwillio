import { ReactNode, useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface Props {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  format?: 'number' | 'currency' | 'percent';
  delta?: number;
  icon: ReactNode;
  sparkData?: number[];
  color?: string;
}

function useCountUp(target: number, duration = 800) {
  const [current, setCurrent] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setCurrent(Math.floor(p * target));
      if (p < 1) raf.current = requestAnimationFrame(animate);
      else setCurrent(target);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return current;
}

function fmt(v: number, format?: string, prefix?: string, suffix?: string) {
  if (format === 'currency') return `${prefix ?? '$'}${v.toLocaleString()}`;
  if (format === 'percent') return `${v.toFixed(1)}${suffix ?? '%'}`;
  return `${prefix ?? ''}${v.toLocaleString()}${suffix ?? ''}`;
}

export default function StatCard({ label, value, prefix, suffix, format, delta, icon, sparkData, color }: Props) {
  const displayed = useCountUp(value);
  const positive = (delta ?? 0) >= 0;
  const sparkPoints = (sparkData ?? []).map((v, i) => ({ v, i }));

  return (
    <div className="group rounded-2xl bg-[#12121A] border border-white/[0.06] p-5 hover:border-white/[0.12] transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-[#8B8BA7] font-medium uppercase tracking-wide">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `${color ?? '#7B5CF0'}18`, color: color ?? '#7B5CF0' }}>
          {icon}
        </div>
      </div>

      <p className="text-2xl font-bold text-[#F8F8FF] tabular-nums mb-2" style={{ color: color }}>
        {fmt(displayed, format, prefix, suffix)}
      </p>

      <div className="flex items-center justify-between">
        {delta !== undefined ? (
          <span className={`flex items-center gap-1 text-xs font-medium ${positive ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {positive ? '+' : ''}{delta.toFixed(1)}%
          </span>
        ) : <span />}

        {sparkPoints.length > 1 && (
          <div className="h-8 w-20">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkPoints}>
                <Line type="monotone" dataKey="v" stroke={color ?? '#7B5CF0'} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
