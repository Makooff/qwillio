interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusStyles: Record<string, string> = {
  new: 'bg-blue-50 text-blue-600 border-blue-200',
  contacted: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  qualified: 'bg-purple-50 text-purple-600 border-purple-200',
  converted: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  lost: 'bg-red-50 text-red-600 border-red-200',
  confirmed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
  pending: 'bg-amber-50 text-amber-600 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  missed: 'bg-red-50 text-red-600 border-red-200',
  active: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  paused: 'bg-amber-50 text-amber-600 border-amber-200',
  trialing: 'bg-blue-50 text-blue-600 border-blue-200',
  'in-progress': 'bg-blue-50 text-blue-600 border-blue-200',
  'no-answer': 'bg-gray-50 text-gray-600 border-gray-200',
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const cls = statusStyles[status?.toLowerCase()] || 'bg-gray-50 text-gray-600 border-gray-200';
  const sizeClass = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-medium border capitalize ${cls} ${sizeClass}`}>
      {status}
    </span>
  );
}
