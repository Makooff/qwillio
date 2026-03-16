import { formatDistanceToNow, format } from 'date-fns';

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return '***';
  return phone.slice(0, 3) + '***' + phone.slice(-2);
}

export function maskEmail(email: string): string {
  if (!email) return '***';
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  const masked = user.slice(0, 2) + '***';
  return `${masked}@${domain}`;
}

export function relativeTime(date: Date | null): string {
  if (!date) return 'never';
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatTimestamp(date: Date): string {
  return format(date, 'dd/MM/yyyy HH:mm:ss');
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function statusEmoji(status: string): string {
  const map: Record<string, string> = {
    active: '🟢',
    paused: '🟡',
    offline: '🔴',
    operational: '🟢',
    degraded: '🟡',
    down: '🔴',
    completed: '✅',
    failed: '❌',
    'in-progress': '🔵',
    missed: '🔴',
    answered: '🟢',
    transferred: '🔵',
    voicemail: '⚪',
  };
  return map[status?.toLowerCase()] || '⚫';
}

export function percentChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+∞%' : '0%';
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
