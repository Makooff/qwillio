import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { Phone, RefreshCw } from 'lucide-react';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ui/Toast';
import { t, glass, cx } from '../styles/admin-theme';

function formatDate(iso: string | null | undefined) {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)}min`;
  if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)}h`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const STATUS_FILTERS = ['all', 'answered', 'missed', 'failed', 'voicemail'];

export default function Calls() {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { toasts, add: toast, remove } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/calls/');
      setCalls(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch { toast('Erreur chargement', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? calls : calls.filter(c => c.status === filter);
  const answered = calls.filter(c => c.status === 'answered').length;
  const rate = calls.length > 0 ? Math.round((answered / calls.length) * 100) : 0;

  return (
    <div className={cx.pageWrap}>
      <ToastContainer toasts={toasts} remove={remove}/>
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cx.h1} style={{ color: t.text }}>Appels</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>{calls.length} au total</p>
        </div>
        <button onClick={load} className={cx.btnIcon} style={{ color: t.textSec }}><RefreshCw className="w-4 h-4"/></button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {([
          { l: 'Total', v: calls.length, color: t.text },
          { l: 'R\u00e9pondus', v: answered, color: t.success },
          { l: 'Taux', v: `${rate}%`, color: t.textSec },
        ] as const).map(({ l, v, color }) => (
          <div key={l} className="rounded-[14px] p-4" style={glass}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: t.textTer }}>{l}</p>
            <p className="text-xl font-bold tabular-nums" style={{ color }}>{v}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all min-h-[44px]"
            style={filter === s
              ? { background: 'rgba(255,255,255,0.12)', color: t.text, border: '1px solid rgba(255,255,255,0.15)' }
              : { background: t.inset, color: t.textSec, border: `1px solid ${t.border}` }}>
            {s === 'all' ? 'Tous' : s}
          </button>
        ))}
      </div>

      <div className="rounded-[14px] overflow-hidden" style={glass}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4" style={{ borderBottom: `1px solid ${t.border}` }}>
              <div className="w-8 h-8 rounded-[8px] bg-white/[0.06] animate-pulse flex-shrink-0"/>
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-white/[0.06] rounded animate-pulse w-32"/>
                <div className="h-2.5 bg-white/[0.06] rounded animate-pulse w-20"/>
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Phone className="w-7 h-7"/>} title="Aucun appel" description="Les appels appara\u00eetront ici une fois le bot actif."/>
        ) : filtered.map((c, i) => (
          <div key={i} className="flex items-center gap-3 p-4 transition-colors hover:bg-white/[0.02]"
            style={{ borderBottom: `1px solid ${t.border}` }}>
            <div className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)' }}>
              <Phone className="w-3.5 h-3.5" style={{ color: t.textTer }}/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: t.text }}>
                {c.phone || c.prospectName || c.businessName || 'Inconnu'}
              </p>
              <p className="text-xs" style={{ color: t.textTer }}>
                {formatDate(c.createdAt || c.timestamp || c.date)}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {c.duration != null && (
                <span className="text-xs hidden sm:inline tabular-nums" style={{ color: t.textTer }}>
                  {Math.floor(c.duration / 60)}:{String(c.duration % 60).padStart(2, '0')}
                </span>
              )}
              <Badge label={c.status} dot size="xs"/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
