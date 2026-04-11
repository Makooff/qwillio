import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { DashboardStats, BotStatus } from '../types';
import {
  Building2, Phone, TrendingUp, Zap, Target, BarChart3,
  Play, Square, Loader2, ArrowUpRight,
  CheckCircle2, XCircle, Clock, AlertTriangle,
  Crosshair, Brain, Mail, Settings, Cpu, DollarSign,
  Activity, Users, FileText, Globe, Hash, Timer,
  Calendar, Database, Wifi, WifiOff, ToggleRight, ToggleLeft,
  RefreshCw, ChevronRight, Info, Server, Shield,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';

/* ══════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════ */
function ago(d: string | null | undefined) {
  if (!d) return 'jamais';
  try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: fr }); }
  catch { return '—'; }
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: fr }); }
  catch { return '—'; }
}

/* ══════════════════════════════════════════════
   SHARED UI BLOCKS
   ══════════════════════════════════════════════ */
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl bg-[#12121A] border border-white/[0.06] p-5 ${className}`}>{children}</div>
);

const SectionTitle = ({ icon: Icon, title, badge }: { icon: any; title: string; badge?: string }) => (
  <div className="flex items-center gap-2 mb-4">
    <Icon className="w-4 h-4 text-[#7B5CF0]" />
    <h3 className="text-sm font-semibold text-[#F8F8FF]">{title}</h3>
    {badge && <span className="text-[10px] bg-[#7B5CF0]/15 text-[#7B5CF0] px-2 py-0.5 rounded-full font-medium">{badge}</span>}
  </div>
);

const InfoRow = ({ label, value, color, mono }: { label: string; value: string | number; color?: string; mono?: boolean }) => (
  <div className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
    <span className="text-xs text-[#8B8BA7]">{label}</span>
    <span className={`text-xs font-semibold ${mono ? 'tabular-nums' : ''}`} style={{ color: color ?? '#F8F8FF' }}>{value}</span>
  </div>
);

const StatusPill = ({ active, label }: { active: boolean; label: string }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium
    ${active ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#8B8BA7]/10 text-[#8B8BA7]'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-[#22C55E] animate-pulse' : 'bg-[#8B8BA7]'}`} />
    {label}
  </span>
);

const ProgressBar = ({ label, value, max, color, showPct }: { label: string; value: number; max: number; color: string; showPct?: boolean }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-[#8B8BA7]">{label}</span>
        <span className="font-semibold text-[#F8F8FF] tabular-nums">{showPct ? `${pct.toFixed(1)}%` : `${value}/${max}`}</span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   TAB DEFINITIONS
   ══════════════════════════════════════════════ */
const TABS = [
  { key: 'overview', label: 'Vue d\'ensemble', icon: BarChart3 },
  { key: 'bot', label: 'Bot', icon: Cpu },
  { key: 'prospection', label: 'Prospection', icon: Crosshair },
  { key: 'calls', label: 'Appels', icon: Phone },
  { key: 'revenue', label: 'Revenus', icon: DollarSign },
  { key: 'ai', label: 'IA', icon: Brain },
  { key: 'services', label: 'Services', icon: Server },
] as const;

type TabKey = typeof TABS[number]['key'];

/* ══════════════════════════════════════════════
   MAIN DASHBOARD
   ══════════════════════════════════════════════ */
export default function Dashboard() {
  const [tab, setTab] = useState<TabKey>('overview');
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
      setStats(s.data);
      setBot(b.data);
      setHealth(h.data);
      setActivity(Array.isArray(a.data) ? a.data : []);
      setProspecting(p.data);
      setAiStats(ai.data);
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
    try { await api.post(`/bot/run/${task}`); setTimeout(load, 2000); }
    catch { /* silent */ }
    finally { setTimeout(() => setRunning(null), 1500); }
  };

  const triggerProspecting = async (action: string) => {
    setRunning(action);
    try { await api.post(`/prospecting/trigger/${action}`); setTimeout(load, 2000); }
    catch { /* silent */ }
    finally { setTimeout(() => setRunning(null), 1500); }
  };

  // Computed values
  const mrr = stats?.revenue?.mrr ?? 0;
  const callsToday = bot?.callsToday ?? stats?.calls?.today ?? 0;
  const quota = bot?.callsQuotaDaily ?? 50;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-[#7B5CF0]" />
    </div>
  );

  /* ══════════════════════════════════════════
     TAB: VUE D'ENSEMBLE
     ══════════════════════════════════════════ */
  const renderOverview = () => (
    <div className="space-y-4">
      {/* Bot status bar */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={toggleBot} disabled={toggling}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50
              ${bot?.isActive
                ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20'
                : 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E] hover:bg-[#22C55E]/20'}`}>
            {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> :
              bot?.isActive ? <><span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" /><Square className="w-4 h-4" /> Arrêter le bot</> :
              <><span className="w-2 h-2 rounded-full bg-[#22C55E]" /><Play className="w-4 h-4" /> Démarrer le bot</>}
          </button>
          <div className="min-w-[120px]">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#8B8BA7]">Appels</span>
              <span className="font-semibold text-[#F8F8FF]">{callsToday}/{quota}</span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${Math.min((callsToday / quota) * 100, 100)}%`,
                background: callsToday / quota >= 0.9 ? '#EF4444' : callsToday / quota >= 0.6 ? '#F59E0B' : '#7B5CF0',
              }} />
            </div>
          </div>
          {health && (
            <div className="flex flex-wrap gap-1 ml-auto">
              {Object.entries(health).map(([k, v]) => (
                <span key={k} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium
                  ${v ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
                  {v ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                  {k === 'resend' ? 'Email' : k === 'database' ? 'DB' : k.charAt(0).toUpperCase() + k.slice(1)}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Prospects', value: stats?.prospects?.total ?? 0, icon: Target, color: '#7B5CF0', to: '/admin/prospects' },
          { label: 'Clients actifs', value: stats?.clients?.totalActive ?? 0, icon: Building2, color: '#3B82F6', to: '/admin/clients' },
          { label: 'MRR', value: `$${mrr.toLocaleString()}`, icon: TrendingUp, color: '#22C55E', to: '/admin/billing' },
          { label: 'Appels aujourd\'hui', value: callsToday, icon: Phone, color: '#F59E0B', to: '/admin/calls' },
          { label: 'Leads chauds', value: stats?.calls?.hotLeadsToday ?? 0, icon: Zap, color: '#EF4444', to: '/admin/leads' },
          { label: 'Conversion', value: `${(stats?.conversion?.prospectToClient ?? 0).toFixed(1)}%`, icon: BarChart3, color: '#8B5CF6', to: '/admin/prospects' },
        ].map(({ label, value, icon: Icon, color, to }) => (
          <Link key={label} to={to} className="group rounded-xl bg-[#12121A] border border-white/[0.06] p-4 hover:border-white/[0.15] transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8B8BA7]">{label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
          </Link>
        ))}
      </div>

      {/* Pipeline + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline */}
        <Card>
          <SectionTitle icon={Activity} title="Pipeline en temps réel" />
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Prospection', value: stats?.prospects?.total ?? 0, sub: ago(bot?.lastRunProspecting ?? bot?.lastProspection), color: '#7B5CF0' },
              { label: 'Appels', value: callsToday, sub: ago(bot?.lastRunCalling ?? bot?.lastCall), color: '#3B82F6' },
              { label: 'Follow-ups', value: bot?.followUpsSent ?? 0, sub: ago(bot?.lastRunFollowUp), color: '#F59E0B' },
              { label: 'Leads chauds', value: stats?.calls?.hotLeadsToday ?? 0, sub: `Score: ${(stats?.calls?.avgInterestScore ?? 0).toFixed(1)}/10`, color: '#22C55E' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 bg-[#0D0D15] border border-white/[0.04]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B8BA7]">{s.label}</p>
                <p className="text-xl font-bold mt-1 tabular-nums" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] text-[#8B8BA7] mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Activity */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle icon={Clock} title="Activité récente" badge={bot?.isActive ? 'LIVE' : undefined} />
            <Link to="/admin/calls" className="text-[11px] text-[#8B8BA7] hover:text-[#F8F8FF] flex items-center gap-1">
              Tout <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {activity.length === 0 ? (
            <div className="text-center py-8 text-[#8B8BA7]">
              <Phone className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-xs">Aucune activité — démarrez le bot</p>
            </div>
          ) : (
            <div className="space-y-1">
              {activity.slice(0, 8).map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03]">
                  <div className="w-7 h-7 rounded-lg bg-[#7B5CF0]/10 flex items-center justify-center text-xs">{item.icon ?? '📞'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#F8F8FF] truncate">{item.message ?? item.businessName ?? 'Appel'}</p>
                    <p className="text-[10px] text-[#8B8BA7]">{item.date ? ago(item.date) : ''}</p>
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
        </Card>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════
     TAB: BOT
     ══════════════════════════════════════════ */
  const renderBot = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* État du Bot */}
        <Card>
          <SectionTitle icon={Cpu} title="État du bot" badge={bot?.isActive ? 'Actif' : 'Inactif'} />
          <div className="flex items-center gap-3 mb-4">
            <button onClick={toggleBot} disabled={toggling}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50 flex-1
                ${bot?.isActive
                  ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20'
                  : 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E] hover:bg-[#22C55E]/20'}`}>
              {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> :
                bot?.isActive ? <><Square className="w-4 h-4" /> Arrêter le bot</> :
                <><Play className="w-4 h-4" /> Démarrer le bot</>}
            </button>
          </div>

          <div className="space-y-0">
            <InfoRow label="Statut" value={bot?.isActive ? '🟢 En cours' : '🔴 Arrêté'} color={bot?.isActive ? '#22C55E' : '#EF4444'} />
            <InfoRow label="Appels aujourd'hui" value={`${callsToday} / ${quota}`} mono />
            <InfoRow label="Prospects trouvés" value={bot?.prospectsFound ?? 0} mono />
            <InfoRow label="Follow-ups envoyés" value={bot?.followUpsSent ?? 0} mono />
            <InfoRow label="Dernière prospection" value={fmtDate(bot?.lastRunProspecting ?? bot?.lastProspection)} />
            <InfoRow label="Dernier appel" value={fmtDate(bot?.lastRunCalling ?? bot?.lastCall)} />
            <InfoRow label="Dernier follow-up" value={fmtDate(bot?.lastRunFollowUp)} />
            <InfoRow label="Dernière activité" value={fmtDate(bot?.lastActivity)} />
          </div>
        </Card>

        {/* Configuration */}
        <Card>
          <SectionTitle icon={Settings} title="Configuration" />
          <div className="space-y-0">
            <InfoRow label="Quota appels / jour" value={quota} mono />
            <InfoRow label="Horaires" value="Lun-Ven, 9h-17h" />
            <InfoRow label="Jours actifs" value="Lundi → Vendredi" />
            <InfoRow label="Intervalle appels" value="20 min" />
            <InfoRow label="Max durée appel" value="5 min" />
            <InfoRow label="Tentatives max" value="3" />
            <InfoRow label="Délai entre tentatives" value="24h" />
          </div>

          <div className="mt-4 pt-4 border-t border-white/[0.04]">
            <p className="text-[10px] text-[#8B8BA7] uppercase tracking-wider mb-3 font-semibold">Cron Jobs</p>
            <div className="space-y-1.5">
              {[
                { label: 'Prospection (Apify)', schedule: 'Tous les jours 2h UTC', key: 'prospection' },
                { label: 'Appels sortants', schedule: '*/20 min Lun-Ven', key: 'calling' },
                { label: 'Follow-ups', schedule: '*/30 min', key: 'followups' },
                { label: 'Analyse A/B', schedule: 'Tous les jours 6h', key: 'ab' },
                { label: 'Best-time learning', schedule: 'Tous les jours 4h', key: 'besttime' },
                { label: 'Script learning', schedule: 'Dimanche 1h', key: 'learning' },
                { label: 'Rescore prospects', schedule: 'Tous les jours 3h', key: 'rescore' },
                { label: 'Keep-alive (Render)', schedule: '*/10 min', key: 'keepalive' },
              ].map(cron => (
                <div key={cron.key} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <StatusPill active={bot?.isActive ?? false} label={bot?.isActive ? 'On' : 'Off'} />
                    <span className="text-xs text-[#F8F8FF]">{cron.label}</span>
                  </div>
                  <span className="text-[10px] text-[#8B8BA7] font-mono">{cron.schedule}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Actions manuelles */}
      <Card>
        <SectionTitle icon={RefreshCw} title="Actions manuelles" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { key: 'prospecting', label: 'Lancer la prospection', desc: 'Scraping Google Maps via Apify', icon: Crosshair, color: '#7B5CF0' },
            { key: 'scoring', label: 'Scorer les prospects', desc: 'Recalcul score 0-22 pts', icon: Target, color: '#3B82F6' },
            { key: 'calling', label: 'Lancer un appel', desc: 'Appel sortant VAPI', icon: Phone, color: '#22C55E' },
            { key: 'followup', label: 'Envoyer follow-ups', desc: 'SMS + email séquence', icon: Mail, color: '#F59E0B' },
          ].map(({ key, label, desc, icon: Icon, color }) => (
            <button key={key} onClick={() => runManual(key)} disabled={running === key}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#0D0D15] border border-white/[0.04]
                hover:border-white/[0.12] transition-all disabled:opacity-50 text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
                {running === key ? <Loader2 className="w-5 h-5 animate-spin" style={{ color }} /> : <Icon className="w-5 h-5" style={{ color }} />}
              </div>
              <p className="text-xs font-semibold text-[#F8F8FF]">{label}</p>
              <p className="text-[10px] text-[#8B8BA7]">{desc}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Quota progress */}
      <Card>
        <SectionTitle icon={BarChart3} title="Quotas du jour" />
        <ProgressBar label="Appels effectués" value={callsToday} max={quota} color="#7B5CF0" />
        <ProgressBar label="Follow-ups envoyés" value={bot?.followUpsSent ?? 0} max={50} color="#F59E0B" />
      </Card>
    </div>
  );

  /* ══════════════════════════════════════════
     TAB: PROSPECTION
     ══════════════════════════════════════════ */
  const renderProspection = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* État */}
        <Card>
          <SectionTitle icon={Crosshair} title="Moteur de prospection" badge={prospecting?.isRunning ? 'En cours' : 'Idle'} />
          <div className="space-y-0">
            <InfoRow label="Total prospects" value={prospecting?.totalProspects ?? stats?.prospects?.total ?? 0} color="#7B5CF0" mono />
            <InfoRow label="Éligibles à l'appel" value={prospecting?.eligibleProspects ?? 0} color="#22C55E" mono />
            <InfoRow label="En attente follow-up" value={prospecting?.pendingFollowUps ?? 0} color="#F59E0B" mono />
            <InfoRow label="Ajoutés aujourd'hui" value={prospecting?.todayAdded ?? 0} mono />
            <InfoRow label="File d'attente" value={prospecting?.prospectsQueued ?? 0} mono />
            <InfoRow label="Dernier scraping" value={fmtDate(prospecting?.lastScrape)} />
            <InfoRow label="Appels aujourd'hui" value={prospecting?.callsToday ?? callsToday} mono />
            <InfoRow label="Apify configuré" value={prospecting?.apifyConfigured ? '✅ Oui' : '❌ Non'} />
          </div>
        </Card>

        {/* Scraping Config */}
        <Card>
          <SectionTitle icon={Globe} title="Configuration scraping" />
          <div className="space-y-0">
            <InfoRow label="Source" value="Google Maps (Apify)" />
            <InfoRow label="Niches ciblées" value="home_services, dental" />
            <InfoRow label="Villes" value="10 villes US" />
            <InfoRow label="Fréquence" value="Tous les jours à 2h UTC" />
            <InfoRow label="Scoring" value="0-22 pts (rating, avis, niche, géo, site)" />
          </div>

          <div className="mt-4 pt-4 border-t border-white/[0.04]">
            <p className="text-[10px] text-[#8B8BA7] uppercase tracking-wider mb-3 font-semibold">Scoring des prospects</p>
            <div className="space-y-1 text-[11px]">
              {[
                { label: 'Google rating < 4.5', pts: '+3' },
                { label: 'Avis < 100', pts: '+3' },
                { label: 'Niche prioritaire', pts: '+4' },
                { label: 'Zone géographique', pts: '+4' },
                { label: 'Pas de site web', pts: '+4' },
                { label: 'Téléphone validé', pts: '+4' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-1">
                  <span className="text-[#8B8BA7]">{s.label}</span>
                  <span className="text-[#22C55E] font-semibold font-mono">{s.pts}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <SectionTitle icon={RefreshCw} title="Actions prospection" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { key: 'scrape', label: 'Scraping', desc: 'Google Maps', icon: Globe },
            { key: 'call', label: 'Appel', desc: '1 prospect', icon: Phone },
            { key: 'follow-ups', label: 'Follow-ups', desc: 'Envoyer', icon: Mail },
            { key: 'rescore', label: 'Rescore', desc: 'Recalculer', icon: Target },
            { key: 'ab-analysis', label: 'Analyse A/B', desc: 'Scripts', icon: BarChart3 },
            { key: 'best-time', label: 'Best-time', desc: 'Apprendre', icon: Clock },
          ].map(({ key, label, desc, icon: Icon }) => (
            <button key={key} onClick={() => triggerProspecting(key)} disabled={running === key}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#0D0D15] border border-white/[0.04]
                hover:border-[#7B5CF0]/30 transition-all disabled:opacity-50">
              {running === key ? <Loader2 className="w-4 h-4 animate-spin text-[#7B5CF0]" /> : <Icon className="w-4 h-4 text-[#7B5CF0]" />}
              <span className="text-[11px] font-semibold text-[#F8F8FF]">{label}</span>
              <span className="text-[10px] text-[#8B8BA7]">{desc}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Tests A/B & Local Presence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <SectionTitle icon={FileText} title="Tests A/B scripts" badge={`${prospecting?.activeAbTests ?? 0} actifs`} />
          <div className="space-y-0">
            <InfoRow label="Tests actifs" value={prospecting?.activeAbTests ?? 0} color="#7B5CF0" mono />
            <InfoRow label="Mutations récentes" value={prospecting?.recentMutations ?? 0} mono />
            <InfoRow label="Seuil de victoire" value="200 appels / variante, 15% diff" />
            <InfoRow label="Langues" value="EN (Ashley) + FR (Marie)" />
            <InfoRow label="Variantes par niche" value="2 scripts, A/B testés" />
          </div>
        </Card>

        <Card>
          <SectionTitle icon={Phone} title="Local Presence Dialing" badge={`${prospecting?.localPresenceNumbers ?? 0} numéros`} />
          <div className="space-y-0">
            <InfoRow label="Numéros actifs" value={prospecting?.localPresenceNumbers ?? 0} mono />
            <InfoRow label="Indicatifs couverts" value="17 area codes US" />
            <InfoRow label="Objectif" value="Numéro local → +40% answer rate" />
            <InfoRow label="Validation téléphone" value="Twilio Lookup (*/10 min)" />
            <InfoRow label="Filtre" value="Mobile uniquement" />
          </div>
        </Card>
      </div>

      {/* Fenêtres d'appel */}
      <Card>
        <SectionTitle icon={Calendar} title="Fenêtres d'appel" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { day: 'Lundi', hours: '10h-11h30' },
            { day: 'Mardi', hours: '9h-11h30 / 14h-17h' },
            { day: 'Mercredi', hours: '9h-11h30 / 14h-17h' },
            { day: 'Jeudi', hours: '9h-11h30 / 14h-17h' },
            { day: 'Vendredi', hours: '10h-11h30' },
          ].map(w => (
            <div key={w.day} className="rounded-xl p-3 bg-[#0D0D15] border border-white/[0.04] text-center">
              <p className="text-xs font-semibold text-[#F8F8FF]">{w.day}</p>
              <p className="text-[10px] text-[#8B8BA7] mt-1">{w.hours}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  /* ══════════════════════════════════════════
     TAB: APPELS
     ══════════════════════════════════════════ */
  const renderCalls = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stats appels */}
        <Card>
          <SectionTitle icon={Phone} title="Statistiques appels" />
          <div className="space-y-0">
            <InfoRow label="Aujourd'hui" value={stats?.calls?.today ?? 0} color="#3B82F6" mono />
            <InfoRow label="Cette heure" value={stats?.calls?.thisHour ?? 0} mono />
            <InfoRow label="Cette semaine" value={stats?.calls?.thisWeek ?? 0} mono />
            <InfoRow label="Taux de succès" value={`${stats?.calls?.successRate ?? 0}%`} color="#22C55E" mono />
            <InfoRow label="Durée moyenne" value={`${stats?.calls?.avgDuration ?? 0}s`} mono />
            <InfoRow label="Score intérêt moyen" value={`${(stats?.calls?.avgInterestScore ?? 0).toFixed(1)}/10`} color="#F59E0B" mono />
            <InfoRow label="Messageries" value={stats?.calls?.voicemails ?? 0} mono />
          </div>
        </Card>

        {/* Leads */}
        <Card>
          <SectionTitle icon={Zap} title="Leads & Conversion" />
          <div className="space-y-0">
            <InfoRow label="Leads chauds (aujourd'hui)" value={stats?.calls?.hotLeadsToday ?? 0} color="#EF4444" mono />
            <InfoRow label="Leads qualifiés" value={stats?.calls?.leadsToday ?? 0} color="#F59E0B" mono />
            <InfoRow label="Seuil lead chaud" value="Score ≥ 8/10" />
            <InfoRow label="Seuil lead qualifié" value="Score ≥ 6/10" />
            <InfoRow label="Action lead chaud" value="Discord alert + callback 5min" />
          </div>

          <div className="mt-4 pt-4 border-t border-white/[0.04]">
            <p className="text-[10px] text-[#8B8BA7] uppercase tracking-wider mb-3 font-semibold">Taux de conversion</p>
            <ProgressBar label="Prospect → Client" value={stats?.conversion?.prospectToClient ?? 0} max={100} color="#7B5CF0" showPct />
            <ProgressBar label="Devis acceptés" value={stats?.conversion?.quoteAcceptanceRate ?? 0} max={100} color="#22C55E" showPct />
            <ProgressBar label="Succès appels" value={stats?.calls?.successRate ?? 0} max={100} color="#F59E0B" showPct />
          </div>
        </Card>
      </div>

      {/* Follow-up séquence */}
      <Card>
        <SectionTitle icon={Mail} title="Séquence post-appel" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { step: '1', label: 'SMS immédiat', desc: 'Envoyé automatiquement après chaque appel complété', timing: 'J+0', color: '#3B82F6' },
            { step: '2', label: 'Email de suivi', desc: 'Récap de l\'appel + proposition de démo', timing: 'J+3', color: '#7B5CF0' },
            { step: '3', label: 'Email de relance', desc: 'Relance finale avec offre spéciale', timing: 'J+7', color: '#F59E0B' },
          ].map(s => (
            <div key={s.step} className="rounded-xl p-4 bg-[#0D0D15] border border-white/[0.04]">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${s.color}20`, color: s.color }}>{s.step}</span>
                <span className="text-xs font-semibold text-[#F8F8FF]">{s.label}</span>
                <span className="text-[10px] text-[#8B8BA7] ml-auto font-mono">{s.timing}</span>
              </div>
              <p className="text-[11px] text-[#8B8BA7]">{s.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Scoring intérêt */}
      <Card>
        <SectionTitle icon={Target} title="Scoring d'intérêt (1-10)" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          {[
            { range: '8-10', label: 'Lead chaud', desc: 'Discord alert, callback 5min', color: '#22C55E' },
            { range: '6-7', label: 'Lead qualifié', desc: 'Suivi prioritaire, devis', color: '#F59E0B' },
            { range: '4-5', label: 'Intéressé', desc: 'Nurturing séquence email', color: '#3B82F6' },
            { range: '1-3', label: 'Froid', desc: 'Pas de suivi immédiat', color: '#EF4444' },
          ].map(s => (
            <div key={s.range} className="rounded-xl p-3 bg-[#0D0D15] border border-white/[0.04]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.range}</span>
              </div>
              <p className="text-xs font-semibold text-[#F8F8FF]">{s.label}</p>
              <p className="text-[10px] text-[#8B8BA7] mt-0.5">{s.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Dernière activité */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle icon={Clock} title="Derniers appels" />
          <Link to="/admin/calls" className="text-[11px] text-[#7B5CF0] hover:text-[#9B7DF0] flex items-center gap-1">
            Voir tout <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        {activity.length === 0 ? (
          <p className="text-xs text-[#8B8BA7] text-center py-6">Aucun appel récent</p>
        ) : (
          <div className="space-y-1">
            {activity.slice(0, 6).map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03]">
                <div className="w-7 h-7 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center text-xs">{item.icon ?? '📞'}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#F8F8FF] truncate">{item.message ?? item.businessName ?? 'Appel'}</p>
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
      </Card>
    </div>
  );

  /* ══════════════════════════════════════════
     TAB: REVENUS
     ══════════════════════════════════════════ */
  const renderRevenue = () => (
    <div className="space-y-4">
      {/* KPIs revenus */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'MRR', value: `$${mrr.toLocaleString()}`, sub: 'Mensuel récurrent', color: '#22C55E' },
          { label: 'ARR', value: `$${(mrr * 12).toLocaleString()}`, sub: 'Annuel récurrent', color: '#3B82F6' },
          { label: 'Ce mois', value: `$${(stats?.revenue?.totalThisMonth ?? 0).toLocaleString()}`, sub: 'Revenus totaux', color: '#7B5CF0' },
          { label: 'Setup fees', value: `$${(stats?.revenue?.setupFeesThisMonth ?? 0).toLocaleString()}`, sub: 'Frais installation', color: '#F59E0B' },
        ].map(s => (
          <Card key={s.label}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B8BA7]">{s.label}</p>
            <p className="text-2xl font-bold mt-2 tabular-nums" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-[#8B8BA7] mt-1">{s.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Clients */}
        <Card>
          <SectionTitle icon={Users} title="Clients" />
          <div className="space-y-0">
            <InfoRow label="Clients actifs" value={stats?.clients?.totalActive ?? 0} color="#22C55E" mono />
            <InfoRow label="Nouveaux ce mois" value={stats?.clients?.newThisMonth ?? 0} color="#3B82F6" mono />
            <InfoRow label="Croissance MRR" value={`${(stats?.revenue?.mrrGrowth ?? 0).toFixed(1)}%`} mono />
          </div>
        </Card>

        {/* Grille tarifaire */}
        <Card>
          <SectionTitle icon={DollarSign} title="Grille tarifaire" />
          <div className="space-y-2">
            {[
              { plan: 'Starter', monthly: '$197/mo', setup: '$697', calls: '200 appels/mo', color: '#3B82F6' },
              { plan: 'Pro', monthly: '$347/mo', setup: '$997', calls: '500 appels/mo', color: '#7B5CF0' },
              { plan: 'Enterprise', monthly: '$497/mo', setup: '$1,497', calls: '1000 appels/mo', color: '#F59E0B' },
            ].map(p => (
              <div key={p.plan} className="flex items-center gap-3 p-3 rounded-xl bg-[#0D0D15] border border-white/[0.04]">
                <div className="w-2 h-8 rounded-full" style={{ background: p.color }} />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-[#F8F8FF]">{p.plan}</p>
                  <p className="text-[10px] text-[#8B8BA7]">{p.calls}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-[#F8F8FF]">{p.monthly}</p>
                  <p className="text-[10px] text-[#8B8BA7]">+ {p.setup} setup</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Conversion */}
      <Card>
        <SectionTitle icon={TrendingUp} title="Taux de conversion" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <ProgressBar label="Prospect → Client" value={stats?.conversion?.prospectToClient ?? 0} max={100} color="#7B5CF0" showPct />
          </div>
          <div>
            <ProgressBar label="Devis acceptés" value={stats?.conversion?.quoteAcceptanceRate ?? 0} max={100} color="#22C55E" showPct />
          </div>
          <div>
            <ProgressBar label="Succès appels" value={stats?.calls?.successRate ?? 0} max={100} color="#F59E0B" showPct />
          </div>
        </div>
      </Card>
    </div>
  );

  /* ══════════════════════════════════════════
     TAB: IA
     ══════════════════════════════════════════ */
  const renderAI = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Mutations ce mois', value: aiStats?.mutationsThisMonth ?? 0, color: '#7B5CF0' },
          { label: 'Total mutations', value: aiStats?.totalMutations ?? 0, color: '#3B82F6' },
          { label: 'Tests A/B actifs', value: aiStats?.activeTests ?? 0, color: '#22C55E' },
          { label: 'Décisions IA', value: aiStats?.totalDecisions ?? 0, color: '#F59E0B' },
        ].map(s => (
          <Card key={s.label}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B8BA7]">{s.label}</p>
            <p className="text-2xl font-bold mt-2 tabular-nums" style={{ color: s.color }}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Script Learning */}
        <Card>
          <SectionTitle icon={Brain} title="Script Learning" />
          <div className="space-y-0">
            <InfoRow label="Mutations ce mois" value={aiStats?.mutationsThisMonth ?? 0} mono />
            <InfoRow label="Reverts" value={aiStats?.reverts ?? 0} color="#EF4444" mono />
            <InfoRow label="Bloquées" value={aiStats?.blocked ?? 0} color="#F59E0B" mono />
            <InfoRow label="Score confiance moyen" value={`${(aiStats?.avgConfidenceScore ?? 0).toFixed(1)}%`} mono />
            <InfoRow label="Seuil confiance" value="75% min" />
            <InfoRow label="Fréquence" value="Hebdomadaire (dimanche 1h)" />
            <InfoRow label="Moteur" value="Claude (Anthropic)" />
          </div>

          <div className="mt-4 pt-4 border-t border-white/[0.04]">
            <p className="text-[10px] text-[#8B8BA7] uppercase tracking-wider mb-2 font-semibold">Processus</p>
            <div className="space-y-1 text-[11px]">
              {[
                '1. Analyse drop-off des transcripts',
                '2. Identification point de friction',
                '3. Claude génère micro-fix (< 20 mots)',
                '4. Test A/B automatique (200 appels)',
                '5. Si +15% → déployer, sinon → revert',
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2 py-1">
                  <ChevronRight className="w-3 h-3 text-[#7B5CF0]" />
                  <span className="text-[#8B8BA7]">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Tests A/B */}
        <Card>
          <SectionTitle icon={BarChart3} title="Tests A/B" />
          <div className="space-y-0">
            <InfoRow label="Tests actifs" value={aiStats?.activeTests ?? 0} color="#22C55E" mono />
            <InfoRow label="Tests terminés" value={aiStats?.completedTests ?? 0} mono />
            <InfoRow label="Seuil victoire" value="200 appels/variante, 15% diff" />
            <InfoRow label="Variantes" value="2 par niche (Ashley EN / Marie FR)" />
          </div>

          <div className="mt-4 pt-4 border-t border-white/[0.04]">
            <p className="text-[10px] text-[#8B8BA7] uppercase tracking-wider mb-2 font-semibold">Après victoire</p>
            <div className="space-y-1 text-[11px]">
              {[
                '1. Script gagnant → production',
                '2. Claude génère nouveau challenger',
                '3. Nouveau test A/B lancé',
                '4. Boucle d\'amélioration continue',
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2 py-1">
                  <ChevronRight className="w-3 h-3 text-[#22C55E]" />
                  <span className="text-[#8B8BA7]">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {[
          { to: '/admin/ai-learning', label: 'Apprentissage IA', desc: 'Mutations & scripts', icon: Brain, color: '#7B5CF0' },
          { to: '/admin/ai-decisions', label: 'Décisions IA', desc: 'Journal des décisions', icon: FileText, color: '#F59E0B' },
          { to: '/admin/prospecting', label: 'Prospection avancée', desc: 'A/B tests & best-times', icon: Crosshair, color: '#3B82F6' },
        ].map(({ to, label, desc, icon: Icon, color }) => (
          <Link key={to} to={to} className="flex items-center gap-3 p-4 rounded-xl bg-[#12121A] border border-white/[0.06] hover:border-white/[0.15] transition-all group">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#F8F8FF]">{label}</p>
              <p className="text-[10px] text-[#8B8BA7]">{desc}</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#8B8BA7] opacity-0 group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </div>
  );

  /* ══════════════════════════════════════════
     TAB: SERVICES
     ══════════════════════════════════════════ */
  const renderServices = () => {
    const services = [
      {
        name: 'VAPI', key: 'vapi', icon: Phone, color: '#3B82F6',
        desc: 'Voice AI — appels sortants automatiques',
        details: [
          { label: 'Rôle', value: 'Appels sortants AI (Ashley/Marie)' },
          { label: 'Env vars', value: 'VAPI_PRIVATE_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID' },
          { label: 'Webhook', value: '/api/webhooks/vapi' },
          { label: 'Features', value: 'Transcription, transfer humain, SMS' },
        ],
      },
      {
        name: 'OpenAI', key: 'openai', icon: Brain, color: '#22C55E',
        desc: 'GPT-4 Turbo — analyse des transcripts',
        details: [
          { label: 'Rôle', value: 'Analyse transcript, scoring intérêt' },
          { label: 'Modèle', value: 'GPT-4 Turbo' },
          { label: 'Env var', value: 'OPENAI_API_KEY' },
          { label: 'Utilisation', value: 'Post-appel analysis, résumé, scoring' },
        ],
      },
      {
        name: 'Twilio', key: 'twilio', icon: Hash, color: '#EF4444',
        desc: 'SMS & validation téléphonique',
        details: [
          { label: 'Rôle', value: 'SMS follow-up, validation numéros' },
          { label: 'Env vars', value: 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN' },
          { label: 'Webhook', value: '/api/webhooks/twilio/sms' },
          { label: 'Features', value: 'Lookup API, SMS, local presence' },
        ],
      },
      {
        name: 'Stripe', key: 'stripe', icon: DollarSign, color: '#7B5CF0',
        desc: 'Paiements & abonnements',
        details: [
          { label: 'Rôle', value: 'Facturation, setup fees, abonnements' },
          { label: 'Env var', value: 'STRIPE_SECRET_KEY + price IDs' },
          { label: 'Webhook', value: '/api/webhooks/stripe' },
          { label: 'Features', value: 'Checkout, subscription, invoices' },
        ],
      },
      {
        name: 'Resend (Email)', key: 'resend', icon: Mail, color: '#F59E0B',
        desc: 'Emails transactionnels',
        details: [
          { label: 'Rôle', value: 'Follow-up emails, confirmations' },
          { label: 'Env var', value: 'RESEND_API_KEY' },
          { label: 'Webhook', value: '/api/webhooks/resend/events' },
          { label: 'Expéditeur', value: 'hello@qwillio.com' },
        ],
      },
      {
        name: 'Base de données', key: 'database', icon: Database, color: '#8B5CF6',
        desc: 'PostgreSQL via Neon (production)',
        details: [
          { label: 'Rôle', value: 'Stockage principal (45 modèles Prisma)' },
          { label: 'Provider', value: 'Neon (production) / PostgreSQL 16 (local)' },
          { label: 'ORM', value: 'Prisma' },
          { label: 'Modèles', value: '45 tables (User, Prospect, Call, Client...)' },
        ],
      },
    ];

    return (
      <div className="space-y-4">
        {/* Status overview */}
        <Card>
          <SectionTitle icon={Shield} title="État des services" badge={`${Object.values(health ?? {}).filter(Boolean).length}/${Object.keys(health ?? {}).length} en ligne`} />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {services.map(s => {
              const ok = health?.[s.key] ?? false;
              return (
                <div key={s.key} className={`rounded-xl p-3 border text-center transition-all
                  ${ok ? 'bg-[#22C55E]/5 border-[#22C55E]/20' : 'bg-[#EF4444]/5 border-[#EF4444]/20'}`}>
                  <s.icon className="w-5 h-5 mx-auto mb-1.5" style={{ color: ok ? '#22C55E' : '#EF4444' }} />
                  <p className="text-xs font-semibold text-[#F8F8FF]">{s.name}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: ok ? '#22C55E' : '#EF4444' }}>
                    {ok ? '● En ligne' : '● Hors ligne'}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Detailed cards per service */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map(s => {
            const ok = health?.[s.key] ?? false;
            return (
              <Card key={s.key}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                    <s.icon className="w-4 h-4" style={{ color: s.color }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#F8F8FF]">{s.name}</p>
                      <StatusPill active={ok} label={ok ? 'En ligne' : 'Hors ligne'} />
                    </div>
                    <p className="text-[10px] text-[#8B8BA7]">{s.desc}</p>
                  </div>
                </div>
                <div className="space-y-0">
                  {s.details.map(d => (
                    <InfoRow key={d.label} label={d.label} value={d.value} />
                  ))}
                </div>
              </Card>
            );
          })}
        </div>

        {/* API Keys needed */}
        <Card>
          <SectionTitle icon={Settings} title="Variables d'environnement requises" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            {[
              'VAPI_PRIVATE_KEY', 'VAPI_ASSISTANT_ID', 'VAPI_PHONE_NUMBER_ID',
              'OPENAI_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN',
              'TWILIO_PHONE_NUMBER', 'RESEND_API_KEY', 'STRIPE_SECRET_KEY',
              'DISCORD_WEBHOOK_URL', 'ANTHROPIC_API_KEY', 'APIFY_API_TOKEN',
              'DATABASE_URL', 'JWT_SECRET',
            ].map(v => (
              <div key={v} className="flex items-center gap-2 py-1.5 border-b border-white/[0.03]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                <span className="text-[11px] text-[#8B8BA7] font-mono">{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  };

  /* ══════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════ */
  const TAB_RENDER: Record<TabKey, () => React.ReactNode> = {
    overview: renderOverview,
    bot: renderBot,
    prospection: renderProspection,
    calls: renderCalls,
    revenue: renderRevenue,
    ai: renderAI,
    services: renderServices,
  };

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-1">
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all
                ${active
                  ? 'bg-[#7B5CF0]/15 text-[#7B5CF0] border border-[#7B5CF0]/30'
                  : 'text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-white/[0.04] border border-transparent'}`}>
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {TAB_RENDER[tab]()}
    </div>
  );
}
