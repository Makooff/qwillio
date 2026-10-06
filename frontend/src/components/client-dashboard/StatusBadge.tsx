import { badgeStyle, type Tone } from '../../styles/design-system';
import { t } from '../../styles/admin-theme';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusTones: Record<string, Tone> = {
  new: 'brand',
  contacted: 'violet',
  qualified: 'violet',
  converted: 'success',
  lost: 'danger',
  confirmed: 'success',
  cancelled: 'danger',
  pending: 'warning',
  completed: 'success',
  missed: 'danger',
  active: 'success',
  paused: 'warning',
  trialing: 'brand',
  'in-progress': 'brand',
  'no-answer': 'neutral',
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const tone = statusTones[status?.toLowerCase()] ?? 'neutral';
  return (
    <span
      className="capitalize"
      style={{
        ...badgeStyle(tone),
        ...(size === 'md' ? { padding: '4px 12px', fontSize: 13 } : null),
        // Keep the muted look for the fallback instead of a colored wash.
        ...(tone === 'neutral'
          ? { background: 'rgba(255,255,255,0.06)', color: t.textSec, border: '1px solid rgba(255,255,255,0.08)' }
          : null),
      }}
    >
      {status}
    </span>
  );
}
