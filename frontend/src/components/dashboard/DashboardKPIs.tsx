import { Info } from 'lucide-react';
import { pro } from '../../styles/pro-theme';
import { SectionHead, Stat } from '../pro/ProBlocks';
import type { DashStats } from '../../hooks/useDashboardData';

interface Props {
  stats: DashStats | null;
}

export function DashboardKPIs({ stats }: Props) {
  const allZero = stats !== null
    && stats.prospects?.total === 0
    && stats.hotLeads === 0
    && stats.clients?.totalActive === 0
    && stats.revenue?.mrr === 0;

  return (
    <section>
      <SectionHead title="Aperçu" />
      {allZero && (
        <div
          className="mb-3 flex items-start gap-2 px-3 py-2 rounded-lg"
          style={{ background: `${pro.info}10`, border: `1px solid ${pro.info}28` }}
        >
          <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: pro.info }} />
          <p className="text-[11.5px]" style={{ color: pro.textSec }}>
            Aucune donnée encore. Lance la prospection ou attends le premier appel pour peupler ce tableau.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Prospects total"
          value={stats?.prospects?.total ?? 0}
          hint={stats ? `+${stats.prospects.newThisMonth} ce mois` : undefined}
        />
        <Stat
          label="Hot leads (≥ 8)"
          value={stats?.hotLeads ?? 0}
        />
        <Stat
          label="Clients actifs"
          value={stats?.clients?.totalActive ?? 0}
        />
        <Stat
          label="MRR"
          value={stats ? `${stats.revenue.mrr.toFixed(0)} €` : 0}
        />
      </div>
    </section>
  );
}
