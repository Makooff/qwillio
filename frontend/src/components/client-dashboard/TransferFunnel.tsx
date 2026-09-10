import { useEffect, useState } from 'react';
import { fetchLive } from '../../services/liveData';

/**
 * Ce que deviennent les transferts, et pourquoi ils échouent (REL-7).
 *
 * Les compteurs existaient déjà, mais à l'échelle de la flotte, sur une route
 * de santé: utile à qui exploite la plateforme, muet pour le gérant qui
 * demande « pourquoi l'agent ne m'a pas passé l'appel ». La cause est ce qui
 * décide de la suite — « occupé » se rappelle dans dix minutes, « numéro
 * inexistant » se corrige dans les réglages, et les deux ressemblaient
 * jusqu'ici à la même absence de nouvelle.
 */

interface Funnel {
  days: number;
  attempted: number;
  completed: number;
  failed: number;
  pending: number;
  causes: Array<{ label: string; count: number }>;
}

export default function TransferFunnel() {
  const [data, setData] = useState<Funnel | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchLive<Funnel>('/my-dashboard/transfers?days=30')
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  // Aucun transfert tenté: il n'y a rien à raconter, et un encart vide sur une
  // page qui a chargé ressemble à une panne.
  if (failed || !data || data.attempted === 0) return null;

  const reached = Math.round((data.completed / data.attempted) * 100);

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h2 className="text-[14px] font-semibold text-[#F2F2F2]">Transferts vers vous</h2>
        <span className="text-[11px] text-[#6B6B75]">{data.days} derniers jours</span>
      </div>
      <p className="text-[12px] text-[#9A9AA5] mb-4 leading-relaxed">
        {data.completed} appel{data.completed > 1 ? 's' : ''} vous {data.completed > 1 ? 'ont' : 'a'} été passé
        {data.completed > 1 ? 's' : ''} sur {data.attempted} tentative{data.attempted > 1 ? 's' : ''}, soit {reached}%.
      </p>

      <div className="flex gap-3 mb-1">
        {[
          { label: 'Aboutis', value: data.completed, color: '#34d399' },
          { label: 'Échoués', value: data.failed, color: '#f87171' },
          { label: 'Sans suite', value: data.pending, color: '#6B6B75' },
        ].map(cell => (
          <div key={cell.label} className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[18px] font-semibold tabular-nums" style={{ color: cell.color }}>{cell.value}</p>
            <p className="text-[11px] text-[#9A9AA5]">{cell.label}</p>
          </div>
        ))}
      </div>

      {/* Pas d'étape « ça a sonné »: la ligne de transfert ne l'enregistre pas,
          et l'inventer rendrait le reste de l'encart suspect. La cause la
          remplace, et elle en dit plus. */}
      {data.causes.length > 0 && (
        <ul className="mt-4 pt-4 border-t border-white/[0.06] space-y-1.5">
          {data.causes.map(c => (
            <li key={c.label} className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="text-[#C8C8D0]">{c.label}</span>
              <span className="tabular-nums text-[#9A9AA5]">{c.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
