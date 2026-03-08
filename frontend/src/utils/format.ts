/** Format seconds into "Xm Ys" */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

/** Format a date string or Date to locale string */
export function formatDate(date: string | Date | null | undefined, locale = 'fr-FR'): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Format a date to full datetime */
export function formatDateTime(date: string | Date | null | undefined, locale = 'fr-FR'): string {
  if (!date) return '-';
  return new Date(date).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format short date for charts */
export function formatShortDate(date: string | Date, locale = 'fr-FR'): string {
  return new Date(date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
}

/** Format time only */
export function formatTime(date: string | Date | null | undefined, locale = 'fr-FR'): string {
  if (!date) return '-';
  return new Date(date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/** Export data to CSV and trigger download */
export function exportToCSV(data: Record<string, any>[], filename: string, columns?: { key: string; label: string }[]) {
  if (data.length === 0) return;

  const cols = columns || Object.keys(data[0]).map(key => ({ key, label: key }));
  const header = cols.map(c => c.label).join(',');
  const rows = data.map(row =>
    cols.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
    }).join(',')
  );

  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Format a phone number for display */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '-';
  return phone;
}

/** Calculate days remaining */
export function daysUntil(date: string | Date | null | undefined): number {
  if (!date) return 0;
  const target = new Date(date);
  const now = new Date();
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}
