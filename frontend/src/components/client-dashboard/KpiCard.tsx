import { LucideIcon } from 'lucide-react';

const colorMap: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  purple: 'bg-purple-50 text-purple-600',
  amber: 'bg-amber-50 text-amber-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
  rose: 'bg-rose-50 text-rose-600',
};

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  subtitle?: string;
  trend?: { value: number; positive: boolean };
}

export default function KpiCard({ label, value, icon: Icon, color, subtitle, trend }: KpiCardProps) {
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c}`}>
          <Icon size={18} />
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-[#86868b] mt-1">{label}</p>
      {subtitle && <p className="text-[10px] text-[#86868b]/70 mt-0.5">{subtitle}</p>}
    </div>
  );
}
