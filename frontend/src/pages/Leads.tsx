import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { RefreshCw, Users } from 'lucide-react';
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

const STAGES = ['contacted', 'qualified', 'proposal'];
const LABELS: Record<string, string> = { contacted: 'Contact\u00e9', qualified: 'Qualifi\u00e9', proposal: 'Proposition' };
const STAGE_COLORS: Record<string, string> = { contacted: '#3B82F6', qualified: '#8B5CF6', proposal: '#10B981' };

export default function Leads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toasts, add: toast, remove } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/leads/');
      setLeads(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch { toast('Erreur chargement', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className={cx.pageWrap}>
      <ToastContainer toasts={toasts} remove={remove}/>
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cx.h1} style={{ color: t.text }}>Pipeline Leads</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>{leads.length} au total</p>
        </div>
        <button onClick={load} className={cx.btnIcon} style={{ color: t.textSec }}><RefreshCw className="w-4 h-4"/></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STAGES.map(stage => {
          const stageLeads = leads.filter(l => l.status === stage);
          const color = STAGE_COLORS[stage];
          return (
            <div key={stage} className="rounded-[14px] p-4" style={glass}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}/>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: t.textTer }}>{LABELS[stage]}</p>
                </div>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.08)', color: t.textSec }}>{stageLeads.length}</span>
              </div>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-[10px] p-3 mb-2 space-y-1.5 animate-pulse" style={{ background: t.elevated }}>
                    <div className="h-3 bg-white/[0.08] rounded w-3/4"/>
                    <div className="h-2.5 bg-white/[0.06] rounded w-1/2"/>
                  </div>
                ))
              ) : stageLeads.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: t.textMuted }}>Aucun lead</p>
              ) : stageLeads.map((l, i) => (
                <div key={i} className="rounded-[10px] p-3 mb-2 transition-colors hover:bg-white/[0.04]"
                  style={{ background: t.elevated, border: `1px solid ${t.border}` }}>
                  <p className="text-sm font-medium" style={{ color: t.text }}>{l.companyName || l.name || 'Prospect'}</p>
                  {(l.phone || l.email) && (
                    <p className="text-xs mt-0.5" style={{ color: t.textSec }}>{l.phone || l.email}</p>
                  )}
                  {(l.createdAt || l.updatedAt) && (
                    <p className="text-[10px] mt-1" style={{ color: t.textTer }}>
                      {formatDate(l.createdAt || l.updatedAt)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
