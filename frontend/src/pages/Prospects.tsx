import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Search, RefreshCw } from 'lucide-react';
import OrbsLoader from '../components/OrbsLoader';
import { pro } from '../styles/pro-theme';
import { PageHeader, Card, IconBtn } from '../components/pro/ProBlocks';

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

// Single tone for status pills — accent for "active" states, neutral otherwise
const statusStyle = (s?: string) => {
  switch ((s || '').toLowerCase()) {
    case 'interested':     return { bg: 'rgba(34,197,94,0.10)',  fg: pro.ok };
    case 'converted':      return { bg: 'rgba(34,197,94,0.10)',  fg: pro.ok };
    case 'not_interested': return { bg: 'rgba(239,68,68,0.08)',  fg: pro.bad };
    case 'called':         return { bg: 'rgba(123,92,240,0.10)', fg: pro.accent };
    default:               return { bg: 'rgba(255,255,255,0.05)', fg: pro.textSec };
  }
};

interface P {
  id: string; businessName: string; industry: string; phone: string;
  score: number; status: string; city: string; createdAt: string; callCount: number;
}

export default function Prospects() {
  const [items, setItems] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setRefreshing(true);
    fetch(`${API}/api/admin/prospects`, { headers: getH() })
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : d.prospects || []))
      .catch(console.error)
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter(p =>
    !q ||
    p.businessName?.toLowerCase().includes(q.toLowerCase()) ||
    p.city?.toLowerCase().includes(q.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <OrbsLoader size={120} fullscreen={false} />
    </div>
  );

  return (
    <div className="space-y-5 max-w-[1200px]">
      <PageHeader
        title="Prospects"
        subtitle={`${filtered.length} sur ${items.length} résultat${items.length > 1 ? 's' : ''}`}
        right={
          <IconBtn onClick={load} title="Rafraîchir">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </IconBtn>
        }
      />

      {/* Search */}
      <Card>
        <div className="flex items-center gap-2.5 px-4 h-11">
          <Search className="w-4 h-4" style={{ color: pro.textTer }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Rechercher par nom ou ville…"
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
            <p className="text-[13px]">Aucun prospect trouvé</p>
          </div>
        ) : (
          filtered.map((p, i) => {
            const s = statusStyle(p.status);
            return (
              <div
                key={p.id}
                className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.02]"
                style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-semibold"
                     style={{ background: s.bg, color: s.fg }}>
                  {p.businessName?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>{p.businessName}</p>
                  <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                    {p.city || '—'} · {p.industry || '—'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1" style={{ color: pro.textTer }}>
                    <Clock size={11} />
                    <span className="text-[11px]">{fmtDateTime(p.createdAt)}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: s.bg, color: s.fg }}>
                    {p.status || '—'}
                  </span>
                  <p className="text-[11px] mt-1 tabular-nums" style={{ color: pro.textTer }}>{p.score}/22</p>
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
