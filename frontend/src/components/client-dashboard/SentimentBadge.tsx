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

  /* La pastille affichait la valeur BRUTE de la base, en anglais et en
     minuscules: « positive », « neutral », au milieu d'une page française.
     Le sentiment est une donnée technique, son libellé est de l'interface. */
  const labels: Record<string, string> = {
    positive: 'Positif',
    negative: 'Négatif',
    neutral: 'Neutre',
  };

  /* UN APPEL EN COURS N'A PAS ENCORE DE SENTIMENT.
     La ligne existe en base dès le décroché, avec `status = 'in-progress'` et
     `sentiment = null`. Sans cette branche, la colonne Sentiment affichait
     « Neutre » — un jugement rendu sur une conversation qui n'a pas eu lieu,
     et le gérant croyait l'appel terminé. « En cours » dit ce qu'il en est,
     et la pastille respire pour qu'on voie que ça bouge tout seul. */
  if (s === 'in-progress' || s === 'in_progress') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-medium border border-[#7349FE]/30 bg-[#7349FE]/10 text-[#A78BFA] ${sizeClass}`}
      >
        <span className="relative flex h-1.5 w-1.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7349FE] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#7349FE]" />
        </span>
        En cours
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center rounded-full font-medium border ${cls} ${sizeClass}`}>
      {labels[s] || labels.neutral}
    </span>
  );
}
