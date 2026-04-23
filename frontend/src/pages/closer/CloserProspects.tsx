import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Phone, Clock, Check } from 'lucide-react';
import api from '../../services/api';
import QwillioLoader from '../../components/QwillioLoader';
import { pro } from '../../styles/pro-theme';
import { PageHeader, Card, Pill } from '../../components/pro/ProBlocks';

interface Prospect {
  id: string; businessName: string; contactName?: string; phone?: string;
  city?: string; status: string; score?: number; priorityScore?: number;
  assignedToUserId?: string | null; lastContactDate?: string | null;
  createdAt: string;
}

type Scope = 'all' | 'mine' | 'pool';

const statusPillColor = (s: string) => {
  switch (s) {
    case 'interested': return 'ok';
    case 'qualified':  return 'ok';
    case 'converted':  return 'ok';
    case 'contacted':  return 'info';
    case 'lost':       return 'bad';
    default:           return 'neutral';
  }
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

export default function CloserProspects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const scope = (searchParams.get('scope') as Scope) || 'all';
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/closer/prospects', {
        params: { scope, limit: 200, search: q || undefined },
      });
      setItems(res.data.items || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    try { setMyUserId(JSON.parse(localStorage.getItem('user') || 'null')?.id || null); } catch {/*empty*/}
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [scope]);

  const debouncedSearch = useMemo(() => q, [q]);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [debouncedSearch]);

  const setScope = (s: Scope) => {
    const p = new URLSearchParams(searchParams);
    p.set('scope', s);
    setSearchParams(p, { replace: true });
  };

  const claim = async (id: string) => {
    setClaimingId(id);
    try {
      await api.post(`/closer/prospects/${id}/claim`);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Impossible de prendre ce prospect');
    } finally { setClaimingId(null); }
  };

  if (loading && items.length === 0) return (
    <div className="flex items-center justify-center py-32">
      <QwillioLoader size={120} fullscreen={false} />
    </div>
  );

  const scopeLabel = scope === 'mine' ? 'Mes prospects' : scope === 'pool' ? 'Pool disponible' : 'Tous';

  return (
    <div className="space-y-5 max-w-[1200px]">
      <PageHeader
        title="Prospects"
        subtitle={`${items.length} · ${scopeLabel}`}
      />

      {/* Scope tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
        {(['all', 'mine', 'pool'] as Scope[]).map(s => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className="px-3 h-8 text-[12px] font-medium rounded-lg transition-colors"
            style={{
              background: scope === s ? pro.panelHi : 'transparent',
              color: scope === s ? pro.text : pro.textSec,
            }}
          >
            {s === 'all' ? 'Tous' : s === 'mine' ? 'Mes prospects' : 'Pool'}
          </button>
        ))}
      </div>

      {/* Search */}
      <Card>
        <div className="flex items-center gap-2.5 px-4 h-11">
          <Search className="w-4 h-4" style={{ color: pro.textTer }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Rechercher par nom, contact, ville, téléphone…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder-[#6B6B75]"
            style={{ color: pro.text }}
          />
          {q && <button onClick={() => setQ('')} className="text-[11px]" style={{ color: pro.textSec }}>Effacer</button>}
        </div>
      </Card>

      <Card>
        {items.length === 0 ? (
          <div className="p-12 text-center" style={{ color: pro.textTer }}>
            <p className="text-[13px]">Aucun prospect</p>
          </div>
        ) : (
          items.map((p, i) => {
            const isMine = p.assignedToUserId && myUserId && p.assignedToUserId === myUserId;
            const isInPool = !p.assignedToUserId;
            return (
              <div
                key={p.id}
                className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.02]"
                style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
              >
                <Link
                  to={`/closer/prospects/${p.id}`}
                  className="flex items-center gap-3.5 flex-1 min-w-0"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-semibold"
                       style={{ background: pro.panelHi, color: pro.text }}>
                    {p.businessName?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>{p.businessName}</p>
                    <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                      {p.contactName || '—'} · {p.city || '—'}
                    </p>
                    <div className="flex items-center gap-2 mt-1" style={{ color: pro.textTer }}>
                      <Phone size={11} />
                      <span className="text-[11px] tabular-nums">{p.phone || '—'}</span>
                      {p.lastContactDate && (
                        <>
                          <span>·</span>
                          <Clock size={11} />
                          <span className="text-[11px]">{fmtDate(p.lastContactDate)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Pill color={statusPillColor(p.status) as any}>{p.status}</Pill>
                  {isMine ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ background: `${pro.accent}1F`, color: pro.accent }}>
                      <Check size={10} /> À moi
                    </span>
                  ) : isInPool ? (
                    <button
                      onClick={() => claim(p.id)}
                      disabled={claimingId === p.id}
                      className="px-3 h-8 text-[11.5px] font-medium rounded-lg disabled:opacity-50 transition-colors"
                      style={{ background: pro.text, color: '#0B0B0D' }}
                    >
                      {claimingId === p.id ? '…' : 'Prendre'}
                    </button>
                  ) : (
                    <span className="text-[10.5px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ background: pro.panelHi, color: pro.textTer }}>
                      Assigné
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
