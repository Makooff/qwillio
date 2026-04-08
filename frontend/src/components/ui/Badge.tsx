type Variant = 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral' | 'orange';

const VARIANTS: Record<Variant, string> = {
  success: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20',
  warning: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20',
  danger: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  purple: 'bg-[#7B5CF0]/10 text-[#7B5CF0] border-[#7B5CF0]/20',
  neutral: 'bg-white/[0.06] text-[#8B8BA7] border-white/[0.08]',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
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
    success: 'bg-[#22C55E]', warning: 'bg-[#F59E0B]', danger: 'bg-[#EF4444]',
    info: 'bg-blue-400', purple: 'bg-[#7B5CF0]', neutral: 'bg-[#8B8BA7]', orange: 'bg-orange-400',
  }[v];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${cls} ${px}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor} ${pulse ? 'animate-pulse' : ''}`} />}
      {label}
    </span>
  );
}
