interface SentimentBadgeProps {
  sentiment: string | null | undefined;
  size?: 'sm' | 'md';
}

export default function SentimentBadge({ sentiment, size = 'sm' }: SentimentBadgeProps) {
  const s = sentiment?.toLowerCase() || 'neutral';
  /* Le sentiment se dit par un POINT, le libellé reste dans le gris du texte.
     Trois pastilles pleines par ligne, dont le neutre en jaune vif, faisaient
     de la colonne Sentiment la plus voyante du tableau, alors qu'elle est la
     moins décisive. Vert et rouge sourds, gris pour le neutre. */
  const dots: Record<string, string> = {
    positive: 'bg-emerald-400/80',
    negative: 'bg-red-400/80',
    neutral: 'bg-white/30',
  };
  const dot = dots[s] || dots.neutral;
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
        className={`inline-flex items-center gap-1.5 rounded-full font-medium border border-white/[0.12] bg-white/[0.06] text-[#E8E8EC] ${sizeClass}`}
      >
        <span className="relative flex h-1.5 w-1.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
        </span>
        En cours
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium text-white/70 ${size === 'md' ? 'text-sm' : 'text-xs'}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      {labels[s] || labels.neutral}
    </span>
  );
}
