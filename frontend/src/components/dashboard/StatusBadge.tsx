interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  // Client statuses
  active:      { label: 'Active',      bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', dot: 'bg-[#22C55E]' },
  trial:       { label: 'Trial',       bg: 'bg-[#7B5CF0]/10', text: 'text-[#7B5CF0]', dot: 'bg-[#7B5CF0]' },
  paused:      { label: 'Paused',      bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', dot: 'bg-[#F59E0B]' },
  cancelled:   { label: 'Cancelled',   bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', dot: 'bg-[#EF4444]' },
  // Call outcomes
  connected:   { label: 'Connected',   bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', dot: 'bg-[#22C55E]' },
  voicemail:   { label: 'Voicemail',   bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', dot: 'bg-[#F59E0B]' },
  no_answer:   { label: 'No answer',   bg: 'bg-white/[0.06]',  text: 'text-[#8B8BA7]', dot: 'bg-[#8B8BA7]' },
  'no-answer': { label: 'No answer',   bg: 'bg-white/[0.06]',  text: 'text-[#8B8BA7]', dot: 'bg-[#8B8BA7]' },
  rejected:    { label: 'Rejected',    bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', dot: 'bg-[#EF4444]' },
  // Prospect statuses
  pending:     { label: 'Pending',     bg: 'bg-white/[0.06]',  text: 'text-[#8B8BA7]', dot: 'bg-[#8B8BA7]' },
  called:      { label: 'Called',      bg: 'bg-[#6C47FF]/10', text: 'text-[#6C47FF]', dot: 'bg-[#6C47FF]' },
  interested:  { label: 'Interested',  bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', dot: 'bg-[#22C55E]' },
  exhausted:   { label: 'Exhausted',   bg: 'bg-white/[0.04]',  text: 'text-[#8B8BA7]/60', dot: 'bg-[#8B8BA7]/40' },
  client:      { label: 'Client',      bg: 'bg-[#6EE7B7]/10', text: 'text-[#6EE7B7]', dot: 'bg-[#6EE7B7]' },
  // Plans
  starter:     { label: 'Starter',     bg: 'bg-[#8B8BA7]/10', text: 'text-[#8B8BA7]', dot: 'bg-[#8B8BA7]' },
  pro:         { label: 'Pro',         bg: 'bg-[#7B5CF0]/10', text: 'text-[#7B5CF0]', dot: 'bg-[#7B5CF0]' },
  enterprise:  { label: 'Enterprise',  bg: 'bg-[#6EE7B7]/10', text: 'text-[#6EE7B7]', dot: 'bg-[#6EE7B7]' },
  // System
  online:      { label: 'Online',      bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', dot: 'bg-[#22C55E]' },
  degraded:    { label: 'Degraded',    bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', dot: 'bg-[#F59E0B]' },
  down:        { label: 'Down',        bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', dot: 'bg-[#EF4444]' },
  running:     { label: 'Running',     bg: 'bg-[#7B5CF0]/10', text: 'text-[#7B5CF0]', dot: 'bg-[#7B5CF0] animate-pulse' },
  success:     { label: 'Success',     bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', dot: 'bg-[#22C55E]' },
  failed:      { label: 'Failed',      bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', dot: 'bg-[#EF4444]' },
  scheduled:   { label: 'Scheduled',   bg: 'bg-white/[0.06]',  text: 'text-[#8B8BA7]', dot: 'bg-[#8B8BA7]' },
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const key = status?.toLowerCase().replace(/\s+/g, '_') ?? '';
  const cfg = STATUS_CONFIG[key] ?? {
    label: status ?? 'Unknown',
    bg: 'bg-white/[0.06]',
    text: 'text-[#8B8BA7]',
    dot: 'bg-[#8B8BA7]',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium
      ${cfg.bg} ${cfg.text}
      ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}`}>
      <span className={`rounded-full flex-shrink-0 ${cfg.dot} ${size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'}`} />
      {cfg.label}
    </span>
  );
}
