import { pro } from '../../styles/pro-theme';
import type { DashStats } from '../../hooks/useDashboardData';

interface Props {
  stats: DashStats | null;
}

export function DashboardKPIs({ stats }: Props) {
  const items: { label: string; value: string | number; hint?: string }[] = [
    {
      label: 'Prospects total',
      value: stats?.prospects?.total ?? 0,
      hint: stats ? `+${stats.prospects.newThisMonth} ce mois` : undefined,
    },
    { label: 'Hot leads (≥ 8)', value: stats?.hotLeads ?? 0 },
    { label: 'Clients actifs', value: stats?.clients?.totalActive ?? 0 },
    { label: 'MRR', value: stats ? `${stats.revenue.mrr.toFixed(0)} €` : 0 },
  ];

  // Borderless KPI row — values separated by thin vertical lines (no cards).
  return (
    <section aria-label="Indicateurs clés">
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-white/[0.06]">
        {items.map((it) => (
          <div key={it.label} className="px-5 py-4 first:pl-0">
            <p
              className="text-[11px] font-medium uppercase tracking-[0.1em] mb-2.5"
              style={{ color: pro.textTer }}
            >
              {it.label}
            </p>
            <p
              className="text-[30px] font-semibold leading-none"
              style={{ color: pro.text, fontVariantNumeric: 'tabular-nums' }}
            >
              {it.value}
            </p>
            {it.hint && (
              <p className="text-[11.5px] mt-2" style={{ color: pro.textTer }}>{it.hint}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
