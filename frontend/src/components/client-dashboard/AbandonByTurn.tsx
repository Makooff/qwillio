import { useEffect, useState } from 'react';
import { fetchLive } from '../../services/liveData';

/**
 * Où les appelants s'arrêtent, découpé par index de tour (TST-9).
 *
 * Un taux d'abandon global ne dit rien d'exploitable, parce qu'il additionne
 * trois pannes différentes. Au tour 1 l'appelant n'a entendu que l'accueil:
 * c'est la voix, la phrase, ou le fait de comprendre qu'il parle à une machine.
 * Aux tours 2 et 3 il a posé sa question et la réponse ne lui a pas suffi.
 * Plus tard il était engagé, et c'est la prise de rendez-vous qui l'a perdu.
 * Trois chantiers, trois endroits différents dans le produit.
 */

interface Bucket {
  label: string;
  count: number;
}

interface Abandonment {
  total: number;
  abandoned: number;
  rate: number;
  buckets: Bucket[];
  worst: Bucket | null;
  days: number;
  minCalls: number;
  threshold: number;
  action: string | null;
}

export default function AbandonByTurn() {
  const [data, setData] = useState<Abandonment | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchLive<Abandonment>('/my-dashboard/calls/abandonment?days=7')
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  // Un encart qui n'a rien à dire ne dit rien: pas de squelette qui tourne, pas
  // de message d'erreur sur une page qui, elle, a chargé.
  if (failed || !data || data.total === 0) return null;

  const max = Math.max(1, ...data.buckets.map(b => b.count));
  const percent = Math.round(data.rate * 100);
  /* Sous ce nombre d'appels, un pourcentage décrit le hasard. On montre quand
     même l'histogramme — c'est la forme qui intéresse — mais on ne conclut pas
     à la place du client. */
  const tooFew = data.total < data.minCalls;
  const high = !tooFew && data.rate > data.threshold;

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h2 className="text-[14px] font-semibold text-[#F2F2F2]">Où les appelants s'arrêtent</h2>
        <span className="text-[11px] text-[#6B6B75]">{data.days} derniers jours</span>
      </div>
      <p className="text-[12px] text-[#9A9AA5] mb-4 leading-relaxed">
        {tooFew
          ? `${data.abandoned} appel${data.abandoned > 1 ? 's' : ''} sur ${data.total} n'${data.abandoned > 1 ? 'ont' : 'a'} rien produit. Trop peu d'appels pour en tirer un taux.`
          : `${percent}% des appels finissent sans rien produire, sur ${data.total} appels.`}
      </p>

      <div className="space-y-2">
        {data.buckets.map(b => {
          const isWorst = !tooFew && data.worst?.label === b.label && b.count > 0;
          return (
            <div key={b.label} className="flex items-center gap-3">
              <span className="w-[72px] shrink-0 text-[11px] text-[#9A9AA5]">{b.label}</span>
              <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${(b.count / max) * 100}%`,
                    background: isWorst ? '#f87171' : 'rgba(115,73,254,0.55)',
                  }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-[#C8C8D0]">{b.count}</span>
            </div>
          );
        })}
      </div>

      {/* L'action, et seulement quand le taux la justifie: une consigne affichée
          en permanence devient un décor qu'on ne lit plus. */}
      {high && data.action && (
        <p className="text-[12px] text-[#C8C8D0] mt-4 pt-4 border-t border-white/[0.06] leading-relaxed">
          {data.action}
        </p>
      )}
    </section>
  );
}
