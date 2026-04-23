import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock, Trash2, Filter } from 'lucide-react';
import api from '../../services/api';
import QwillioLoader from '../../components/QwillioLoader';
import { pro } from '../../styles/pro-theme';
import { PageHeader, Card, Pill } from '../../components/pro/ProBlocks';

interface Item {
  id: string; type: string; step: number;
  scheduledAt: string; sentAt: string | null;
  opened: boolean; clicked: boolean; replied: boolean;
  prospect: {
    id: string; businessName: string; contactName?: string;
    phone?: string; status: string;
  };
}

const fmt = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};

export default function CloserFollowUps() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingOnly, setPendingOnly] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/closer/followups', { params: { pending: pendingOnly, limit: 200 } });
      setItems(res.data.items || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pendingOnly]);

  const cancel = async (id: string) => {
    if (!confirm('Annuler ce follow-up ?')) return;
    try { await api.delete(`/closer/followups/${id}`); await load(); }
    catch (e: any) { alert(e?.response?.data?.error || 'Échec'); }
  };

  if (loading && items.length === 0) return (
    <div className="flex items-center justify-center py-32">
      <QwillioLoader size={120} fullscreen={false} />
    </div>
  );

  return (
    <div className="space-y-5 max-w-[1000px]">
      <PageHeader
        title="Follow-ups"
        subtitle={`${items.length} ${pendingOnly ? 'en attente' : 'au total'}`}
      />

      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
        {[
          { v: true,  l: 'En attente' },
          { v: false, l: 'Tous' },
        ].map(opt => (
          <button
            key={String(opt.v)}
            onClick={() => setPendingOnly(opt.v)}
            className="px-3 h-8 text-[12px] font-medium rounded-lg transition-colors"
            style={{
              background: pendingOnly === opt.v ? pro.panelHi : 'transparent',
              color: pendingOnly === opt.v ? pro.text : pro.textSec,
            }}
          >
            <Filter size={11} className="inline mr-1.5 -mt-0.5" />
            {opt.l}
          </button>
        ))}
      </div>

      <Card>
        {items.length === 0 ? (
          <div className="p-12 text-center" style={{ color: pro.textTer }}>
            <p className="text-[13px]">Aucun follow-up</p>
          </div>
        ) : (
          items.map((it, i) => {
            const sent = !!it.sentAt;
            return (
              <div key={it.id}
                   className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02]"
                   style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: pro.panelHi }}>
                  {sent ? <Check size={13} style={{ color: pro.ok }} /> : <Clock size={13} style={{ color: pro.textSec }} />}
                </div>
                <Link to={`/closer/prospects/${it.prospect.id}`} className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                    {it.prospect.businessName}
                  </p>
                  <p className="text-[11.5px] mt-0.5" style={{ color: pro.textTer }}>
                    {it.type.toUpperCase()} · étape {it.step} · {sent ? `envoyé ${fmt(it.sentAt!)}` : `prévu ${fmt(it.scheduledAt)}`}
                  </p>
                </Link>
                <Pill color={sent ? 'ok' : 'neutral'}>{sent ? 'ENVOYÉ' : 'EN ATTENTE'}</Pill>
                {!sent && (
                  <button onClick={() => cancel(it.id)}
                          className="p-1.5 rounded hover:bg-white/[0.06]"
                          style={{ color: pro.textTer }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
