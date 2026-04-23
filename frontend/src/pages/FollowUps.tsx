import { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, Mail, Clock, CheckCircle, AlertCircle, Check } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import QwillioLoader from '../components/QwillioLoader';
import { pro } from '../styles/pro-theme';
import { PageHeader, Card, SectionHead, Stat, IconBtn, Pill } from '../components/pro/ProBlocks';

const tooltipStyle = {
  background: '#111114',
  border: `1px solid ${pro.border}`,
  borderRadius: 12,
  fontSize: 12,
  color: pro.text,
};

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const isOverdue = (iso?: string) => {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
};

const pillColor = (status: string): 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent' => {
  const s = (status || '').toLowerCase();
  if (s === 'sent' || s === 'completed' || s === 'done')    return 'ok';
  if (s === 'pending' || s === 'scheduled' || s === 'queued') return 'info';
  if (s === 'overdue' || s === 'failed')                    return 'bad';
  if (s === 'opened' || s === 'clicked')                    return 'accent';
  return 'neutral';
};

export default function FollowUps() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);

  const load = async () => {
    setRefreshing(true);
    try {
      const { data: res } = await api.get('/admin-analytics/followups');
      setData(res);
    } catch { setData(null); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const markDone = async (id: string) => {
    setMarking(id);
    try {
      await api.post(`/admin-analytics/followups/${id}/complete`);
      load();
    } catch { /* best-effort */ }
    finally { setMarking(null); }
  };

  if (loading && !data) return (
    <div className="flex items-center justify-center py-32">
      <QwillioLoader size={120} fullscreen={false} />
    </div>
  );

  const followUps: any[] = Array.isArray(data?.recentFollowUps) ? data.recentFollowUps : [];

  const pending   = Number(data?.pending ?? 0);
  const today     = Number(data?.todayCount ?? data?.today ?? followUps.filter(f => {
    const d = f.dueAt || f.sentAt; if (!d) return false;
    const dt = new Date(d); const now = new Date();
    return dt.toDateString() === now.toDateString();
  }).length);
  const completed = Number(data?.totalSent ?? data?.completed ?? 0);
  const overdue   = Number(data?.overdue ?? followUps.filter(f =>
    isOverdue(f.dueAt) && (f.status || '').toLowerCase() !== 'sent' && (f.status || '').toLowerCase() !== 'completed'
  ).length);

  return (
    <div className="space-y-5 max-w-[1200px]">
      <PageHeader
        title="Suivis automatiques"
        subtitle="Relances, séquences et rappels"
        right={
          <IconBtn onClick={load} title="Rafraîchir">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </IconBtn>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Clock}       label="En attente" value={pending}   hint="À traiter" />
        <Stat icon={Mail}        label="Aujourd'hui" value={today}     hint="Prévu ce jour" />
        <Stat icon={CheckCircle} label="Complétés"  value={completed} hint="Total envoyés" />
        <Stat icon={AlertCircle} label="En retard"  value={overdue}   hint="Échéance dépassée" />
      </div>

      {/* Follow-up list */}
      <section>
        <SectionHead title="Liste des suivis" />
        <Card>
          {followUps.length === 0 ? (
            <div className="p-12 text-center">
              <Mail className="w-7 h-7 mx-auto mb-3" style={{ color: pro.textTer }} />
              <p className="text-[13px]" style={{ color: pro.textSec }}>Aucun suivi</p>
            </div>
          ) : (
            followUps.map((f: any, i: number) => {
              const due = f.dueAt || f.sentAt;
              const overdueItem = isOverdue(f.dueAt) && !['sent','completed','done'].includes((f.status || '').toLowerCase());
              const status = overdueItem ? 'overdue' : (f.status || '—');
              const id = f.id || String(i);
              const canMarkDone = !['sent','completed','done'].includes((f.status || '').toLowerCase());
              return (
                <div
                  key={id}
                  className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.02]"
                  style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <Mail size={14} style={{ color: pro.textSec }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                      {f.businessName || f.contactName || f.name || '—'}
                    </p>
                    <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                      {f.type || 'email'}{f.step ? ` · étape ${f.step}` : ''}
                    </p>
                  </div>
                  <div className="hidden md:block text-right flex-shrink-0">
                    <p className="text-[11px] uppercase tracking-wider" style={{ color: pro.textTer }}>Échéance</p>
                    <p className="text-[12.5px] font-medium tabular-nums" style={{ color: overdueItem ? pro.bad : pro.text }}>
                      {fmtDate(due)}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Pill color={pillColor(status)}>{status}</Pill>
                  </div>
                  {canMarkDone && f.id && (
                    <IconBtn
                      onClick={() => markDone(f.id)}
                      title={marking === f.id ? 'Marquage…' : 'Marquer terminé'}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </IconBtn>
                  )}
                </div>
              );
            })
          )}
        </Card>
      </section>

      {/* By step chart */}
      <Card>
        <div className="p-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] mb-4" style={{ color: pro.textSec }}>
            Suivis par étape
          </h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.byStep ?? []}>
                <XAxis dataKey="step" tick={{ fontSize: 10, fill: pro.textSec }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: pro.textSec }} axisLine={false} tickLine={false} width={35} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: pro.text }} />
                <Bar dataKey="sent"   fill={pro.textTer} radius={[4, 4, 0, 0]} name="Envoyés" />
                <Bar dataKey="opened" fill={pro.accent}  radius={[4, 4, 0, 0]} name="Ouverts" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>
    </div>
  );
}
