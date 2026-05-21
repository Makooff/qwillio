// === FILE: Prospects.tsx ===
import { useEffect, useState } from 'react';
import { RefreshCw, Search, ChevronUp, ChevronDown, Phone, MapPin } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://qwillio.onrender.com';
const getH = (): Record<string, string> => {
  const tok = localStorage.getItem('token');
  return tok ? { Authorization: `Bearer ${tok}` } : {};
};

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

interface P {
  id: string; businessName: string; industry: string; phone: string;
  score: number; status: string; city: string; createdAt: string; callCount: number;
}

type StatusTab = 'Tous' | 'Nouveau' | 'Appelé' | 'Intéressé' | 'Non intéressé';

const STATUS_TABS: StatusTab[] = ['Tous', 'Nouveau', 'Appelé', 'Intéressé', 'Non intéressé'];

const STATUS_MAP: Record<string, StatusTab> = {
  new: 'Nouveau', called: 'Appelé', interested: 'Intéressé',
  not_interested: 'Non intéressé', not_interested_: 'Non intéressé',
};

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  new:            { bg: 'rgba(99,102,241,0.14)',  fg: '#818CF8' },
  nouveau:        { bg: 'rgba(99,102,241,0.14)',  fg: '#818CF8' },
  called:         { bg: 'rgba(168,85,247,0.14)',  fg: '#C084FC' },
  appelé:         { bg: 'rgba(168,85,247,0.14)',  fg: '#C084FC' },
  interested:     { bg: 'rgba(34,197,94,0.12)',   fg: '#4ADE80' },
  intéressé:      { bg: 'rgba(34,197,94,0.12)',   fg: '#4ADE80' },
  not_interested: { bg: 'rgba(239,68,68,0.10)',   fg: '#F87171' },
};

const getStatusStyle = (s: string) =>
  STATUS_STYLE[s?.toLowerCase()] ?? { bg: 'rgba(255,255,255,0.06)', fg: '#9CA3AF' };

const statusLabel = (s: string) => {
  const labels: Record<string, string> = {
    new: 'Nouveau', called: 'Appelé', interested: 'Intéressé',
    not_interested: 'Non intéressé',
  };
  return labels[s?.toLowerCase()] ?? s ?? '—';
};

const scoreColor = (n: number) => {
  if (n >= 8) return { bar: '#22C55E', text: '#4ADE80' };
  if (n >= 5) return { bar: '#EAB308', text: '#FDE047' };
  return { bar: '#4B5563', text: '#9CA3AF' };
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, (score / 10) * 100));
  const colors = scoreColor(score);
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: colors.bar }}
          aria-hidden="true"
        />
      </div>
      <span className="text-[12px] tabular-nums font-medium" style={{ color: colors.text }}>
        {score}
      </span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-t border-white/[0.04]">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-white/[0.07] rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

function ProspectCard({ p }: { p: P }) {
  const ss = getStatusStyle(p.status);
  const colors = scoreColor(p.score);
  return (
    <li className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white truncate">{p.businessName}</p>
          <p className="text-[11.5px] text-white/40 mt-0.5">{p.industry || '—'}</p>
        </div>
        <span
          aria-label={`Statut: ${statusLabel(p.status)}`}
          className="text-[10.5px] font-medium px-2 py-0.5 rounded-full shrink-0"
          style={{ background: ss.bg, color: ss.fg }}
        >
          {statusLabel(p.status)}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <ScoreBar score={p.score} />
      </div>
      <div className="mt-2.5 flex items-center gap-3 text-[11.5px] text-white/35">
        {p.city && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" aria-hidden="true" />{p.city}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Phone className="w-3 h-3" aria-hidden="true" />{p.callCount ?? 0} appel{p.callCount !== 1 ? 's' : ''}
        </span>
        <span className="ml-auto">{fmtDate(p.createdAt)}</span>
      </div>
    </li>
  );
}

const COLS = [
  { key: 'businessName', label: 'Entreprise' },
  { key: 'industry',     label: 'Industrie' },
  { key: 'score',        label: 'Score' },
  { key: 'status',       label: 'Statut' },
  { key: 'callCount',    label: 'Appels' },
  { key: 'city',         label: 'Ville' },
  { key: 'createdAt',    label: 'Ajouté' },
];

export default function Prospects() {
  const [items, setItems] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [activeTab, setActiveTab] = useState<StatusTab>('Tous');

  const load = () => {
    setRefreshing(true);
    const tryFetch = (url: string): Promise<P[]> =>
      fetch(url, { headers: getH() }).then(r => {
        if (!r.ok) throw new Error('not ok');
        return r.json().then(d => Array.isArray(d) ? d : d.prospects ?? []);
      });
    tryFetch(`${API}/api/admin/prospects`)
      .catch(() => tryFetch(`${API}/api/user/prospects`))
      .then(d => setItems(d))
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { load(); }, []);

  const tabFiltered = activeTab === 'Tous'
    ? items
    : items.filter(p => STATUS_MAP[p.status?.toLowerCase()] === activeTab);

  const filtered = tabFiltered.filter(p =>
    !q ||
    p.businessName?.toLowerCase().includes(q.toLowerCase()) ||
    p.city?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <main className="space-y-6 max-w-[1100px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-white">Prospects</h1>
          <p className="text-[13px] text-white/40 mt-0.5">
            {filtered.length} / {items.length} prospect{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <label htmlFor="prospect-search" className="sr-only">Rechercher un prospect</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" aria-hidden="true" />
            <input
              id="prospect-search"
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Rechercher…"
              className="pl-8 pr-3 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[12.5px] text-white
                         placeholder-white/25 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 w-44"
            />
          </div>
          <button
            onClick={load}
            aria-label="Rafraîchir les prospects"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04]
                       text-[12px] text-white/60 hover:text-white hover:bg-white/[0.07] transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <nav aria-label="Filtrer par statut">
        <ul className="flex gap-1 flex-wrap" role="tablist">
          {STATUS_TABS.map(tab => {
            const active = tab === activeTab;
            const cnt = tab === 'Tous' ? items.length : items.filter(p => STATUS_MAP[p.status?.toLowerCase()] === tab).length;
            return (
              <li key={tab} role="presentation">
                <button
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab)}
                  className={[
                    'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50',
                    active
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'border border-transparent text-white/40 hover:text-white/70',
                  ].join(' ')}
                >
                  {tab}
                  <span className={`ml-1.5 text-[10px] ${active ? 'text-indigo-400' : 'text-white/25'}`}>
                    {cnt}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop table */}
      <section aria-label="Table des prospects" className="hidden sm:block">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {COLS.map(col => (
                  <th
                    key={col.key}
                    scope="col"
                    className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/35 select-none"
                  >
                    <span className="inline-flex items-center gap-1 group cursor-default">
                      {col.label}
                      <span className="flex flex-col gap-px opacity-30 group-hover:opacity-60 transition-opacity" aria-hidden="true">
                        <ChevronUp className="w-2.5 h-2.5 -mb-0.5" />
                        <ChevronDown className="w-2.5 h-2.5 -mt-0.5" />
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-[13px] text-white/25">
                        Aucun prospect trouvé
                      </td>
                    </tr>
                  )
                  : filtered.map(p => {
                    const ss = getStatusStyle(p.status);
                    return (
                      <tr
                        key={p.id}
                        className="border-t border-white/[0.04] hover:bg-white/[0.025] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="text-[13px] font-medium text-white">{p.businessName || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-[12.5px] text-white/45">{p.industry || '—'}</td>
                        <td className="px-4 py-3">
                          <ScoreBar score={p.score ?? 0} />
                        </td>
                        <td className="px-4 py-3">
                          <span
                            aria-label={`Statut: ${statusLabel(p.status)}`}
                            className="inline-block text-[10.5px] font-medium px-2 py-0.5 rounded-full"
                            style={{ background: ss.bg, color: ss.fg }}
                          >
                            {statusLabel(p.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12.5px] text-white/45 tabular-nums">
                          {p.callCount ?? 0}
                        </td>
                        <td className="px-4 py-3 text-[12.5px] text-white/45">{p.city || '—'}</td>
                        <td className="px-4 py-3 text-[12px] text-white/30">{fmtDate(p.createdAt)}</td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
      </section>

      {/* Mobile cards */}
      <section aria-label="Liste des prospects" className="sm:hidden">
        {loading ? (
          <ul className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 h-28 animate-pulse" />
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] py-14 text-center">
            <p className="text-[13px] text-white/25">Aucun prospect trouvé</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map(p => <ProspectCard key={p.id} p={p} />)}
          </ul>
        )}
      </section>
    </main>
  );
}
