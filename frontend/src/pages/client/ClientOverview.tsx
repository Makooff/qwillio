import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Phone, Users, Clock, TrendingUp, Pause, Play, AlertCircle,
  ArrowRight, ChevronRight, Shield, Activity, RefreshCw, HelpCircle,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import { formatDuration, formatDateTime, formatShortDate, daysUntil } from '../../utils/format';

function greeting(name: string) {
  const h = new Date().getHours();
  const first = name?.split(' ')[0] || name;
  if (h < 12) return `Bonjour, ${first}`;
  if (h < 18) return `Bon après-midi, ${first}`;
  return `Bonsoir, ${first}`;
}

const SENTIMENT_DOT: Record<string, string> = {
  positive: 'bg-emerald-500',
  neutral: 'bg-amber-500',
  negative: 'bg-red-500',
};

export default function ClientOverview() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ov, an, cl] = await Promise.all([
        api.get('/my-dashboard/overview'),
        api.get('/my-dashboard/analytics?days=30').catch(() => ({ data: null })),
        api.get('/my-dashboard/calls?page=1&limit=6').catch(() => ({ data: { data: [] } })),
      ]);
      setData(ov.data);
      setAnalytics(an.data);
      setCalls(cl.data?.data || []);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Erreur de connexion';
      const status = err?.response?.status;
      if (status === 401) setError('Session expirée — reconnectez-vous.');
      else if (status === 403) setError('Accès refusé (rôle client requis).');
      else if (status === 404) {
        // Not onboarded yet → redirect to complete setup
        if (!user?.onboardingCompleted) {
          navigate('/onboard');
          return;
        }
        setError('no-profile');
      } else setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async () => {
    if (!data?.client) return;
    const isActive = data.client.subscriptionStatus === 'active' || data.client.subscriptionStatus === 'trialing';
    setToggling(true);
    try {
      await api.post(`/my-dashboard/${isActive ? 'pause' : 'resume'}`);
      await load();
    } catch { /* ignore */ }
    finally { setToggling(false); }
  };

  /* ─── Loading ─── */
  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-2 border-[#7B5CF0] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  /* ─── Error: no profile (admin-created client not yet linked) ─── */
  if (error === 'no-profile') return (
    <div className="flex flex-col items-center justify-center py-32 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-[#7B5CF0]/10 flex items-center justify-center mb-4">
        <HelpCircle className="w-7 h-7 text-[#7B5CF0]" />
      </div>
      <h2 className="text-lg font-semibold text-[#F8F8FF] mb-2">Compte en cours de configuration</h2>
      <p className="text-sm text-[#8B8BA7] mb-6 max-w-xs leading-relaxed">
        Votre espace client est en cours d'activation. Contactez notre équipe si cela persiste plus de 24h.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link to="/dashboard/support"
          className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#7B5CF0] rounded-xl hover:bg-[#6D4FE0] transition-colors">
          <HelpCircle className="w-4 h-4" /> Contacter le support
        </Link>
        <button onClick={() => { setLoading(true); setError(null); load(); }}
          className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-[#8B8BA7] bg-white/[0.04] rounded-xl hover:bg-white/[0.08] transition-colors">
          <RefreshCw className="w-4 h-4" /> Réessayer
        </button>
      </div>
    </div>
  );

  /* ─── Error: other ─── */
  if (error || !data) return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7 text-red-400" />
      </div>
      <h2 className="text-lg font-semibold text-[#F8F8FF] mb-1">Impossible de charger le dashboard</h2>
      <p className="text-sm text-[#8B8BA7] mb-6 max-w-xs">{error || 'Vérifiez votre connexion et réessayez.'}</p>
      <button
        onClick={() => { setLoading(true); setError(null); load(); }}
        className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#7B5CF0] rounded-xl hover:bg-[#6D4FE0] transition-colors"
      >
        <RefreshCw className="w-4 h-4" /> Réessayer
      </button>
    </div>
  );

  const c = data.client || {};
  const isActive = c.subscriptionStatus === 'active' || c.subscriptionStatus === 'trialing';
  const sentimentTotal = (data.sentiment?.positive || 0) + (data.sentiment?.neutral || 0) + (data.sentiment?.negative || 0);
  const positiveRate = sentimentTotal > 0 ? Math.round((data.sentiment.positive / sentimentTotal) * 100) : 0;
  const conversionRate = (data.calls?.thisMonth || 0) > 0
    ? Math.round(((data.leads?.thisMonth || 0) / data.calls.thisMonth) * 100) : 0;

  const chartData = analytics?.daily?.map((d: any) => ({
    date: formatShortDate(d.date),
    Appels: d.calls,
    Leads: d.leads,
  })) || [];

  const KPIS = [
    {
      label: "Appels aujourd'hui",
      value: data.calls?.today || 0,
      sub: `${data.calls?.thisWeek || 0} cette semaine`,
      icon: Phone,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Appels ce mois',
      value: data.calls?.thisMonth || 0,
      sub: `${data.calls?.total || 0} au total`,
      icon: Activity,
      color: 'text-[#7B5CF0]',
      bg: 'bg-[#7B5CF0]/10',
    },
    {
      label: 'Leads capturés',
      value: data.leads?.thisMonth || 0,
      sub: `${conversionRate}% de conversion`,
      icon: Users,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Durée moyenne',
      value: formatDuration(data.calls?.avgDuration),
      sub: `${positiveRate}% sentiment positif`,
      icon: Clock,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">{greeting(user?.name || 'Utilisateur')}</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
              isActive
                ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
            }`}
          >
            {toggling
              ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : isActive ? <><Pause className="w-4 h-4" /> Pause AI</> : <><Play className="w-4 h-4" /> Activer AI</>
            }
          </button>
          <button
            onClick={() => { setLoading(true); load(); }}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7] hover:text-[#F8F8FF] transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* ── Banners ── */}
      {c.isTrial && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-3 bg-[#7B5CF0]/10 border border-[#7B5CF0]/20 rounded-2xl px-5 py-4"
        >
          <Shield className="w-5 h-5 text-[#7B5CF0] flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[#F8F8FF]">Période d'essai — <strong>{daysUntil(c.trialEndDate)} jours restants</strong></p>
            <p className="text-xs text-[#8B8BA7]">Passez à un plan payant pour continuer après l'essai</p>
          </div>
          <Link to="/dashboard/billing" className="flex items-center gap-1 text-sm font-semibold text-[#7B5CF0] hover:underline whitespace-nowrap">
            Mettre à jour <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      )}

      {!c.transferNumber && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4"
        >
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300 flex-1">Numéro de transfert non configuré — les appels urgents ne peuvent pas être redirigés.</p>
          <Link to="/dashboard/receptionist" className="text-sm font-medium text-red-400 hover:underline whitespace-nowrap">Configurer →</Link>
        </motion.div>
      )}

      {/* ── Status card ── */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5 flex items-center gap-4">
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={isActive ? { boxShadow: '0 0 8px #10b981' } : {}} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#F8F8FF]">
            IA Réceptionniste — {isActive ? 'Active' : 'En pause'}
          </p>
          <p className="text-xs text-[#8B8BA7]">
            {c.vapiPhoneNumber ? `Numéro : ${c.vapiPhoneNumber}` : 'Aucun numéro assigné'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#8B8BA7]">Plan</p>
          <p className="text-sm font-semibold text-[#F8F8FF] capitalize">{c.planType || 'Starter'}</p>
        </div>
        {(c.monthlyCallsQuota || 0) > 0 && (
          <div className="text-right min-w-[80px]">
            <p className="text-xs text-[#8B8BA7]">Quota</p>
            <p className="text-sm font-semibold text-[#F8F8FF]">{data.calls?.quotaUsed || 0}/{c.monthlyCallsQuota}</p>
            <div className="h-1.5 bg-white/[0.08] rounded-full mt-1 w-20">
              <div
                className={`h-full rounded-full ${(data.calls?.quotaPercent || 0) > 90 ? 'bg-red-500' : 'bg-[#7B5CF0]'}`}
                style={{ width: `${Math.min(data.calls?.quotaPercent || 0, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${kpi.bg}`}>
              <kpi.icon className={`w-[18px] h-[18px] ${kpi.color}`} />
            </div>
            <p className="text-2xl font-bold text-[#F8F8FF]">{kpi.value}</p>
            <p className="text-xs text-[#8B8BA7] mt-1">{kpi.label}</p>
            <p className="text-[10px] text-[#8B8BA7]/60 mt-0.5">{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Chart + recent calls ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* 30-day trend */}
        <div className="lg:col-span-3 rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#F8F8FF]">Tendance 30 jours</h3>
              <p className="text-xs text-[#8B8BA7]">Appels & leads</p>
            </div>
            <TrendingUp className="w-4 h-4 text-[#8B8BA7]" />
          </div>
          <div className="h-48">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7B5CF0" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#7B5CF0" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8B8BA7' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#8B8BA7' }} width={28} />
                  <Tooltip
                    contentStyle={{ background: '#12121A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12, color: '#F8F8FF' }}
                  />
                  <Area type="monotone" dataKey="Appels" stroke="#7B5CF0" fill="url(#gCalls)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Leads" stroke="#f59e0b" fill="url(#gLeads)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[#8B8BA7]">Pas encore de données</div>
            )}
          </div>
        </div>

        {/* Recent calls */}
        <div className="lg:col-span-2 rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#F8F8FF]">Appels récents</h3>
            <Link to="/dashboard/calls" className="text-xs text-[#7B5CF0] hover:underline flex items-center gap-1">
              Tous <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {calls.length > 0 ? calls.map((call: any) => (
              <div key={call.id} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-white/[0.04] transition-colors">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${SENTIMENT_DOT[call.sentiment] || 'bg-[#8B8BA7]'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#F8F8FF] truncate">
                    {call.callerName || call.callerNumber || 'Inconnu'}
                    {call.isLead && <span className="ml-1 text-[#7B5CF0] text-[10px]">LEAD</span>}
                  </p>
                  <p className="text-[10px] text-[#8B8BA7]">{formatDuration(call.durationSeconds)}</p>
                </div>
                <p className="text-[10px] text-[#8B8BA7] flex-shrink-0">{formatDateTime(call.createdAt)}</p>
              </div>
            )) : (
              <p className="text-sm text-[#8B8BA7] text-center py-8">Aucun appel récent</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick links ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/dashboard/leads', icon: Users, label: 'Voir les leads', color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { to: '/dashboard/analytics', icon: TrendingUp, label: 'Analytique', color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { to: '/dashboard/receptionist', icon: Phone, label: 'Configurer AI', color: 'text-[#7B5CF0]', bg: 'bg-[#7B5CF0]/10' },
          { to: '/dashboard/billing', icon: Activity, label: 'Facturation', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        ].map((item, i) => (
          <Link key={i} to={item.to}
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[#12121A] border border-white/[0.06] hover:border-[#7B5CF0]/20 hover:bg-white/[0.04] transition-all group"
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${item.bg}`}>
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </div>
            <span className="text-sm font-medium text-[#8B8BA7] group-hover:text-[#F8F8FF] transition-colors">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
