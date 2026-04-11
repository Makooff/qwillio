import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { DashboardStats, BotStatus } from '../types';
import {
  Play, Square, Loader2, CheckCircle2, XCircle, ArrowUpRight,
  Phone, Crosshair, Target, Mail, Brain, Users, Zap,
  TrendingUp, DollarSign, BarChart3, Clock, Cpu,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

function ago(d: string | null | undefined) {
  if (!d) return 'jamais';
  try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: fr }); }
  catch { return '—'; }
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [health, setHealth] = useState<Record<string, boolean> | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, b, h, a] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/bot/status'),
        api.get('/bot/health').catch(() => ({ data: {} })),
        api.get('/dashboard/activity').catch(() => ({ data: [] })),
      ]);
      setStats(s.data); setBot(b.data); setHealth(h.data);
      setActivity(Array.isArray(a.data) ? a.data : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    const h = () => load();
    window.addEventListener('admin-refresh', h);
    return () => { clearInterval(t); window.removeEventListener('admin-refresh', h); };
  }, [load]);

  const toggleBot = async () => {
    setToggling(true);
    try {
      await api.post(bot?.isActive ? '/bot/stop' : '/bot/start');
      setBot((await api.get('/bot/status')).data);
    } catch { /* silent */ }
    finally { setToggling(false); }
  };

  const run = async (task: string) => {
    setRunning(task);
    try { await api.post(`/bot/run/${task}`); setTimeout(load, 2000); }
    catch { /* silent */ }
    finally { setTimeout(() => setRunning(null), 1500); }
  };

  const mrr = stats?.revenue?.mrr ?? 0;
  const calls = bot?.callsToday ?? stats?.calls?.today ?? 0;
  const quota = bot?.callsQuotaDaily ?? 50;
  const pct = quota > 0 ? Math.min((calls / quota) * 100, 100) : 0;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-[#7B5CF0]" />
    </div>
  );

  return (
    <div className="space-y-4 max-w-[1400px]">

      {/* ── BOT CONTROL ── */}
      <section className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={toggleBot} disabled={toggling}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm border transition-all disabled:opacity-50
              ${bot?.isActive
                ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20'
                : 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E] hover:bg-[#22C55E]/20'}`}>
            {toggling ? <Loader2 className="w-4 h-4 animate-spin" />
              : bot?.isActive ? <><span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" /><Square className="w-4 h-4" /> Arrêter</>
              : <><span className="w-2 h-2 rounded-full bg-[#22C55E]" /><Play className="w-4 h-4" /> Démarrer</>}
          </button>

          <div className="w-36">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#8B8BA7]">Appels</span>
              <span className="font-bold text-[#F8F8FF] tabular-nums">{calls}/{quota}</span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{
                width: `${pct}%`, background: pct >= 90 ? '#EF4444' : pct >= 60 ? '#F59E0B' : '#7B5CF0',
              }} />
            </div>
          </div>

          {health && (
            <div className="flex flex-wrap gap-1 ml-auto">
              {Object.entries(health).map(([k, ok]) => (
                <span key={k} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium
                  ${ok ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
                  {ok ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                  {k === 'resend' ? 'Email' : k === 'database' ? 'DB' : k.charAt(0).toUpperCase() + k.slice(1)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/[0.04]">
          {[
            { key: 'prospecting', label: 'Prospection', icon: Crosshair },
            { key: 'scoring', label: 'Scoring', icon: Target },
            { key: 'calling', label: 'Appel', icon: Phone },
            { key: 'followup', label: 'Follow-up', icon: Mail },
          ].map(({ key, label, icon: I }) => (
            <button key={key} onClick={() => run(key)} disabled={running === key}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
                bg-white/[0.04] text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-[#7B5CF0]/10
                border border-white/[0.04] hover:border-[#7B5CF0]/30 transition-all disabled:opacity-50">
              {running === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <I className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* ── KPIs ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
        {([
          { l: 'Prospects', v: stats?.prospects?.total ?? 0, c: '#7B5CF0', to: '/admin/prospects' },
          { l: 'Clients', v: stats?.clients?.totalActive ?? 0, c: '#3B82F6', to: '/admin/clients' },
          { l: 'MRR', v: `$${mrr.toLocaleString()}`, c: '#22C55E', to: '/admin/billing' },
          { l: 'Appels', v: calls, c: '#F59E0B', to: '/admin/calls' },
          { l: 'Leads', v: stats?.calls?.hotLeadsToday ?? 0, c: '#EF4444', to: '/admin/leads' },
          { l: 'Conversion', v: `${(stats?.conversion?.prospectToClient ?? 0).toFixed(1)}%`, c: '#EC4899', to: '/admin/prospects' },
        ] as const).map(({ l, v, c, to }) => (
          <Link key={l} to={to}
            className="rounded-xl bg-[#12121A] border border-white/[0.06] p-3.5 hover:border-white/[0.15] transition-all">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#8B8BA7] mb-1">{l}</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: c }}>{v}</p>
          </Link>
        ))}
      </section>

      {/* ── 3 COLONNES ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Bot live */}
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7B5CF0] mb-3 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" /> Bot live
          </h3>
          {[
            { l: 'Statut', v: bot?.isActive ? '🟢 Actif' : '🔴 Arrêté', c: bot?.isActive ? '#22C55E' : '#EF4444' },
            { l: 'Appels', v: `${calls} / ${quota}` },
            { l: 'Follow-ups', v: bot?.followUpsSent ?? 0 },
            { l: 'Dern. prospection', v: ago(bot?.lastRunProspecting ?? bot?.lastProspection) },
            { l: 'Dern. appel', v: ago(bot?.lastRunCalling ?? bot?.lastCall) },
            { l: 'Dern. follow-up', v: ago(bot?.lastRunFollowUp) },
          ].map(r => (
            <div key={r.l} className="flex justify-between py-2 border-b border-white/[0.03] last:border-0">
              <span className="text-[11px] text-[#8B8BA7]">{r.l}</span>
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: r.c ?? '#F8F8FF' }}>{r.v}</span>
            </div>
          ))}
        </div>

        {/* Revenus */}
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#22C55E] mb-3 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Revenus
          </h3>
          <p className="text-2xl font-bold text-[#22C55E] tabular-nums mb-3">${mrr.toLocaleString()}<span className="text-xs text-[#8B8BA7] font-normal">/mo</span></p>
          {[
            { l: 'Ce mois', v: `$${(stats?.revenue?.totalThisMonth ?? 0).toLocaleString()}`, c: '#22C55E' },
            { l: 'Setup fees', v: `$${(stats?.revenue?.setupFeesThisMonth ?? 0).toLocaleString()}`, c: '#7B5CF0' },
            { l: 'Clients actifs', v: stats?.clients?.totalActive ?? 0, c: '#3B82F6' },
            { l: 'Nouveaux', v: stats?.clients?.newThisMonth ?? 0 },
          ].map(r => (
            <div key={r.l} className="flex justify-between py-1.5 border-b border-white/[0.03] last:border-0">
              <span className="text-[11px] text-[#8B8BA7]">{r.l}</span>
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: r.c ?? '#F8F8FF' }}>{r.v}</span>
            </div>
          ))}
          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            {[
              { l: 'Prospect → Client', v: stats?.conversion?.prospectToClient ?? 0, c: '#7B5CF0' },
              { l: 'Succès appels', v: stats?.calls?.successRate ?? 0, c: '#F59E0B' },
            ].map(b => (
              <div key={b.l} className="mb-2 last:mb-0">
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-[#8B8BA7]">{b.l}</span>
                  <span className="font-bold tabular-nums" style={{ color: b.c }}>{b.v.toFixed(1)}%</span>
                </div>
                <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(b.v, 100)}%`, background: b.c }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activité */}
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#F59E0B] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Activité
              {bot?.isActive && (
                <span className="text-[9px] text-[#22C55E] bg-[#22C55E]/10 px-1.5 py-0.5 rounded-full ml-1">LIVE</span>
              )}
            </h3>
            <Link to="/admin/calls" className="text-[10px] text-[#8B8BA7] hover:text-[#F8F8FF] flex items-center gap-0.5">
              Tout <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {activity.length === 0 ? (
            <div className="text-center py-10 text-[#8B8BA7]">
              <Phone className="w-6 h-6 mx-auto mb-2 opacity-30" />
              <p className="text-[11px]">Aucune activité</p>
            </div>
          ) : activity.slice(0, 8).map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-2 border-b border-white/[0.03] last:border-0">
              <span className="text-sm">{item.icon ?? '📞'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-[#F8F8FF] truncate">{item.message ?? item.businessName ?? 'Appel'}</p>
                <p className="text-[10px] text-[#8B8BA7]">{item.date ? ago(item.date) : ''}</p>
              </div>
              {item.interestScore != null && (
                <span className="text-[11px] font-bold tabular-nums" style={{
                  color: item.interestScore >= 7 ? '#22C55E' : item.interestScore >= 4 ? '#F59E0B' : '#EF4444'
                }}>{item.interestScore}/10</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
