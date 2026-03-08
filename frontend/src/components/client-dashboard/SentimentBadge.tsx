interface SentimentBadgeProps {
  sentiment: string | null | undefined;
  size?: 'sm' | 'md';
}

export default function SentimentBadge({ sentiment, size = 'sm' }: SentimentBadgeProps) {
  const s = sentiment?.toLowerCase() || 'neutral';
  const styles: Record<string, string> = {
    positive: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    negative: 'bg-red-50 text-red-600 border-red-200',
    neutral: 'bg-amber-50 text-amber-600 border-amber-200',
  };
  const cls = styles[s] || styles.neutral;
  const sizeClass = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-medium border ${cls} ${sizeClass}`}>
      {sentiment || 'Neutral'}
    </span>
  );
}
