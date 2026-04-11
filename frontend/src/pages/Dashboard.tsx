import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { DashboardStats, BotStatus } from '../types';
import {
  Play, Square, Loader2, CheckCircle2, XCircle, ArrowUpRight,
  Phone, Crosshair, Target, Mail, Brain, Users, Zap,
  TrendingUp, DollarSign, BarChart3, Clock, Settings,
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
  const [prospecting, setProspecting] = useState<any>(null);
  const [aiStats, setAiStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, b, h, a, p, ai] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/bot/status'),
        api.get('/bot/health').catch(() => ({ data: {} })),
        api.get('/dashboard/activity').catch(() => ({ data: [] })),
        api.get('/prospecting/status').catch(() => ({ data: null })),
        api.get('/ai/stats').catch(() => ({ data: null })),
      ]);
      setStats(s.data); setBot(b.data); setHealth(h.data);
      setActivity(Array.isArray(a.data) ? a.data : []);
      setProspecting(p.data); setAiStats(ai.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
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
    <div className="space-y-5 max-w-[1400px]">

      {/* ──────────── 1. BOT CONTROL ──────────── */}
      <section className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <div className="flex flex-wrap items-center gap-4">
          {/* On / Off */}
          <button onClick={toggleBot} disabled={toggling}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-semibold text-sm border transition-all disabled:opacity-50
              ${bot?.isActive
                ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20'
                : 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E] hover:bg-[#22C55E]/20'}`}>
            {toggling
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : bot?.isActive
                ? <><span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" /><Square className="w-4 h-4" /> Arrêter le bot</>
                : <><span className="w-2 h-2 rounded-full bg-[#22C55E]" /><Play className="w-4 h-4" /> Démarrer le bot</>
            }
          </button>

          {/* Quota bar */}
          <div className="w-36">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#8B8BA7]">Quota appels</span>
              <span className="font-bold text-[#F8F8FF] tabular-nums">{calls}/{quota}</span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{
                width: `${pct}%`,
                background: pct >= 90 ? '#EF4444' : pct >= 60 ? '#F59E0B' : '#7B5CF0',
              }} />
            </div>
          </div>

          {/* Services */}
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {health && Object.entries(health).map(([k, ok]) => (
              <span key={k} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium
                ${ok ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
                {ok ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                {k === 'resend' ? 'Email' : k === 'database' ? 'DB' : k.charAt(0).toUpperCase() + k.slice(1)}
              </span>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-white/[0.04]">
          <span className="text-[10px] text-[#8B8BA7] uppercase tracking-widest font-semibold mr-1">Exécuter</span>
          {[
            { key: 'prospecting', label: 'Prospection', icon: Crosshair },
            { key: 'scoring', label: 'Scoring', icon: Target },
            { key: 'calling', label: 'Appel', icon: Phone },
            { key: 'followup', label: 'Follow-up', icon: Mail },
          ].map(({ key, label, icon: I }) => (
            <button key={key} onClick={() => run(key)} disabled={running === key}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
                bg-white/[0.04] text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-white/[0.08]
                border border-white/[0.04] hover:border-white/[0.12] transition-all disabled:opacity-50">
              {running === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <I className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* ──────────── 2. KPIs ──────────── */}
      <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {([
          { label: 'Prospects', val: stats?.prospects?.total ?? 0, icon: Target, clr: '#7B5CF0', to: '/admin/prospects' },
          { label: 'Éligibles', val: prospecting?.eligibleProspects ?? 0, icon: Crosshair, clr: '#8B5CF6', to: '/admin/prospects' },
          { label: 'Clients', val: stats?.clients?.totalActive ?? 0, icon: Users, clr: '#3B82F6', to: '/admin/clients' },
          { label: 'MRR', val: `$${mrr.toLocaleString()}`, icon: TrendingUp, clr: '#22C55E', to: '/admin/billing' },
          { label: 'Appels', val: calls, icon: Phone, clr: '#F59E0B', to: '/admin/calls' },
          { label: 'Leads', val: stats?.calls?.hotLeadsToday ?? 0, icon: Zap, clr: '#EF4444', to: '/admin/leads' },
          { label: 'Conversion', val: `${(stats?.conversion?.prospectToClient ?? 0).toFixed(1)}%`, icon: BarChart3, clr: '#EC4899', to: '/admin/prospects' },
          { label: 'Score moy.', val: `${(stats?.calls?.avgInterestScore ?? 0).toFixed(1)}/10`, icon: Target, clr: '#F97316', to: '/admin/calls' },
        ] as const).map(({ label, val, icon: I, clr, to }) => (
          <Link key={label} to={to}
            className="rounded-xl bg-[#12121A] border border-white/[0.06] p-3.5 hover:border-white/[0.15] transition-all group">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#8B8BA7]">{label}</span>
              <I className="w-3.5 h-3.5 opacity-40 group-hover:opacity-80 transition-opacity" style={{ color: clr }} />
            </div>
            <p className="text-xl font-bold tabular-nums" style={{ color: clr }}>{val}</p>
          </Link>
        ))}
      </section>

      {/* ──────────── 3. THREE COLUMNS ──────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── COL 1: Pipeline + Prospection ── */}
        <div className="space-y-4">
          {/* Pipeline */}
          <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B8BA7] mb-3">Pipeline</h3>
            {[
              { label: 'Prospection', value: stats?.prospects?.total ?? 0, sub: ago(bot?.lastRunProspecting ?? bot?.lastProspection), clr: '#7B5CF0' },
              { label: 'Appels aujourd\'hui', value: calls, sub: ago(bot?.lastRunCalling ?? bot?.lastCall), clr: '#3B82F6' },
              { label: 'Follow-ups envoyés', value: bot?.followUpsSent ?? 0, sub: ago(bot?.lastRunFollowUp), clr: '#F59E0B' },
              { label: 'Leads chauds', value: stats?.calls?.hotLeadsToday ?? 0, sub: `score ${(stats?.calls?.avgInterestScore ?? 0).toFixed(1)}/10`, clr: '#22C55E' },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between py-2.5 border-b border-white/[0.03] last:border-0">
                <div>
                  <p className="text-xs text-[#F8F8FF] font-medium">{r.label}</p>
                  <p className="text-[10px] text-[#8B8BA7]">{r.sub}</p>
                </div>
                <span className="text-lg font-bold tabular-nums" style={{ color: r.clr }}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* Prospection engine */}
          <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B8BA7] mb-3">Moteur de prospection</h3>
            {[
              { l: 'Total prospects', v: prospecting?.totalProspects ?? stats?.prospects?.total ?? 0 },
              { l: 'Éligibles à l\'appel', v: prospecting?.eligibleProspects ?? 0, c: '#22C55E' },
              { l: 'File d\'attente', v: prospecting?.prospectsQueued ?? 0 },
              { l: 'Ajoutés aujourd\'hui', v: prospecting?.todayAdded ?? 0, c: '#3B82F6' },
              { l: 'Follow-ups en attente', v: prospecting?.pendingFollowUps ?? 0, c: '#F59E0B' },
              { l: 'Tests A/B actifs', v: prospecting?.activeAbTests ?? 0, c: '#7B5CF0' },
              { l: 'Numéros locaux', v: prospecting?.localPresenceNumbers ?? 0 },
              { l: 'Dernier scraping', v: ago(prospecting?.lastScrape) },
            ].map(r => (
              <div key={r.l} className="flex justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                <span className="text-[11px] text-[#8B8BA7]">{r.l}</span>
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: r.c ?? '#F8F8FF' }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── COL 2: Revenus + Conversion ── */}
        <div className="space-y-4">
          {/* Revenue */}
          <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B8BA7] mb-3">Revenus</h3>
            <p className="text-3xl font-bold text-[#22C55E] tabular-nums">${mrr.toLocaleString()}<span className="text-sm text-[#8B8BA7] font-normal">/mo</span></p>
            <p className="text-[11px] text-[#8B8BA7] mt-1 mb-4">ARR ${(mrr * 12).toLocaleString()}</p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { l: 'Ce mois', v: `$${(stats?.revenue?.totalThisMonth ?? 0).toLocaleString()}`, c: '#22C55E' },
                { l: 'Setup fees', v: `$${(stats?.revenue?.setupFeesThisMonth ?? 0).toLocaleString()}`, c: '#7B5CF0' },
                { l: 'Nouveaux clients', v: String(stats?.clients?.newThisMonth ?? 0), c: '#3B82F6' },
                { l: 'Durée moy. appel', v: `${stats?.calls?.avgDuration ?? 0}s`, c: '#F59E0B' },
              ].map(s => (
                <div key={s.l} className="bg-[#0D0D15] rounded-xl p-3">
                  <p className="text-base font-bold tabular-nums" style={{ color: s.c }}>{s.v}</p>
                  <p className="text-[9px] text-[#8B8BA7] mt-0.5 uppercase tracking-wide">{s.l}</p>
                </div>
              ))}
            </div>

            {/* Conversion bars */}
            {[
              { l: 'Prospect → Client', v: stats?.conversion?.prospectToClient ?? 0, c: '#7B5CF0' },
              { l: 'Devis acceptés', v: stats?.conversion?.quoteAcceptanceRate ?? 0, c: '#22C55E' },
              { l: 'Succès appels', v: stats?.calls?.successRate ?? 0, c: '#F59E0B' },
            ].map(b => (
              <div key={b.l} className="mb-2.5 last:mb-0">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[#8B8BA7]">{b.l}</span>
                  <span className="font-semibold text-[#F8F8FF] tabular-nums">{b.v.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(b.v, 100)}%`, background: b.c }} />
                </div>
              </div>
            ))}
          </div>

          {/* Appels stats */}
          <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B8BA7] mb-3">Appels détail</h3>
            {[
              { l: 'Aujourd\'hui', v: stats?.calls?.today ?? 0, c: '#3B82F6' },
              { l: 'Cette heure', v: stats?.calls?.thisHour ?? 0 },
              { l: 'Cette semaine', v: stats?.calls?.thisWeek ?? 0 },
              { l: 'Taux de succès', v: `${stats?.calls?.successRate ?? 0}%`, c: '#22C55E' },
              { l: 'Durée moyenne', v: `${stats?.calls?.avgDuration ?? 0}s` },
              { l: 'Messageries', v: stats?.calls?.voicemails ?? 0 },
              { l: 'Score intérêt moy.', v: `${(stats?.calls?.avgInterestScore ?? 0).toFixed(1)}/10`, c: '#F59E0B' },
            ].map(r => (
              <div key={r.l} className="flex justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                <span className="text-[11px] text-[#8B8BA7]">{r.l}</span>
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: r.c ?? '#F8F8FF' }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── COL 3: IA + Activité ── */}
        <div className="space-y-4">
          {/* IA Stats */}
          <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B8BA7] mb-3">Intelligence artificielle</h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { l: 'Mutations', v: aiStats?.totalMutations ?? 0, c: '#7B5CF0' },
                { l: 'Tests A/B', v: aiStats?.activeTests ?? 0, c: '#22C55E' },
                { l: 'Décisions', v: aiStats?.totalDecisions ?? 0, c: '#3B82F6' },
                { l: 'Ce mois', v: aiStats?.mutationsThisMonth ?? 0, c: '#F59E0B' },
              ].map(s => (
                <div key={s.l} className="bg-[#0D0D15] rounded-xl p-3 text-center">
                  <p className="text-lg font-bold tabular-nums" style={{ color: s.c }}>{s.v}</p>
                  <p className="text-[9px] text-[#8B8BA7] uppercase tracking-wide">{s.l}</p>
                </div>
              ))}
            </div>
            {[
              { l: 'Reverts', v: aiStats?.reverts ?? 0, c: '#EF4444' },
              { l: 'Bloquées', v: aiStats?.blocked ?? 0, c: '#F59E0B' },
              { l: 'Confiance moy.', v: `${(aiStats?.avgConfidenceScore ?? 0).toFixed(0)}%` },
              { l: 'Tests terminés', v: aiStats?.completedTests ?? 0 },
              { l: 'Seuil confiance', v: '75%' },
              { l: 'Moteur', v: 'Claude + GPT-4' },
            ].map(r => (
              <div key={r.l} className="flex justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                <span className="text-[11px] text-[#8B8BA7]">{r.l}</span>
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: r.c ?? '#F8F8FF' }}>{r.v}</span>
              </div>
            ))}
          </div>

          {/* Activity */}
          <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B8BA7]">Activité</h3>
                {bot?.isActive && (
                  <span className="flex items-center gap-1 text-[9px] text-[#22C55E] bg-[#22C55E]/10 px-1.5 py-0.5 rounded-full font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />LIVE
                  </span>
                )}
              </div>
              <Link to="/admin/calls" className="text-[10px] text-[#8B8BA7] hover:text-[#F8F8FF] flex items-center gap-0.5">
                Tout <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            {activity.length === 0 ? (
              <div className="text-center py-10 text-[#8B8BA7]">
                <Phone className="w-6 h-6 mx-auto mb-2 opacity-30" />
                <p className="text-[11px]">Aucune activité</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {activity.slice(0, 8).map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-2.5 py-2 border-b border-white/[0.03] last:border-0">
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
            )}
          </div>
        </div>
      </section>

      {/* ──────────── 4. NAVIGATION RAPIDE ──────────── */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {[
          { to: '/admin/prospects', l: 'Prospects', i: Target, c: '#7B5CF0', n: stats?.prospects?.total },
          { to: '/admin/clients', l: 'Clients', i: Users, c: '#3B82F6', n: stats?.clients?.totalActive },
          { to: '/admin/calls', l: 'Appels', i: Phone, c: '#F59E0B', n: stats?.calls?.thisWeek },
          { to: '/admin/leads', l: 'Leads', i: Zap, c: '#EF4444', n: stats?.calls?.hotLeadsToday },
          { to: '/admin/ai-learning', l: 'IA Learning', i: Brain, c: '#22C55E' },
          { to: '/admin/settings', l: 'Paramètres', i: Settings, c: '#8B8BA7' },
        ].map(({ to, l, i: I, c, n }) => (
          <Link key={to} to={to}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-[#12121A] border border-white/[0.06]
              hover:border-white/[0.15] transition-all group">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${c}12` }}>
              <I className="w-4 h-4" style={{ color: c }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#F8F8FF] truncate">{l}</p>
              {n != null && <p className="text-[10px] text-[#8B8BA7] tabular-nums">{n}</p>}
            </div>
            <ArrowUpRight className="w-3 h-3 text-[#8B8BA7] opacity-0 group-hover:opacity-100 flex-shrink-0" />
          </Link>
        ))}
      </section>
    </div>
  );
}
