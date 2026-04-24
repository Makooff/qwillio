import { useEffect, useState } from 'react';
import { Clock, Search, RefreshCw } from 'lucide-react';
import OrbsLoader from '../components/OrbsLoader';
import { pro } from '../styles/pro-theme';
import { PageHeader, Card, IconBtn, Stat } from '../components/pro/ProBlocks';

const API = 'https://qwillio.onrender.com';
const getH = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const fmtDateTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const t = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `${date} · ${t}`;
};

const toNum = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

interface Cl {
  id: string; businessName: string; contactName: string; email: string;
  plan: string; monthlyFee: number | string; city: string; createdAt: string;
}

export default function Clients() {
  const [items, setItems] = useState<Cl[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setRefreshing(true);
    fetch(`${API}/api/admin/clients`, { headers: getH() })
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : d.clients || []))
      .catch(console.error)
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter(c =>
    !q ||
    c.businessName?.toLowerCase().includes(q.toLowerCase()) ||
    c.contactName?.toLowerCase().includes(q.toLowerCase())
  );
  const mrr = filtered.reduce((s, c) => s + toNum(c.monthlyFee), 0);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <OrbsLoader size={40} fullscreen={false} />
    </div>
  );

  return (
    <div className="space-y-5 max-w-[1200px]">
      <PageHeader
        title="Clients"
        subtitle={`${filtered.length} client${filtered.length > 1 ? 's' : ''} actif${filtered.length > 1 ? 's' : ''}`}
        right={
          <IconBtn onClick={load} title="Rafraîchir">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </IconBtn>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="MRR total"      value={`${mrr.toFixed(0)}€`} hint="Récurrent mensuel" />
        <Stat label="Clients actifs" value={items.length} />
        <Stat label="Plan moyen"     value={items.length ? `${Math.round(mrr / items.length)}€` : '—'}
              hint="Ticket moyen / client" />
      </div>

      {/* Search */}
      <Card>
        <div className="flex items-center gap-2.5 px-4 h-11">
          <Search className="w-4 h-4" style={{ color: pro.textTer }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Rechercher par business ou contact…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder-[#6B6B75]"
            style={{ color: pro.text }}
          />
          {q && <button onClick={() => setQ('')} className="text-[11px]" style={{ color: pro.textSec }}>Effacer</button>}
        </div>
      </Card>

      {/* List */}
      <Card>
        {filtered.length === 0 ? (
          <div className="p-12 text-center" style={{ color: pro.textTer }}>
            <p className="text-[13px]">Aucun client</p>
          </div>
        ) : (
          filtered.map((c, i) => (
            <div
              key={c.id}
              className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.02]"
              style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-semibold"
                   style={{ background: 'rgba(255,255,255,0.05)', color: pro.text }}>
                {c.businessName?.charAt(0) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>{c.businessName}</p>
                <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                  {c.contactName || c.email || c.city || '—'}
                </p>
                <div className="flex items-center gap-1.5 mt-1" style={{ color: pro.textTer }}>
                  <Clock size={11} />
                  <span className="text-[11px]">{fmtDateTime(c.createdAt)}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[13px] font-semibold tabular-nums" style={{ color: pro.text }}>
                  {toNum(c.monthlyFee).toFixed(0)}€
                </p>
                <p className="text-[11px] mt-1" style={{ color: pro.textTer }}>{c.plan || '—'}</p>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
