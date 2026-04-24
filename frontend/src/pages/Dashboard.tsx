import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Target, Users, DollarSign, Phone, Bot, Play, Pause,
  ChevronRight, RefreshCw, AlertCircle, Activity, BarChart3,
  Zap, Settings as SettingsIcon, Sparkles, CreditCard,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import OrbsLoader from '../components/OrbsLoader';

const API = 'https://qwillio.onrender.com';
const getH = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const fmtRelative = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000)       return 'à l\'instant';
  if (diff < 3_600_000)    return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000)   return `il y a ${Math.floor(diff / 3_600_000)} h`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// ── Stripe / Vercel-style design tokens (local) ─────────────────────────
const C = {
  bg:       '#0A0A0C',
  panel:    'rgba(255,255,255,0.03)',
  border:   'rgba(255,255,255,0.07)',
  borderHi: 'rgba(255,255,255,0.12)',
  text:     '#F5F5F7',
  textSec:  '#A1A1A8',
  textTer:  '#6B6B75',
  accent:   '#7B5CF0',
  ok:       '#22C55E',
  warn:     '#F59E0B',
  bad:      '#EF4444',
};

interface BotAction { message: string; timestamp: string; }
interface NextAction { name: string; inMinutes: number; }
interface D {
  prospects: { total: number; newThisMonth: number };
  clients:   { totalActive: number; newThisMonth: number };
  revenue:   { mrr: number };
  calls:     { today: number; thisWeek: number };
  bot:       {
    isActive: boolean;
    callsToday: number;
    callsQuota: number;
    lastAction?: BotAction | null;
    previousAction?: BotAction | null;
    nextAction?: NextAction | null;
  };
  activity:  any[];
}

// ── Building blocks ─────────────────────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`rounded-2xl border ${className}`} style={{ background: C.panel, borderColor: C.border }}>
    {children}
  </div>
);

const SectionHead: React.FC<{ title: string; action?: React.ReactNode }> = ({ title, action }) => (
  <div className="flex items-center justify-between mb-3 px-1">
    <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: C.textSec }}>{title}</h2>
    {action}
  </div>
);

const Stat: React.FC<{
  label: string; value: string | number; hint?: string;
  icon?: any; to?: string;
  trend?: { dir: 'up' | 'down' | 'flat'; pct: number };
}> = ({ label, value, hint, icon: Icon, to, trend }) => {
  const inner = (
    <Card className={to ? 'hover:border-white/[0.14] transition-colors' : ''}>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          {Icon && <Icon size={14} style={{ color: C.textSec }} />}
          <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: C.textTer }}>{label}</p>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-[26px] font-semibold tabular-nums leading-none" style={{ color: C.text }}>{value}</p>
          {trend && trend.pct > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium"
              style={{ color: trend.dir === 'up' ? C.ok : trend.dir === 'down' ? C.bad : C.textSec }}>
              {trend.dir === 'up'   && <ArrowUpRight   size={11} />}
              {trend.dir === 'down' && <ArrowDownRight size={11} />}
              {trend.pct}%
            </span>
          )}
        </div>
        {hint && <p className="text-[11.5px] mt-1.5" style={{ color: C.textTer }}>{hint}</p>}
      </div>
    </Card>
  );
  return to ? <Link to={to} className="block">{inner}</Link> : inner;
};

const QuickAction: React.FC<{ icon: any; label: string; desc: string; to: string }> = ({ icon: Icon, label, desc, to }) => (
  <Link to={to} className="block">
    <Card className="hover:border-white/[0.14] transition-colors group">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <Icon size={14} style={{ color: C.text }} />
          </div>
          <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: C.textSec }} />
        </div>
        <p className="text-[13px] font-semibold" style={{ color: C.text }}>{label}</p>
        <p className="text-[11.5px] mt-0.5" style={{ color: C.textTer }}>{desc}</p>
      </div>
    </Card>
  </Link>
);

// ── Main page ───────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const nav = useNavigate();
  const [data, setData]       = useState<D | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [busy, setBusy]       = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/admin/dashboard`, { headers: getH() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: D = await r.json();
      setData(d);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const toggleBot = async () => {
    if (!data) return;
    setBusy(true);
    const action = data.bot?.isActive ? 'stop' : 'start';
    try {
      const r = await fetch(`${API}/api/admin/bot/${action}`, {
        method: 'POST',
        headers: { ...getH(), 'Content-Type': 'application/json' },
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert(`Erreur ${r.status}: ${err.error || 'Échec'}`);
      }
    } catch (e: any) {
      alert(`Erreur réseau : ${e.message || 'inconnu'}`);
    }
    await load();
    setBusy(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <OrbsLoader size={120} fullscreen={false} />
    </div>
  );

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <AlertCircle className="w-9 h-9 mb-3" style={{ color: C.bad }} />
      <p className="text-sm" style={{ color: C.textSec }}>{error || 'Impossible de charger le dashboard'}</p>
      <button onClick={load} className="mt-4 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: C.accent, color: '#fff' }}>
        Réessayer
      </button>
    </div>
  );

  const d = data;
  const active = d.bot?.isActive ?? false;
  const quotaPct = d.bot?.callsQuota
    ? Math.min(100, Math.round(((d.bot?.callsToday ?? 0) / d.bot.callsQuota) * 100))
    : 0;

  return (
    <div className="space-y-8 max-w-[1200px]">

      {/* ─── Header ─── */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: C.text }}>Dashboard</h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: C.textSec }}>
            Vue d'ensemble de la plateforme · Mis à jour {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
                style={{ color: C.textSec }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </motion.div>

      {/* ─── Bot status card (compact, monochrome) ─── */}
      <Card>
        <div className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: 'rgba(255,255,255,0.06)' }}>
            <Bot size={18} style={{ color: C.text }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full"
                    style={{ background: active ? C.ok : C.textTer, animation: active ? 'pulse 1.4s ease infinite' : undefined }} />
              <span className="text-[13px] font-semibold" style={{ color: C.text }}>
                {active ? 'Bot actif' : 'Bot en pause'}
              </span>
              {active && d.bot?.nextAction && (
                <span className="text-[11px]" style={{ color: C.textTer }}>
                  · prochaine action dans {d.bot.nextAction.inMinutes < 60
                    ? `${d.bot.nextAction.inMinutes} min`
                    : `${Math.floor(d.bot.nextAction.inMinutes / 60)} h`}
                </span>
              )}
            </div>
            {active
              ? <p className="text-[11.5px] truncate" style={{ color: C.textSec }}>
                  {d.bot?.lastAction?.message || 'En attente…'}
                </p>
              : <p className="text-[11.5px]" style={{ color: C.textTer }}>Les jobs automatiques ne tournent pas</p>
            }
          </div>
          <button onClick={toggleBot} disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] font-medium transition-colors disabled:opacity-40"
            style={{
              background: active ? 'rgba(239,68,68,0.08)' : C.accent,
              color:      active ? C.bad               : '#fff',
              border:     active ? `1px solid rgba(239,68,68,0.25)` : 'none',
            }}>
            {busy ? '…' : active ? <><Pause size={12}/> Arrêter</> : <><Play size={12}/> Démarrer</>}
          </button>
        </div>
      </Card>

      {/* ─── KPI grid ─── */}
      <section>
        <SectionHead title="Aperçu" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon={Target}     label="Prospects"      value={d.prospects?.total ?? 0}
                hint={`+${d.prospects?.newThisMonth ?? 0} ce mois`} to="/admin/prospects" />
          <Stat icon={Users}      label="Clients actifs" value={d.clients?.totalActive ?? 0}
                hint={`+${d.clients?.newThisMonth ?? 0} ce mois`}   to="/admin/clients" />
          <Stat icon={DollarSign} label="MRR"            value={`${(d.revenue?.mrr ?? 0).toFixed(0)}€`}
                hint="Récurrent mensuel"                            to="/admin/billing" />
          <Stat icon={Phone}      label="Appels aujourd'hui"
                value={d.calls?.today ?? 0}
                hint={`Cette semaine : ${d.calls?.thisWeek ?? 0}`}   to="/admin/calls" />
        </div>
      </section>

      {/* ─── Quota + state card ─── */}
      <section>
        <SectionHead title="Quota du jour" />
        <Card>
          <div className="p-4">
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-[13px]" style={{ color: C.text }}>
                <span className="text-[20px] font-semibold tabular-nums">{d.bot?.callsToday ?? 0}</span>
                <span className="text-[13px]" style={{ color: C.textSec }}> / {d.bot?.callsQuota ?? 50} appels</span>
              </p>
              <span className="text-[11.5px] tabular-nums" style={{ color: C.textSec }}>{quotaPct}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="h-full rounded-full transition-all"
                   style={{
                     width: `${quotaPct}%`,
                     background: quotaPct > 90 ? C.bad : quotaPct > 70 ? C.warn : C.accent,
                   }} />
            </div>
          </div>
        </Card>
      </section>

      {/* ─── Recent activity ─── */}
      {(d.activity?.length ?? 0) > 0 && (
        <section>
          <SectionHead
            title="Activité récente"
            action={<Link to="/admin/logs" className="text-[11.5px] font-medium hover:underline" style={{ color: C.textSec }}>Tout voir →</Link>}
          />
          <Card>
            <div>
              {d.activity.slice(0, 6).map((a: any, i: number) => (
                <div key={i}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderTop: i > 0 ? `1px solid ${C.border}` : undefined }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <Activity size={12} style={{ color: C.textSec }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] truncate" style={{ color: C.text }}>
                      {a.description || a.message || a.type || '—'}
                    </p>
                  </div>
                  <span className="text-[11px] flex-shrink-0 tabular-nums" style={{ color: C.textTer }}>
                    {fmtRelative(a.createdAt || a.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* ─── Quick actions ─── */}
      <section>
        <SectionHead title="Accès rapide" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickAction icon={Target}       label="Prospects"    desc="Base et scoring"        to="/admin/prospects" />
          <QuickAction icon={Phone}        label="Appels"       desc="Journal et analyses"    to="/admin/calls" />
          <QuickAction icon={Zap}          label="Leads"        desc="Conversions récentes"   to="/admin/leads" />
          <QuickAction icon={CreditCard}   label="Facturation"  desc="Clients et MRR"         to="/admin/billing" />
        </div>
      </section>

      {/* ─── Management strip ─── */}
      <section>
        <SectionHead title="Gestion" />
        <Card>
          <Link to="/admin/ai-learning"
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors"
            style={{ borderBottom: `1px solid ${C.border}` }}>
            <Sparkles size={14} style={{ color: C.textSec }} />
            <div className="flex-1">
              <p className="text-[13px] font-medium" style={{ color: C.text }}>IA — apprentissage</p>
              <p className="text-[11.5px]" style={{ color: C.textTer }}>Scripts, variants A/B, décisions</p>
            </div>
            <ChevronRight size={14} style={{ color: C.textTer }} />
          </Link>
          <Link to="/admin/logs"
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors"
            style={{ borderBottom: `1px solid ${C.border}` }}>
            <BarChart3 size={14} style={{ color: C.textSec }} />
            <div className="flex-1">
              <p className="text-[13px] font-medium" style={{ color: C.text }}>Logs temps réel</p>
              <p className="text-[11.5px]" style={{ color: C.textTer }}>Événements serveur et crons</p>
            </div>
            <ChevronRight size={14} style={{ color: C.textTer }} />
          </Link>
          <button onClick={() => nav('/admin/settings')}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors text-left">
            <SettingsIcon size={14} style={{ color: C.textSec }} />
            <div className="flex-1">
              <p className="text-[13px] font-medium" style={{ color: C.text }}>Paramètres</p>
              <p className="text-[11.5px]" style={{ color: C.textTer }}>Général, système, campagnes, coûts</p>
            </div>
            <ChevronRight size={14} style={{ color: C.textTer }} />
          </button>
        </Card>
      </section>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }`}</style>
    </div>
  );
};

export default Dashboard;
