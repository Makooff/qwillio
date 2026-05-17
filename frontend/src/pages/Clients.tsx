// === FILE: Clients.tsx ===
import { useEffect, useState } from 'react';
import { RefreshCw, Search, Plus, ArrowRight, TrendingUp } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://qwillio.onrender.com';
const getH = (): Record<string, string> => {
  const tok = localStorage.getItem('token');
  return tok ? { Authorization: `Bearer ${tok}` } : {};
};

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

const toNum = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

const initials = (name: string) =>
  (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

const planLabel = (plan: string) => {
  const labels: Record<string, string> = { starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise', growth: 'Growth' };
  return labels[plan?.toLowerCase()] ?? plan ?? 'Standard';
};

interface Cl {
  id: string; businessName: string; contactName: string; email: string;
  plan: string; monthlyFee: number | string; city: string; createdAt: string;
  status?: string; callCount?: number;
}

type ClientStatus = 'active' | 'inactive' | 'trial';

const getClientStatus = (c: Cl): ClientStatus => {
  if (c.status) return c.status as ClientStatus;
  return 'active';
};

const STATUS_META: Record<ClientStatus, { label: string; bg: string; fg: string }> = {
  active:   { label: 'Actif',    bg: 'rgba(34,197,94,0.12)',  fg: '#4ADE80' },
  inactive: { label: 'Inactif',  bg: 'rgba(239,68,68,0.10)',  fg: '#F87171' },
  trial:    { label: 'Essai',    bg: 'rgba(234,179,8,0.12)',  fg: '#FDE047' },
};

const AVATAR_COLORS = [
  ['rgba(99,102,241,0.25)',  '#818CF8'],
  ['rgba(168,85,247,0.20)',  '#C084FC'],
  ['rgba(59,130,246,0.20)',  '#60A5FA'],
  ['rgba(16,185,129,0.18)',  '#34D399'],
  ['rgba(245,158,11,0.18)',  '#FCD34D'],
];

const avatarColor = (id: string) => {
  const idx = id.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
};

function SkeletonCard() {
  return (
    <li className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-white/[0.08] flex-shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-3.5 bg-white/[0.08] rounded w-3/5" />
          <div className="h-3 bg-white/[0.05] rounded w-2/5" />
        </div>
      </div>
      <div className="h-3 bg-white/[0.05] rounded w-1/3 mb-3" />
      <div className="h-8 bg-white/[0.04] rounded-lg" />
    </li>
  );
}

interface ClientCardProps { client: Cl }

function ClientCard({ client }: ClientCardProps) {
  const status = getClientStatus(client);
  const sm = STATUS_META[status] ?? STATUS_META.active;
  const [bg, fg] = avatarColor(client.id);
  const fee = toNum(client.monthlyFee);

  return (
    <li className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 flex flex-col gap-4
                   hover:bg-white/[0.055] hover:border-white/[0.10] transition-all group">
      {/* Top: avatar + name + status */}
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-[15px] font-bold"
          style={{ background: bg, color: fg }}
          aria-hidden="true"
        >
          {initials(client.businessName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-white truncate leading-snug">
            {client.businessName || '—'}
          </p>
          {client.contactName && (
            <p className="text-[12px] text-white/40 truncate mt-0.5">{client.contactName}</p>
          )}
        </div>
        <span
          aria-label={`Statut: ${sm.label}`}
          className="text-[10.5px] font-medium px-2 py-0.5 rounded-full shrink-0"
          style={{ background: sm.bg, color: sm.fg }}
        >
          {sm.label}
        </span>
      </div>

      {/* Plan badge */}
      {client.plan && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
            {planLabel(client.plan)}
          </span>
          {client.city && (
            <span className="text-[11.5px] text-white/30">{client.city}</span>
          )}
        </div>
      )}

      {/* Key stat */}
      <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
          <span className="text-[11.5px] text-white/40">MRR</span>
        </div>
        <span className="text-[14px] font-semibold text-white tabular-nums">
          {fee > 0 ? `${fee.toFixed(0)} €` : '—'}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/25">{fmtDate(client.createdAt)}</span>
        <button
          aria-label={`Voir le client ${client.businessName}`}
          className="flex items-center gap-1 text-[12px] text-indigo-400 hover:text-indigo-300 transition-colors
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 rounded"
        >
          Voir
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

export default function Clients() {
  const [items, setItems] = useState<Cl[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');

  const load = () => {
    setRefreshing(true);
    fetch(`${API}/api/admin/clients`, { headers: getH() })
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : d.clients ?? []))
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter(c =>
    !q ||
    c.businessName?.toLowerCase().includes(q.toLowerCase()) ||
    c.contactName?.toLowerCase().includes(q.toLowerCase())
  );

  const mrr = items.reduce((s, c) => s + toNum(c.monthlyFee), 0);
  const active = items.filter(c => getClientStatus(c) === 'active').length;

  return (
    <main className="space-y-6 max-w-[1100px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-white">Clients</h1>
          <p className="text-[13px] text-white/40 mt-0.5">
            {filtered.length} client{filtered.length !== 1 ? 's' : ''}
            {q ? ` sur ${items.length}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label="Rafraîchir la liste des clients"
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04]
                       text-[12px] text-white/60 hover:text-white hover:bg-white/[0.07] transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            aria-label="Ajouter un nouveau client"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400
                       text-[12px] text-white font-medium transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Nouveau client
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <section aria-label="Statistiques des clients">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] text-white/35 uppercase tracking-wider">MRR Total</p>
            <p className="text-[22px] font-semibold text-white tabular-nums mt-0.5">{mrr.toFixed(0)} €</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] text-white/35 uppercase tracking-wider">Clients actifs</p>
            <p className="text-[22px] font-semibold text-white tabular-nums mt-0.5">{active}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 col-span-2 sm:col-span-1">
            <p className="text-[11px] text-white/35 uppercase tracking-wider">Ticket moyen</p>
            <p className="text-[22px] font-semibold text-white tabular-nums mt-0.5">
              {items.length ? `${Math.round(mrr / items.length)} €` : '—'}
            </p>
          </div>
        </div>
      </section>

      {/* Search */}
      <div className="relative max-w-sm">
        <label htmlFor="client-search" className="sr-only">Rechercher un client</label>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" aria-hidden="true" />
        <input
          id="client-search"
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Rechercher par entreprise ou contact…"
          className="w-full pl-9 pr-3 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[13px] text-white
                     placeholder-white/25 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
        />
      </div>

      {/* Grid */}
      <section aria-label="Annuaire des clients">
        {loading ? (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Chargement">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </ul>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] py-20 text-center">
            {q ? (
              <>
                <p className="text-[14px] text-white/30">Aucun résultat pour &ldquo;{q}&rdquo;</p>
                <button
                  onClick={() => setQ('')}
                  className="mt-3 text-[12px] text-indigo-400 hover:text-indigo-300 transition-colors
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 rounded"
                >
                  Effacer la recherche
                </button>
              </>
            ) : (
              <p className="text-[14px] text-white/30">Aucun client pour le moment</p>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(c => <ClientCard key={c.id} client={c} />)}
          </ul>
        )}
      </section>
    </main>
  );
}
