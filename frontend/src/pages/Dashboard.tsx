import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { DashboardStats, BotStatus } from '../types';
import {
  Play, Square, Loader2, CheckCircle2, XCircle, ArrowUpRight,
  Phone, Crosshair, Target, Mail, Brain, Users, Zap, Save,
  TrendingUp, DollarSign, BarChart3, Clock, Settings,
  Database, Server, Cpu, Globe, Hash, AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

function ago(d: string | null | undefined) {
  if (!d) return 'jamais';
  try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: fr }); }
  catch { return '—'; }
}

function fmtUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [health, setHealth] = useState<Record<string, boolean> | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [prospecting, setProspecting] = useState<any>(null);
  const [aiStats, setAiStats] = useState<any>(null);
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  // Editable config
  const [quotaInput, setQuotaInput] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, b, h, a, p, ai, sys] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/bot/status'),
        api.get('/bot/health').catch(() => ({ data: {} })),
        api.get('/dashboard/activity').catch(() => ({ data: [] })),
        api.get('/prospecting/status').catch(() => ({ data: null })),
        api.get('/ai/stats').catch(() => ({ data: null })),
        api.get('/admin/system').catch(() => ({ data: null })),
      ]);
      setStats(s.data); setBot(b.data); setHealth(h.data);
      setActivity(Array.isArray(a.data) ? a.data : []);
      setProspecting(p.data); setAiStats(ai.data); setSysInfo(sys.data);
      if (!quotaInput) setQuotaInput(String(b.data?.callsQuotaDaily ?? 50));
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

  const saveQuota = async () => {
    const val = parseInt(quotaInput);
    if (!val || val < 1 || val > 500) { setConfigMsg('Entre 1 et 500'); return; }
    setSavingConfig(true); setConfigMsg('');
    try {
      await api.post('/bot/config', { callsQuotaDaily: val });
      setConfigMsg('✓ Sauvegardé');
      setTimeout(load, 500);
    } catch { setConfigMsg('Erreur'); }
    finally { setSavingConfig(false); setTimeout(() => setConfigMsg(''), 3000); }
  };

  const mrr = stats?.revenue?.mrr ?? 0;
  const calls = bot?.callsToday ?? stats?.calls?.today ?? 0;
  const quota = bot?.callsQuotaDaily ?? 50;
  const pct = quota > 0 ? Math.min((calls / quota) * 100, 100) : 0;
  const servicesOk = health ? Object.values(health).filter(Boolean).length : 0;
  const servicesTotal = health ? Object.keys(health).length : 0;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-[#7B5CF0]" />
    </div>
  );

  return (
    <div className="space-y-4 max-w-[1400px]">

      {/* ═══════════════════════════════════════════
          SECTION 1 — BOT CONTROL + SERVICES LIVE
          ═══════════════════════════════════════════ */}
      <section className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {/* Big toggle button */}
          <button onClick={toggleBot} disabled={toggling}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm border transition-all disabled:opacity-50
              ${bot?.isActive
                ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20'
                : 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E] hover:bg-[#22C55E]/20'}`}>
            {toggling ? <Loader2 className="w-4 h-4 animate-spin" />
              : bot?.isActive ? <><span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-pulse" /><Square className="w-4 h-4" /> Arrêter</>
              : <><span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" /><Play className="w-4 h-4" /> Démarrer</>}
          </button>

          {/* Quota bar */}
          <div className="w-40">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#8B8BA7]">Appels</span>
              <span className="font-bold text-[#F8F8FF] tabular-nums">{calls} / {quota}</span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{
                width: `${pct}%`,
                background: pct >= 90 ? '#EF4444' : pct >= 60 ? '#F59E0B' : '#7B5CF0',
              }} />
            </div>
          </div>

          {/* Live indicator */}
          {bot?.isActive && (
            <span className="flex items-center gap-1.5 text-[10px] text-[#22C55E] bg-[#22C55E]/10 px-3 py-1.5 rounded-full font-bold">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />EN COURS
            </span>
          )}

          {/* Services count */}
          <div className="ml-auto text-right hidden md:block">
            <p className="text-xs text-[#8B8BA7]">Services</p>
            <p className="text-sm font-bold" style={{ color: servicesOk === servicesTotal ? '#22C55E' : '#F59E0B' }}>
              {servicesOk}/{servicesTotal} en ligne
            </p>
          </div>
        </div>

        {/* Services grid */}
        <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5 mb-4">
          {health && Object.entries(health).map(([k, ok]) => (
            <div key={k} className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-center
              ${ok ? 'bg-[#22C55E]/5 border-[#22C55E]/15' : 'bg-[#EF4444]/5 border-[#EF4444]/15'}`}>
              {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" /> : <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />}
              <span className="text-[9px] font-semibold text-[#F8F8FF]">
                {k === 'resend' ? 'Email' : k === 'database' ? 'DB' : k.charAt(0).toUpperCase() + k.slice(1)}
              </span>
            </div>
          ))}
        </div>

        {/* Quick run buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/[0.04]">
          <span className="text-[9px] text-[#8B8BA7] uppercase tracking-[0.15em] font-bold">Exécuter manuellement</span>
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

      {/* ═══════════════════════════════════════════
          SECTION 2 — KPIs EN UN COUP D'ŒIL
          ═══════════════════════════════════════════ */}
      <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
        {([
          { l: 'Prospects', v: prospecting?.totalProspects ?? stats?.prospects?.total ?? 0, c: '#7B5CF0', to: '/admin/prospects' },
          { l: 'Éligibles', v: prospecting?.eligibleProspects ?? 0, c: '#8B5CF6', to: '/admin/prospects' },
          { l: 'Clients', v: stats?.clients?.totalActive ?? 0, c: '#3B82F6', to: '/admin/clients' },
          { l: 'MRR', v: `$${mrr.toLocaleString()}`, c: '#22C55E', to: '/admin/billing' },
          { l: 'Appels/jour', v: calls, c: '#F59E0B', to: '/admin/calls' },
          { l: 'Leads chauds', v: stats?.calls?.hotLeadsToday ?? 0, c: '#EF4444', to: '/admin/leads' },
          { l: 'Conversion', v: `${(stats?.conversion?.prospectToClient ?? 0).toFixed(1)}%`, c: '#EC4899', to: '/admin/prospects' },
          { l: 'Score moy.', v: `${(stats?.calls?.avgInterestScore ?? 0).toFixed(1)}/10`, c: '#F97316', to: '/admin/calls' },
        ] as const).map(({ l, v, c, to }) => (
          <Link key={l} to={to}
            className="rounded-xl bg-[#12121A] border border-white/[0.06] p-3 hover:border-white/[0.15] transition-all">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#8B8BA7] mb-1">{l}</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: c }}>{v}</p>
          </Link>
        ))}
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 3 — 4 COLONNES PRINCIPALES
          ═══════════════════════════════════════════ */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

        {/* ── COL A: Bot Live + Pipeline ── */}
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7B5CF0] mb-3 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" /> Bot — état live
          </h3>

          <div className="space-y-0">
            {[
              { l: 'Statut', v: bot?.isActive ? '🟢 Actif' : '🔴 Arrêté', c: bot?.isActive ? '#22C55E' : '#EF4444' },
              { l: 'Appels aujourd\'hui', v: `${calls} / ${quota}` },
              { l: 'Prospects trouvés', v: bot?.prospectsFound ?? 0 },
              { l: 'Follow-ups envoyés', v: bot?.followUpsSent ?? 0 },
            ].map(r => (
              <div key={r.l} className="flex justify-between py-2 border-b border-white/[0.03] last:border-0">
                <span className="text-[11px] text-[#8B8BA7]">{r.l}</span>
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: r.c ?? '#F8F8FF' }}>{r.v}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-2">Dernières exécutions</p>
            {[
              { l: 'Prospection', v: ago(bot?.lastRunProspecting ?? bot?.lastProspection) },
              { l: 'Scoring', v: ago(bot?.lastRunScoring) },
              { l: 'Appels', v: ago(bot?.lastRunCalling ?? bot?.lastCall) },
              { l: 'Follow-up', v: ago(bot?.lastRunFollowUp) },
            ].map(r => (
              <div key={r.l} className="flex justify-between py-1.5">
                <span className="text-[10px] text-[#8B8BA7]">{r.l}</span>
                <span className="text-[10px] text-[#F8F8FF]">{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── COL B: Revenus & Clients ── */}
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#22C55E] mb-3 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Revenus & Clients
          </h3>

          <p className="text-2xl font-bold text-[#22C55E] tabular-nums">${mrr.toLocaleString()}<span className="text-xs text-[#8B8BA7] font-normal">/mo</span></p>
          <p className="text-[10px] text-[#8B8BA7] mb-3">ARR ${(mrr * 12).toLocaleString()}</p>

          <div className="space-y-0">
            {[
              { l: 'Revenus ce mois', v: `$${(stats?.revenue?.totalThisMonth ?? 0).toLocaleString()}`, c: '#22C55E' },
              { l: 'Setup fees', v: `$${(stats?.revenue?.setupFeesThisMonth ?? 0).toLocaleString()}`, c: '#7B5CF0' },
              { l: 'Clients actifs', v: stats?.clients?.totalActive ?? 0, c: '#3B82F6' },
              { l: 'Nouveaux ce mois', v: stats?.clients?.newThisMonth ?? 0 },
            ].map(r => (
              <div key={r.l} className="flex justify-between py-2 border-b border-white/[0.03] last:border-0">
                <span className="text-[11px] text-[#8B8BA7]">{r.l}</span>
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: r.c ?? '#F8F8FF' }}>{r.v}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-2">Taux de conversion</p>
            {[
              { l: 'Prospect → Client', v: stats?.conversion?.prospectToClient ?? 0, c: '#7B5CF0' },
              { l: 'Devis acceptés', v: stats?.conversion?.quoteAcceptanceRate ?? 0, c: '#22C55E' },
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

        {/* ── COL C: Prospection + Appels ── */}
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#3B82F6] mb-3 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" /> Prospection & Appels
          </h3>

          <div className="space-y-0">
            {[
              { l: 'Total prospects', v: prospecting?.totalProspects ?? stats?.prospects?.total ?? 0, c: '#7B5CF0' },
              { l: 'Éligibles appel', v: prospecting?.eligibleProspects ?? 0, c: '#22C55E' },
              { l: 'File d\'attente', v: prospecting?.prospectsQueued ?? 0 },
              { l: 'Ajoutés auj.', v: prospecting?.todayAdded ?? 0, c: '#3B82F6' },
              { l: 'Follow-ups en attente', v: prospecting?.pendingFollowUps ?? 0, c: '#F59E0B' },
              { l: 'Tests A/B actifs', v: prospecting?.activeAbTests ?? 0, c: '#8B5CF6' },
              { l: 'Numéros locaux', v: prospecting?.localPresenceNumbers ?? 0 },
            ].map(r => (
              <div key={r.l} className="flex justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                <span className="text-[11px] text-[#8B8BA7]">{r.l}</span>
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: r.c ?? '#F8F8FF' }}>{r.v}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-2">Stats appels</p>
            {[
              { l: 'Aujourd\'hui', v: stats?.calls?.today ?? 0, c: '#3B82F6' },
              { l: 'Cette semaine', v: stats?.calls?.thisWeek ?? 0 },
              { l: 'Taux succès', v: `${stats?.calls?.successRate ?? 0}%`, c: '#22C55E' },
              { l: 'Durée moy.', v: `${stats?.calls?.avgDuration ?? 0}s` },
              { l: 'Messageries', v: stats?.calls?.voicemails ?? 0 },
              { l: 'Score intérêt', v: `${(stats?.calls?.avgInterestScore ?? 0).toFixed(1)}/10`, c: '#F59E0B' },
            ].map(r => (
              <div key={r.l} className="flex justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                <span className="text-[10px] text-[#8B8BA7]">{r.l}</span>
                <span className="text-[10px] font-semibold tabular-nums" style={{ color: r.c ?? '#F8F8FF' }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── COL D: IA + Activité Live ── */}
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#F59E0B] mb-3 flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5" /> Intelligence artificielle
          </h3>

          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {[
              { l: 'Mutations', v: aiStats?.totalMutations ?? 0, c: '#7B5CF0' },
              { l: 'Tests A/B', v: aiStats?.activeTests ?? 0, c: '#22C55E' },
              { l: 'Décisions', v: aiStats?.totalDecisions ?? 0, c: '#3B82F6' },
              { l: 'Ce mois', v: aiStats?.mutationsThisMonth ?? 0, c: '#F59E0B' },
            ].map(s => (
              <div key={s.l} className="bg-[#0D0D15] rounded-lg p-2 text-center">
                <p className="text-sm font-bold tabular-nums" style={{ color: s.c }}>{s.v}</p>
                <p className="text-[8px] text-[#8B8BA7] uppercase">{s.l}</p>
              </div>
            ))}
          </div>

          {[
            { l: 'Reverts', v: aiStats?.reverts ?? 0, c: '#EF4444' },
            { l: 'Bloquées', v: aiStats?.blocked ?? 0 },
            { l: 'Confiance moy.', v: `${(aiStats?.avgConfidenceScore ?? 0).toFixed(0)}%` },
            { l: 'Tests terminés', v: aiStats?.completedTests ?? 0 },
          ].map(r => (
            <div key={r.l} className="flex justify-between py-1.5 border-b border-white/[0.03] last:border-0">
              <span className="text-[10px] text-[#8B8BA7]">{r.l}</span>
              <span className="text-[10px] font-semibold tabular-nums" style={{ color: r.c ?? '#F8F8FF' }}>{r.v}</span>
            </div>
          ))}

          {/* Last activity mini-feed */}
          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] flex items-center gap-1">
                <Clock className="w-3 h-3" /> Activité live
              </p>
              <Link to="/admin/calls" className="text-[9px] text-[#8B8BA7] hover:text-[#F8F8FF]">Tout →</Link>
            </div>
            {activity.length === 0 ? (
              <p className="text-[10px] text-[#8B8BA7] text-center py-4">Aucune activité</p>
            ) : activity.slice(0, 5).map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/[0.02] last:border-0">
                <span className="text-xs">{item.icon ?? '📞'}</span>
                <p className="text-[10px] text-[#F8F8FF] truncate flex-1">{item.message ?? item.businessName ?? 'Appel'}</p>
                {item.interestScore != null && (
                  <span className="text-[10px] font-bold tabular-nums" style={{
                    color: item.interestScore >= 7 ? '#22C55E' : item.interestScore >= 4 ? '#F59E0B' : '#EF4444'
                  }}>{item.interestScore}/10</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 4 — CONFIGURATION + BASE DE DONNÉES
          ═══════════════════════════════════════════ */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* Config Bot */}
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7B5CF0] mb-3 flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5" /> Configuration bot
          </h3>

          {/* Editable quota */}
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-[#0D0D15] border border-white/[0.04]">
            <div className="flex-1">
              <label className="text-[10px] text-[#8B8BA7] block mb-1">Quota appels / jour</label>
              <input type="number" min={1} max={500} value={quotaInput}
                onChange={e => setQuotaInput(e.target.value)}
                className="w-full bg-transparent text-[#F8F8FF] text-sm font-bold outline-none border-b border-white/[0.1] pb-1
                  focus:border-[#7B5CF0] transition-colors tabular-nums" />
            </div>
            <button onClick={saveQuota} disabled={savingConfig}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#7B5CF0]/15 text-[#7B5CF0] text-[11px] font-semibold
                hover:bg-[#7B5CF0]/25 border border-[#7B5CF0]/30 transition-all disabled:opacity-50">
              {savingConfig ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Sauver
            </button>
            {configMsg && <span className="text-[10px] text-[#22C55E]">{configMsg}</span>}
          </div>

          <div className="space-y-0">
            {[
              { l: 'Horaires d\'appel', v: 'Lun-Ven 9h-17h' },
              { l: 'Intervalle entre appels', v: '20 min' },
              { l: 'Max durée appel', v: '5 min' },
              { l: 'Tentatives max', v: '3 par prospect' },
              { l: 'Délai entre tentatives', v: '24h' },
              { l: 'Scraping auto', v: 'Tous les jours 2h UTC' },
              { l: 'Niches ciblées', v: 'home_services, dental' },
              { l: 'Villes ciblées', v: '10 villes US' },
              { l: 'Seuil lead chaud', v: 'Score ≥ 8/10' },
              { l: 'Seuil confiance IA', v: '75%' },
              { l: 'Voix EN', v: 'Ashley' },
              { l: 'Voix FR', v: 'Marie' },
            ].map(r => (
              <div key={r.l} className="flex justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                <span className="text-[10px] text-[#8B8BA7]">{r.l}</span>
                <span className="text-[10px] font-medium text-[#F8F8FF]">{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Base de données */}
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8B5CF6] mb-3 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" /> Base de données
          </h3>

          <div className="flex items-center gap-2 mb-3 p-2.5 rounded-xl bg-[#22C55E]/5 border border-[#22C55E]/15">
            <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
            <span className="text-xs font-semibold text-[#22C55E]">Connectée</span>
            <span className="text-[10px] text-[#8B8BA7] ml-auto">PostgreSQL / Neon</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[
              { l: 'Prospects', v: sysInfo?.prospects ?? '—', c: '#7B5CF0' },
              { l: 'Clients', v: sysInfo?.clients ?? '—', c: '#3B82F6' },
              { l: 'Appels', v: sysInfo?.calls ?? '—', c: '#F59E0B' },
            ].map(s => (
              <div key={s.l} className="bg-[#0D0D15] rounded-lg p-2.5 text-center">
                <p className="text-base font-bold tabular-nums" style={{ color: s.c }}>{s.v}</p>
                <p className="text-[8px] text-[#8B8BA7] uppercase tracking-wide">{s.l}</p>
              </div>
            ))}
          </div>

          <div className="space-y-0">
            {[
              { l: 'ORM', v: 'Prisma' },
              { l: 'Modèles', v: '45 tables' },
              { l: 'Provider', v: 'Neon (prod) / PG16 (local)' },
              { l: 'Port local', v: '5433' },
            ].map(r => (
              <div key={r.l} className="flex justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                <span className="text-[10px] text-[#8B8BA7]">{r.l}</span>
                <span className="text-[10px] font-medium text-[#F8F8FF]">{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Système / Infra */}
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#F59E0B] mb-3 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5" /> Système
          </h3>

          <div className="space-y-0">
            {[
              { l: 'Backend', v: 'Render (Express/TS)' },
              { l: 'Frontend', v: 'Vercel (React/Vite)' },
              { l: 'Uptime', v: sysInfo?.uptime ? fmtUptime(sysInfo.uptime) : '—', c: '#22C55E' },
              { l: 'Node.js', v: sysInfo?.nodeVersion ?? '—' },
              { l: 'Environnement', v: sysInfo?.env ?? '—' },
              { l: 'Domaine', v: 'qwillio.com' },
              { l: 'API', v: 'qwillio.onrender.com' },
            ].map(r => (
              <div key={r.l} className="flex justify-between py-2 border-b border-white/[0.03] last:border-0">
                <span className="text-[11px] text-[#8B8BA7]">{r.l}</span>
                <span className="text-[11px] font-medium" style={{ color: r.c ?? '#F8F8FF' }}>{r.v}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-2">Grille tarifaire</p>
            {[
              { plan: 'Starter', price: '$197/mo + $697', calls: '200 appels' },
              { plan: 'Pro', price: '$347/mo + $997', calls: '500 appels' },
              { plan: 'Enterprise', price: '$497/mo + $1,497', calls: '1000 appels' },
            ].map(p => (
              <div key={p.plan} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                <span className="text-[10px] font-semibold text-[#F8F8FF]">{p.plan}</span>
                <span className="text-[10px] text-[#8B8BA7]">{p.price} · {p.calls}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 5 — NAVIGATION RAPIDE
          ═══════════════════════════════════════════ */}
      <section className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { to: '/admin/prospects', l: 'Prospects', i: Target, c: '#7B5CF0' },
          { to: '/admin/clients', l: 'Clients', i: Users, c: '#3B82F6' },
          { to: '/admin/calls', l: 'Appels', i: Phone, c: '#F59E0B' },
          { to: '/admin/leads', l: 'Leads', i: Zap, c: '#EF4444' },
          { to: '/admin/ai-learning', l: 'IA', i: Brain, c: '#22C55E' },
          { to: '/admin/settings', l: 'Config', i: Settings, c: '#8B8BA7' },
        ].map(({ to, l, i: I, c }) => (
          <Link key={to} to={to}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#12121A] border border-white/[0.06]
              hover:border-white/[0.15] transition-all group">
            <I className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" style={{ color: c }} />
            <span className="text-[10px] font-medium text-[#8B8BA7] group-hover:text-[#F8F8FF]">{l}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
