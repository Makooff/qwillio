interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusStyles: Record<string, string> = {
  new: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  contacted: 'bg-indigo-400/10 text-indigo-400 border-indigo-400/20',
  qualified: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
  converted: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  lost: 'bg-red-400/10 text-red-400 border-red-400/20',
  confirmed: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  cancelled: 'bg-red-400/10 text-red-400 border-red-400/20',
  pending: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  completed: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  missed: 'bg-red-400/10 text-red-400 border-red-400/20',
  active: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  paused: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  trialing: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  'in-progress': 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  'no-answer': 'bg-white/[0.06] text-[#8B8BA7] border-white/[0.08]',
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const cls = statusStyles[status?.toLowerCase()] || 'bg-white/[0.06] text-[#8B8BA7] border-white/[0.08]';
  const sizeClass = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-medium border capitalize ${cls} ${sizeClass}`}>
      {status}
    </span>
  );
}
