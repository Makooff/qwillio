import { t } from '../../styles/admin-theme';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral' | 'orange';

const VARIANTS: Record<Variant, string> = {
  success: `bg-[#34D399]/[0.08] text-[#34D399] border-[#34D399]/[0.15]`,
  warning: `bg-[#FBBF24]/[0.08] text-[#FBBF24] border-[#FBBF24]/[0.15]`,
  danger:  `bg-[#F87171]/[0.08] text-[#F87171] border-[#F87171]/[0.15]`,
  info:    `bg-[#60A5FA]/[0.08] text-[#60A5FA] border-[#60A5FA]/[0.15]`,
  purple:  `bg-white/[0.06] text-[#86868B] border-white/[0.08]`,
  neutral: `bg-white/[0.04] text-[#6E6E73] border-white/[0.06]`,
  orange:  `bg-orange-400/[0.08] text-orange-400 border-orange-400/[0.15]`,
};

const STATUS_MAP: Record<string, Variant> = {
  // Prospect statuses
  new: 'info',
  qualified: 'purple',
  interested: 'success',
  converted: 'success',
  not_interested: 'neutral',
  do_not_call: 'danger',
  voicemail: 'neutral',
  no_answer: 'neutral',
  callback: 'warning',
  // Client statuses
  active: 'success',
  trial: 'info',
  paused: 'warning',
  cancelled: 'danger',
  pending: 'neutral',
  // Quote statuses
  draft: 'neutral',
  sent: 'info',
  accepted: 'success',
  rejected: 'danger',
  expired: 'neutral',
  signed: 'success',
  // Campaign statuses
  scheduled: 'purple',
  running: 'warning',
  completed: 'success',
  failed: 'danger',
  // Call outcomes
  called: 'info',
  hot_lead: 'success',
  exhausted: 'neutral',
  // Plan types
  starter: 'neutral',
  pro: 'purple',
  enterprise: 'orange',
  // Bot / system
  online: 'success',
  degraded: 'warning',
  down: 'danger',
  // Other
  success: 'success',
  error: 'danger',
  warning: 'warning',
};

interface Props {
  label: string;
  variant?: Variant;
  dot?: boolean;
  pulse?: boolean;
  size?: 'xs' | 'sm';
}

export default function Badge({ label, variant, dot = false, pulse = false, size = 'sm' }: Props) {
  const v: Variant = variant ?? STATUS_MAP[label.toLowerCase()] ?? 'neutral';
  const cls = VARIANTS[v];
  const px = size === 'xs' ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-xs';
  const dotColor = {
    success: `bg-[${t.success}]`, warning: `bg-[${t.warning}]`, danger: `bg-[${t.danger}]`,
    info: `bg-[${t.info}]`, purple: `bg-[${t.textSec}]`, neutral: `bg-[${t.textTer}]`, orange: 'bg-orange-400',
  }[v];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${cls} ${px}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor} ${pulse ? 'animate-pulse' : ''}`} />}
      {label}
    </span>
  );
}
