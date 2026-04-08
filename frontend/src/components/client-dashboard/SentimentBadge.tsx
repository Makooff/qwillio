interface SentimentBadgeProps {
  sentiment: string | null | undefined;
  size?: 'sm' | 'md';
}

export default function SentimentBadge({ sentiment, size = 'sm' }: SentimentBadgeProps) {
  const s = sentiment?.toLowerCase() || 'neutral';
  const styles: Record<string, string> = {
    positive: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    negative: 'bg-red-400/10 text-red-400 border-red-400/20',
    neutral: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  };
  const cls = styles[s] || styles.neutral;
  const sizeClass = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-medium border ${cls} ${sizeClass}`}>
      {sentiment || 'Neutral'}
    </span>
  );
}
