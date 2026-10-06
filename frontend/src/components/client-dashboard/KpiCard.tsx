import { LucideIcon } from '../icons';
import { t } from '../../styles/admin-theme';
import { badgeStyle } from '../../styles/design-system';

const colorMap: Record<string, Parameters<typeof badgeStyle>[0]> = {
  blue: 'info',
  indigo: 'brand',
  purple: 'violet',
  amber: 'warning',
  cyan: 'info',
  emerald: 'success',
  red: 'danger',
  rose: 'danger',
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
  const tone = colorMap[color] ?? 'brand';
  return (
    <div
      className="p-5 transition-colors hover:bg-white/[0.02]"
      style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.r }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={badgeStyle(tone)}>
          <Icon size={18} />
        </div>
        {trend && (
          <span
            className="text-xs font-medium"
            style={{ color: trend.positive ? t.success : t.danger }}
          >
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold tracking-tight" style={{ color: t.text }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: t.textSec }}>{label}</p>
      {subtitle && <p className="text-[10px] mt-0.5" style={{ color: t.textTer }}>{subtitle}</p>}
    </div>
  );
}
