import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { DashboardStats, BotStatus } from '../types';
import {
  Building2, Phone, TrendingUp, Zap, Target, BarChart3,
  Play, Square, RefreshCw, ArrowUpRight,
  CheckCircle2, XCircle, Loader2,
  Crosshair, Brain, Mail, Settings,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

/* ── Helpers ── */
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
        api.get('/dashboard/activity'),
      ]);
      setStats(s.data);
      setBot(b.data);
      setHealth(h.data);
      setActivity(Array.isArray(a.data) ? a.data : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    const handler = () => load();
    window.addEventListener('admin-refresh', handler);
    return () => { clearInterval(t); window.removeEventListener('admin-refresh', handler); };
  }, [load]);

  const toggleBot = async () => {
    setToggling(true);
    try {
      if (bot?.isActive) await api.post('/bot/stop');
      else await api.post('/bot/start');
      const { data } = await api.get('/bot/status');
      setBot(data);
    } catch { /* silent */ }
    finally { setToggling(false); }
  };

  const runManual = async (task: string) => {
    setRunning(task);
    try {
      await api.post(`/bot/run/${task}`);
      setTimeout(load, 2000);
    } catch { /* silent */ }
    finally { setTimeout(() => setRunning(null), 1500); }
  };

  const mrr = stats?.revenue?.mrr ?? 0;
  const callsToday = bot?.callsToday ?? stats?.calls?.today ?? 0;
  const quota = bot?.callsQuotaDaily ?? 50;
  const pct = Math.min((callsToday / quota) * 100, 100);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#7B5CF0]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ═══ BOT CONTROL ═══ */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={toggleBot} disabled={toggling}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50
              ${bot?.isActive
                ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20'
                : 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E] hover:bg-[#22C55E]/20'}`}>
            {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> :
              bot?.isActive ? <><span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" /><Square className="w-4 h-4" /> Arrêter</> :
              <><span className="w-2 h-2 rounded-full bg-[#22C55E]" /><Play className="w-4 h-4" /> Démarrer</>}
          </button>

          {/* Quota */}
          <div className="min-w-[120px]">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#8B8BA7]">Appels</span>
              <span className="font-semibold text-[#F8F8FF]">{callsToday}/{quota}</span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${pct}%`,
                background: pct >= 90 ? '#EF4444' : pct >= 60 ? '#F59E0B' : '#7B5CF0',
              }} />
            </div>
          </div>

          {/* Health dots */}
          {health && (
            <div className="flex flex-wrap gap-1 ml-auto">
              {(['vapi', 'openai', 'twilio', 'stripe', 'resend', 'database'] as const).map(k => (
                <span key={k} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium
                  ${health[k] ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
                  {health[k] ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                  {k === 'resend' ? 'Email' : k === 'database' ? 'DB' : k.charAt(0).toUpperCase() + k.slice(1)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Pipeline */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            { label: 'Prospects', value: stats?.prospects?.total ?? 0, sub: ago(bot?.lastRunProspecting ?? bot?.lastProspection), color: '#7B5CF0' },
            { label: 'Appels', value: callsToday, sub: ago(bot?.lastRunCalling ?? bot?.lastCall), color: '#3B82F6' },
            { label: 'Follow-ups', value: bot?.followUpsSent ?? 0, sub: ago(bot?.lastRunFollowUp), color: '#F59E0B' },
            { label: 'Leads chauds', value: stats?.calls?.hotLeadsToday ?? 0, sub: `Score: ${(stats?.calls?.avgInterestScore ?? 0).toFixed(1)}/10`, color: '#22C55E' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 bg-[#0D0D15] border border-white/[0.04]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B8BA7]">{s.label}</p>
              <p className="text-xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-[#8B8BA7] mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Manual triggers */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/[0.04]">
          <span className="text-[10px] text-[#8B8BA7] uppercase tracking-wider self-center mr-1">Exécuter :</span>
          {[
            { key: 'prospecting', label: 'Prospection', icon: Crosshair },
            { key: 'scoring', label: 'Scoring', icon: Target },
            { key: 'calling', label: 'Appel', icon: Phone },
            { key: 'followup', label: 'Follow-up', icon: Mail },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => runManual(key)} disabled={running === key}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
                bg-white/[0.04] text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-white/[0.08]
                border border-white/[0.04] hover:border-white/[0.1] transition-all disabled:opacity-50">
              {running === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ KPIs ═══ */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Clients', value: String(stats?.clients?.totalActive ?? 0), icon: Building2, to: '/admin/clients' },
          { label: 'MRR', value: `$${mrr.toLocaleString()}`, icon: TrendingUp, to: '/admin/billing', color: '#22C55E' },
          { label: 'Appels', value: String(stats?.calls?.today ?? 0), icon: Phone, to: '/admin/calls' },
          { label: 'Leads', value: String(stats?.calls?.hotLeadsToday ?? 0), icon: Zap, to: '/admin/leads', color: '#F59E0B' },
          { label: 'Conversion', value: `${(stats?.conversion?.prospectToClient ?? 0).toFixed(1)}%`, icon: Target, to: '/admin/prospects' },
          { label: 'Score moy.', value: `${(stats?.calls?.avgInterestScore ?? 0).toFixed(1)}/10`, icon: BarChart3, to: '/admin/calls', color: '#EF4444' },
        ].map(({ label, value, icon: Icon, to, color }) => (
          <Link key={label} to={to}
            className="rounded-xl bg-[#12121A] border border-white/[0.06] p-4 hover:border-white/[0.12] transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8B8BA7]">{label}</span>
              <Icon className="w-4 h-4 text-[#8B8BA7] group-hover:text-[#F8F8FF] transition-colors" />
            </div>
            <p className="text-2xl font-bold tabular-nums" style={{ color: color ?? '#F8F8FF' }}>{value}</p>
          </Link>
        ))}
      </div>

      {/* ═══ BOTTOM: Revenue summary + Activity ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Revenue summary */}
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Revenus</h3>
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-bold text-[#22C55E]">${mrr.toLocaleString()}<span className="text-sm text-[#8B8BA7] font-normal">/mo</span></p>
              <p className="text-xs text-[#8B8BA7] mt-1">ARR ${(mrr * 12).toLocaleString()}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Ce mois', value: `$${(stats?.revenue?.totalThisMonth ?? 0).toLocaleString()}`, color: '#22C55E' },
                { label: 'Setup fees', value: `$${(stats?.revenue?.setupFeesThisMonth ?? 0).toLocaleString()}`, color: '#7B5CF0' },
                { label: 'Nouveaux', value: String(stats?.clients?.newThisMonth ?? 0), color: '#3B82F6' },
                { label: 'Durée moy.', value: `${stats?.calls?.avgDuration ?? 0}s`, color: '#F59E0B' },
              ].map(s => (
                <div key={s.label} className="bg-[#0D0D15] rounded-xl p-3">
                  <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[10px] text-[#8B8BA7] mt-0.5 uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
            {/* Conversion bars */}
            <div className="space-y-2 pt-2 border-t border-white/[0.04]">
              {[
                { label: 'Prospect → Client', value: stats?.conversion?.prospectToClient ?? 0, color: '#7B5CF0' },
                { label: 'Devis acceptés', value: stats?.conversion?.quoteAcceptanceRate ?? 0, color: '#22C55E' },
                { label: 'Succès appels', value: stats?.calls?.successRate ?? 0, color: '#F59E0B' },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#8B8BA7]">{item.label}</span>
                    <span className="font-semibold text-[#F8F8FF]">{(item.value).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(item.value, 100)}%`, background: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="lg:col-span-2 rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#F8F8FF]">Activité récente</h3>
              {bot?.isActive && (
                <span className="flex items-center gap-1 text-[10px] text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />LIVE
                </span>
              )}
            </div>
            <Link to="/admin/calls" className="text-[11px] text-[#8B8BA7] hover:text-[#F8F8FF] flex items-center gap-1">
              Voir tout <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#8B8BA7]">
              <Phone className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Aucune activité</p>
              <p className="text-xs mt-1">Démarrez le bot pour voir l'activité</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {activity.slice(0, 10).map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.03] transition-all">
                  <div className="w-8 h-8 rounded-lg bg-[#7B5CF0]/10 flex items-center justify-center text-sm">
                    {item.icon ?? '📞'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#F8F8FF] truncate">{item.message ?? item.businessName ?? 'Appel'}</p>
                    <p className="text-[10px] text-[#8B8BA7]">{item.date ? ago(item.date) : ''}{item.niche ? ` · ${item.niche}` : ''}</p>
                  </div>
                  {item.interestScore !== undefined && (
                    <span className="text-xs font-bold tabular-nums" style={{
                      color: item.interestScore >= 7 ? '#22C55E' : item.interestScore >= 4 ? '#F59E0B' : '#EF4444'
                    }}>{item.interestScore}/10</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ QUICK LINKS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { to: '/admin/prospects', label: 'Prospects', icon: Target, count: stats?.prospects?.total, color: '#7B5CF0' },
          { to: '/admin/ai-learning', label: 'IA Learning', icon: Brain, color: '#F59E0B' },
          { to: '/admin/prospecting', label: 'Prospection', icon: Crosshair, color: '#3B82F6' },
          { to: '/admin/settings', label: 'Paramètres', icon: Settings, color: '#8B8BA7' },
        ].map(({ to, label, icon: Icon, count, color }) => (
          <Link key={to} to={to}
            className="flex items-center gap-3 p-3 rounded-xl bg-[#12121A] border border-white/[0.06]
              hover:border-white/[0.12] transition-all group">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15`, color }}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#F8F8FF]">{label}</p>
              {count != null && <p className="text-[10px] text-[#8B8BA7]">{count} total</p>}
            </div>
            <ArrowUpRight className="w-3 h-3 text-[#8B8BA7] opacity-0 group-hover:opacity-100 ml-auto" />
          </Link>
        ))}
      </div>
    </div>
  );
}
