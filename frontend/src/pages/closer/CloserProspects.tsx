import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Phone, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import OrbsLoader from '../../components/OrbsLoader';
import { pro } from '../../styles/pro-theme';
import { PageHeader, Card, Pill } from '../../components/pro/ProBlocks';

interface Prospect {
  id: string; businessName: string; contactName?: string; phone?: string;
  city?: string; status: string; score?: number;
  assignedToUserId?: string | null; lastContactDate?: string | null;
}

const statusColor = (s: string) => {
  switch (s) {
    case 'interested':
    case 'qualified':
    case 'converted': return 'ok';
    case 'contacted': return 'info';
    case 'lost':      return 'bad';
    default:          return 'neutral';
  }
};

export default function CloserProspects() {
  const [items, setItems] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const load = async (search?: string) => {
    setLoading(true);
    try {
      const res = await api.get('/closer/prospects', {
        params: { scope: 'all', limit: 200, search: search || undefined },
      });
      setItems(res.data.items || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    try { setMyUserId(JSON.parse(localStorage.getItem('user') || 'null')?.id || null); } catch {/*empty*/}
    load();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [q]);

  const { mine, pool } = useMemo(() => {
    const mineArr: Prospect[] = [];
    const poolArr: Prospect[] = [];
    for (const p of items) {
      if (p.assignedToUserId && myUserId && p.assignedToUserId === myUserId) mineArr.push(p);
      else if (!p.assignedToUserId) poolArr.push(p);
    }
    return { mine: mineArr, pool: poolArr };
  }, [items, myUserId]);

  if (loading && items.length === 0) return (
    <div className="flex items-center justify-center py-32">
      <OrbsLoader size={40} fullscreen={false} />
    </div>
  );

  const Row = ({ p }: { p: Prospect }) => (
    <Link
      to={`/closer?id=${p.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]"
      style={{ borderTop: `1px solid ${pro.border}` }}
    >
      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-semibold"
           style={{ background: pro.panelHi, color: pro.text }}>
        {p.businessName?.charAt(0) || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium break-words leading-snug" style={{ color: pro.text }}>{p.businessName}</p>
        <p className="text-[11.5px] mt-0.5 break-words" style={{ color: pro.textTer }}>
          <Phone size={10} className="inline -mt-0.5 mr-1" />
          <span className="tabular-nums">{p.phone || '—'}</span>
          {p.city ? ` · ${p.city}` : ''}
        </p>
      </div>
      <Pill color={statusColor(p.status) as any}>{p.status}</Pill>
      <ChevronRight size={14} style={{ color: pro.textTer }} />
    </Link>
  );

  return (
    <div className="space-y-5 max-w-[900px]">
      <PageHeader
        title="Tous les prospects"
        subtitle={`${mine.length} à moi · ${pool.length} disponibles`}
      />

      <Card>
        <div className="flex items-center gap-2.5 px-4 h-11">
          <Search className="w-4 h-4" style={{ color: pro.textTer }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Rechercher par nom, contact, téléphone, ville…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder-[#6B6B75]"
            style={{ color: pro.text }}
          />
          {q && <button onClick={() => setQ('')} className="text-[11px]" style={{ color: pro.textSec }}>Effacer</button>}
        </div>
      </Card>

      {mine.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: pro.textSec }}>
            À moi ({mine.length})
          </p>
          <Card>
            <div style={{ borderTop: 'none' }}>
              {mine.map((p, i) => (
                <div key={p.id} style={i === 0 ? { marginTop: 0 } : undefined}>
                  <Row p={p} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <div>
        {mine.length > 0 && (
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: pro.textSec }}>
            Pool disponible ({pool.length})
          </p>
        )}
        <Card>
          {pool.length === 0 ? (
            <div className="p-12 text-center" style={{ color: pro.textTer }}>
              <p className="text-[13px]">{mine.length > 0 ? 'Pool vide' : 'Aucun prospect'}</p>
            </div>
          ) : (
            pool.map(p => <Row key={p.id} p={p} />)
          )}
        </Card>
      </div>
    </div>
  );
}
