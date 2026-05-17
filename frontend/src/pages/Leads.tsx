// === FILE: Leads.tsx ===
import { useEffect, useState } from 'react';
import { RefreshCw, MapPin, Calendar, Building2 } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://qwillio.onrender.com';
const getH = (): Record<string, string> => {
  const tok = localStorage.getItem('token');
  return tok ? { Authorization: `Bearer ${tok}` } : {};
};

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const getWeekStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
};

interface Lead {
  id: string; businessName: string; contactName: string; email: string;
  phone: string; industry: string; city: string; status: string;
  createdAt: string; notes: string;
}

type StatusKey = 'new' | 'contacted' | 'interested' | 'qualified' | 'converted' | 'lost';

const STATUS_META: Record<StatusKey, { label: string; bg: string; fg: string; dot: string }> = {
  new:        { label: 'Nouveau',   bg: 'rgba(99,102,241,0.15)',  fg: '#818CF8', dot: '#6366F1' },
  contacted:  { label: 'Contacté',  bg: 'rgba(234,179,8,0.12)',   fg: '#FDE047', dot: '#EAB308' },
  interested: { label: 'Intéressé', bg: 'rgba(168,85,247,0.14)',  fg: '#C084FC', dot: '#A855F7' },
  qualified:  { label: 'Qualifié',  bg: 'rgba(34,197,94,0.12)',   fg: '#4ADE80', dot: '#22C55E' },
  converted:  { label: 'Converti',  bg: 'rgba(16,185,129,0.12)',  fg: '#34D399', dot: '#10B981' },
  lost:       { label: 'Perdu',     bg: 'rgba(239,68,68,0.10)',   fg: '#F87171', dot: '#EF4444' },
};

const getStatus = (s: string) =>
  STATUS_META[(s?.toLowerCase() as StatusKey)] ?? { label: s || '—', bg: 'rgba(255,255,255,0.06)', fg: '#9CA3AF', dot: '#6B7280' };

const initials = (name: string) =>
  (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

const FILTER_TABS = ['Tous', 'Nouveau', 'Intéressé', 'Qualifié', 'Converti'] as const;

function SkeletonCard() {
  return (
    <li className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-white/[0.08] flex-shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-3.5 bg-white/[0.08] rounded w-2/5" />
          <div className="h-3 bg-white/[0.05] rounded w-1/3" />
        </div>
        <div className="h-5 bg-white/[0.08] rounded-full w-20" />
      </div>
      <div className="mt-3 flex gap-3">
        <div className="h-3 bg-white/[0.05] rounded w-24" />
        <div className="h-3 bg-white/[0.05] rounded w-16" />
      </div>
    </li>
  );
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('Tous');

  const load = () => {
    setRefreshing(true);
    fetch(`${API}/api/admin/leads`, { headers: getH() })
      .then(r => r.json())
      .then(d => setLeads(Array.isArray(d) ? d : d.leads ?? []))
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { load(); }, []);

  const weekStart = getWeekStart();
  const newThisWeek = leads.filter(l => new Date(l.createdAt) >= weekStart).length;
  const qualified = leads.filter(l => ['qualified', 'converted'].includes(l.status?.toLowerCase())).length;
  const converted = leads.filter(l => l.status?.toLowerCase() === 'converted').length;

  const tabStatusMap: Record<string, string> = {
    'Nouveau': 'new', 'Intéressé': 'interested',
    'Qualifié': 'qualified', 'Converti': 'converted',
  };

  const filtered = activeTab === 'Tous'
    ? leads
    : leads.filter(l => l.status?.toLowerCase() === tabStatusMap[activeTab]);

  return (
    <main className="space-y-6 max-w-[860px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-white">Leads</h1>
          <p className="text-[13px] text-white/40 mt-0.5">
            {leads.length} lead{leads.length !== 1 ? 's' : ''} au total
          </p>
        </div>
        <button
          onClick={load}
          aria-label="Rafraîchir les leads"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04]
                     text-[12px] text-white/60 hover:text-white hover:bg-white/[0.07] transition-colors
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Stats bar */}
      <section aria-label="Statistiques des leads">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',          value: leads.length },
            { label: 'Cette semaine',  value: newThisWeek },
            { label: '% Qualifiés',    value: leads.length ? `${Math.round(qualified / leads.length * 100)}%` : '—' },
            { label: 'Convertis',      value: converted },
          ].map(stat => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3"
            >
              <p className="text-[11px] text-white/40 uppercase tracking-wider">{stat.label}</p>
              <p className="text-[20px] font-semibold text-white tabular-nums mt-0.5">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Filter pills */}
      <nav aria-label="Filtrer par statut">
        <ul className="flex gap-2 flex-wrap" role="tablist">
          {FILTER_TABS.map(tab => {
            const active = tab === activeTab;
            return (
              <li key={tab} role="presentation">
                <button
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab)}
                  className={[
                    'px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50',
                    active
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'border border-white/[0.07] text-white/50 hover:text-white/80 hover:bg-white/[0.04]',
                  ].join(' ')}
                >
                  {tab}
                  {tab !== 'Tous' && (() => {
                    const cnt = leads.filter(l => l.status?.toLowerCase() === tabStatusMap[tab]).length;
                    return cnt > 0 ? (
                      <span className="ml-1.5 text-[10px] opacity-70">{cnt}</span>
                    ) : null;
                  })()}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Lead cards */}
      <section aria-label="Liste des leads">
        {loading ? (
          <ul className="space-y-3" aria-label="Chargement">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
          </ul>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] py-16 text-center">
            <p className="text-[13px] text-white/30">Aucun lead dans cette catégorie</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map(lead => {
              const sm = getStatus(lead.status);
              const init = initials(lead.businessName);
              return (
                <li
                  key={lead.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4
                             hover:bg-white/[0.05] hover:border-white/[0.10] transition-all group"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                                 text-[13px] font-bold"
                      style={{ background: sm.bg, color: sm.fg }}
                      aria-hidden="true"
                    >
                      {init}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-semibold text-white truncate">
                          {lead.businessName || '—'}
                        </span>
                        {lead.industry && (
                          <span className="text-[10.5px] px-2 py-0.5 rounded-md bg-white/[0.06] text-white/50 shrink-0">
                            {lead.industry}
                          </span>
                        )}
                      </div>
                      {lead.contactName && (
                        <p className="text-[12.5px] text-white/50 mt-0.5">{lead.contactName}</p>
                      )}
                    </div>

                    {/* Status badge */}
                    <span
                      aria-label={`Statut: ${sm.label}`}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0"
                      style={{ background: sm.bg, color: sm.fg }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: sm.dot }}
                        aria-hidden="true"
                      />
                      {sm.label}
                    </span>
                  </div>

                  {/* Secondary info row */}
                  <div className="mt-3 flex items-center gap-4 flex-wrap">
                    {lead.city && (
                      <span className="flex items-center gap-1 text-[11.5px] text-white/35">
                        <MapPin className="w-3 h-3" aria-hidden="true" />
                        {lead.city}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[11.5px] text-white/35">
                      <Calendar className="w-3 h-3" aria-hidden="true" />
                      {fmtDate(lead.createdAt)}
                    </span>
                  </div>

                  {/* Notes preview */}
                  {lead.notes && (
                    <p className="mt-2.5 text-[12px] text-white/30 truncate border-t border-white/[0.04] pt-2.5">
                      {lead.notes}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
