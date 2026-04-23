import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Phone, Users, Clock, TrendingUp, Pause, Play, AlertCircle,
  ArrowRight, ChevronRight, Shield, Activity, RefreshCw, HelpCircle,
  Bot, Zap, Calendar, PhoneIncoming, PhoneOutgoing, CheckCircle2,
  BarChart3, Headphones, Star, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import QwillioLoader from '../../components/QwillioLoader';
import { formatDuration, formatDateTime, formatShortDate, daysUntil } from '../../utils/format';
import OnboardingChecklist from '../../components/client/OnboardingChecklist';

function greeting(name: string) {
  const h = new Date().getHours();
  const first = name?.split(' ')[0] || name;
  if (h < 12) return `Bonjour, ${first}`;
  if (h < 18) return `Bon après-midi, ${first}`;
  return `Bonsoir, ${first}`;
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#22C55E',
  neutral: '#F59E0B',
  negative: '#EF4444',
};

const SENTIMENT_LABELS: Record<string, string> = {
  positive: 'Positif',
  neutral: 'Neutre',
  negative: 'Négatif',
};

export default function ClientOverview() {
  const { user, checkAuth } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const retryCount = useRef(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ov, an, cl] = await Promise.all([
        api.get('/my-dashboard/overview'),
        api.get('/my-dashboard/analytics?days=30').catch(() => ({ data: null })),
        api.get('/my-dashboard/calls?page=1&limit=8').catch(() => ({ data: { data: [] } })),
      ]);
      setData(ov.data);
      setAnalytics(an.data);
      setCalls(cl.data?.data || []);
      setPaymentPending(false);
      retryCount.current = 0;
      // Refresh auth store so onboardingCompleted / clientId are up-to-date
      checkAuth();
      // Clean up URL params
      if (searchParams.has('payment')) {
        searchParams.delete('payment');
        setSearchParams(searchParams, { replace: true });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Erreur de connexion';
      const status = err?.response?.status;
      if (status === 401) setError('Session expirée — reconnectez-vous.');
      else if (status === 403) setError('Accès refusé (rôle client requis).');
      else if (status === 404) {
        // If just came from Stripe payment, the webhook may not have fired yet — retry
        if (searchParams.get('payment') === 'success' && retryCount.current < 8) {
          retryCount.current++;
          setPaymentPending(true);
          setLoading(true);
          setTimeout(() => load(), 3000); // retry every 3s for up to ~24s
          return;
        }
        // No client profile — interceptor already redirects, but navigate as fallback
        navigate('/onboard');
        return;
      } else setError(msg);
    } finally { setLoading(false); }
  }, [searchParams]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async () => {
    if (!data?.client) return;
    const isActive = data.client.subscriptionStatus === 'active' || data.client.subscriptionStatus === 'trialing';
    setToggling(true);
    try {
      await api.post(`/my-dashboard/${isActive ? 'pause' : 'resume'}`);
      // Sync the top-bar AiStatusPill so everything updates together.
      window.dispatchEvent(new CustomEvent('ai-status-change'));
      await load();
    } catch { /* ignore */ }
    finally { setToggling(false); }
  };

  // Also refresh the local view if the pill in the top bar toggled.
  useEffect(() => {
    const h = () => { load(); };
    window.addEventListener('ai-status-change', h);
    return () => window.removeEventListener('ai-status-change', h);
  }, [load]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <QwillioLoader size={120} fullscreen={false} />
      {paymentPending && (
        <div className="text-center">
          <p className="text-sm font-medium text-[#F8F8FF]">Paiement reçu !</p>
          <p className="text-xs text-[#8B8BA7] mt-1">Activation de votre compte en cours...</p>
        </div>
      )}
    </div>
  );

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

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7 text-red-400" />
      </div>
      <h2 className="text-lg font-semibold text-[#F8F8FF] mb-1">Impossible de charger le dashboard</h2>
      <p className="text-sm text-[#8B8BA7] mb-6 max-w-xs">{error || 'Vérifiez votre connexion et réessayez.'}</p>
      <button onClick={() => { setLoading(true); setError(null); load(); }}
        className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#7B5CF0] rounded-xl hover:bg-[#6D4FE0] transition-colors">
        <RefreshCw className="w-4 h-4" /> Réessayer
      </button>
    </div>
  );

  const c = data.client || {};
  const isActive = c.subscriptionStatus === 'active' || c.subscriptionStatus === 'trialing';
  const isPaused = c.subscriptionStatus === 'paused';
  const sentTotal = (data.sentiment?.positive || 0) + (data.sentiment?.neutral || 0) + (data.sentiment?.negative || 0);
  const positiveRate = sentTotal > 0 ? Math.round((data.sentiment.positive / sentTotal) * 100) : 0;
  const convRate = (data.calls?.thisMonth || 0) > 0
    ? Math.round(((data.leads?.thisMonth || 0) / data.calls.thisMonth) * 100) : 0;

  const chartData = analytics?.daily?.map((d: any) => ({
    date: formatShortDate(d.date),
    Appels: d.calls,
    Leads: d.leads,
  })) || [];

  const quotaUsed = data.calls?.quotaUsed || 0;
  const quotaTotal = c.monthlyCallsQuota || data.calls?.quota || 0;
  const quotaPct = quotaTotal > 0 ? Math.round((quotaUsed / quotaTotal) * 100) : 0;

  const sentimentData = sentTotal > 0 ? [
    { name: 'Positif', value: data.sentiment.positive || 0 },
    { name: 'Neutre', value: data.sentiment.neutral || 0 },
    { name: 'Négatif', value: data.sentiment.negative || 0 },
  ].filter(s => s.value > 0) : [];

  return (
    <div className="space-y-5">
      {/* ── Header ── minimal Apple-style: greeting + date + refresh only.
           The Pause / Activer control lives in the top bar AI pill now. */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight text-[#F2F2F2]">{greeting(user?.name || 'Utilisateur')}</h1>
          <p className="text-[12.5px] text-[#9A9AA5] mt-0.5">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button onClick={() => { setLoading(true); load(); }}
          title="Rafraîchir"
          className="p-2 rounded-lg hover:bg-white/[0.06] text-[#9A9AA5] transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </motion.div>

      {/* ── Onboarding checklist (show only if not fully set up) ── */}
      {(() => {
        const onboardingClient = {
          hasPhone: !!(c.transferNumber || c.vapiPhoneNumber),
          hasTestCall: !!c.hasTestCall,
          hasCustomConfig: !!c.hasCustomConfig,
          isActive: isActive,
          transferNumber: c.transferNumber,
          vapiPhoneNumber: c.vapiPhoneNumber,
          subscriptionStatus: c.subscriptionStatus,
          businessName: c.businessName,
        };
        const allDone = onboardingClient.hasPhone && onboardingClient.hasTestCall && onboardingClient.hasCustomConfig && onboardingClient.isActive;
        return !allDone ? <OnboardingChecklist client={onboardingClient} /> : null;
      })()}

      {/* ── Banners ── */}
      {c.isTrial && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-3 bg-[#7B5CF0]/10 border border-[#7B5CF0]/20 rounded-2xl px-5 py-3.5">
          <Shield className="w-5 h-5 text-[#7B5CF0] flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[#F8F8FF]">Période d'essai — <strong>{daysUntil(c.trialEndDate)} jours restants</strong></p>
            <p className="text-xs text-[#8B8BA7]">Passez à un plan payant pour continuer</p>
          </div>
          <Link to="/dashboard/billing" className="flex items-center gap-1 text-sm font-semibold text-[#7B5CF0] hover:underline whitespace-nowrap">
            Mettre à jour <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      )}

      {!c.transferNumber && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300 flex-1">Numéro de transfert non configuré</p>
          <Link to="/dashboard/receptionist#transfer" className="text-sm font-medium text-red-400 hover:underline whitespace-nowrap">Configurer →</Link>
        </motion.div>
      )}

      {/* ── AI Status + Quota ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border p-5 ${isActive ? 'border-emerald-400/15 bg-emerald-400/[0.03]' : isPaused ? 'border-amber-400/15 bg-amber-400/[0.03]' : 'border-red-400/15 bg-red-400/[0.03]'}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive ? 'bg-emerald-400/10' : 'bg-amber-400/10'}`}>
              <Bot size={24} className={isActive ? 'text-emerald-400' : 'text-amber-400'} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className={`text-sm font-bold ${isActive ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isActive ? 'IA Active' : 'IA en pause'}
                </span>
              </div>
              <p className="text-xs text-[#8B8BA7]">
                {c.businessName || 'Votre entreprise'} · {c.vapiPhoneNumber || 'Numéro en attente'}
              </p>
            </div>
          </div>

          {/* Quota progress */}
          {quotaTotal > 0 && (
            <div className="flex-1 max-w-[280px] min-w-[200px]">
              <div className="flex justify-between text-[10px] text-[#8B8BA7] mb-1">
                <span>Quota mensuel</span>
                <span className="tabular-nums font-medium">{quotaUsed} / {quotaTotal} appels ({quotaPct}%)</span>
              </div>
              <div className="h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{
                  width: `${Math.min(quotaPct, 100)}%`,
                  background: quotaPct > 90 ? '#EF4444' : quotaPct > 70 ? '#F59E0B' : '#7B5CF0',
                }} />
              </div>
            </div>
          )}

          <div className="text-right">
            <p className="text-[10px] text-[#8B8BA7] uppercase">Plan</p>
            <p className="text-sm font-bold text-[#F8F8FF] capitalize">{c.planType || 'starter'}</p>
          </div>
        </div>
      </motion.div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Appels aujourd'hui",
            value: data.calls?.today || 0,
            sub: `${data.calls?.thisWeek || 0} cette semaine`,
            icon: PhoneIncoming, color: '#3B82F6', bg: 'bg-blue-500/10',
            trend: null,
          },
          {
            label: 'Appels ce mois',
            value: data.calls?.thisMonth || 0,
            sub: `${data.calls?.total || 0} au total`,
            icon: Phone, color: '#7B5CF0', bg: 'bg-[#7B5CF0]/10',
            trend: null,
          },
          {
            label: 'Leads capturés',
            value: data.leads?.thisMonth || 0,
            sub: `${convRate}% conversion`,
            icon: Star, color: '#F59E0B', bg: 'bg-amber-500/10',
            trend: convRate > 20 ? 'up' : convRate > 0 ? 'flat' : null,
          },
          {
            label: 'Durée moyenne',
            value: formatDuration(data.calls?.avgDuration),
            sub: `${positiveRate}% positif`,
            icon: Clock, color: '#22C55E', bg: 'bg-emerald-500/10',
            trend: null,
          },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.bg}`}>
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
              {kpi.trend === 'up' && <ArrowUpRight className="w-4 h-4 text-emerald-400" />}
            </div>
            <p className="text-2xl font-bold text-[#F8F8FF] tabular-nums">{kpi.value}</p>
            <p className="text-[11px] text-[#8B8BA7] mt-0.5">{kpi.label}</p>
            <p className="text-[10px] text-[#8B8BA7]/60 mt-0.5">{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Chart + Sentiment ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 30-day trend */}
        <div className="lg:col-span-2 rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#F8F8FF]">Tendance 30 jours</h3>
              <p className="text-[10px] text-[#8B8BA7]">Appels & leads par jour</p>
            </div>
            <Link to="/dashboard/analytics" className="flex items-center gap-1 text-xs text-[#7B5CF0] hover:underline">
              Détails <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="h-52">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7B5CF0" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#7B5CF0" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8B8BA7' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#8B8BA7' }} width={28} />
                  <Tooltip contentStyle={{ background: '#12121A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12, color: '#F8F8FF' }} />
                  <Area type="monotone" dataKey="Appels" stroke="#7B5CF0" fill="url(#gCalls)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Leads" stroke="#F59E0B" fill="url(#gLeads)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[#8B8BA7]">Pas encore de données</div>
            )}
          </div>
        </div>

        {/* Sentiment donut */}
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-[#F8F8FF] mb-1">Sentiment des appels</h3>
          <p className="text-[10px] text-[#8B8BA7] mb-3">{sentTotal} appels analysés</p>

          {sentimentData.length > 0 ? (
            <>
              <div className="flex justify-center mb-3">
                <div className="relative w-32 h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sentimentData} cx="50%" cy="50%" innerRadius={38} outerRadius={58}
                        paddingAngle={3} dataKey="value" stroke="none">
                        {sentimentData.map((entry, i) => (
                          <Cell key={i} fill={SENTIMENT_COLORS[entry.name === 'Positif' ? 'positive' : entry.name === 'Neutre' ? 'neutral' : 'negative']} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-xl font-bold text-[#F8F8FF]">{positiveRate}%</p>
                      <p className="text-[8px] text-[#8B8BA7]">positif</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                {(['positive', 'neutral', 'negative'] as const).map(key => {
                  const val = data.sentiment?.[key] || 0;
                  const pct = sentTotal > 0 ? Math.round((val / sentTotal) * 100) : 0;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SENTIMENT_COLORS[key] }} />
                      <span className="text-[11px] text-[#8B8BA7] flex-1">{SENTIMENT_LABELS[key]}</span>
                      <span className="text-[11px] font-semibold text-[#F8F8FF] tabular-nums">{val}</span>
                      <span className="text-[10px] text-[#8B8BA7] tabular-nums w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-sm text-[#8B8BA7]">Aucune donnée</div>
          )}
        </div>
      </div>

      {/* ── Recent calls ── */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#F8F8FF]">Appels récents</h3>
            <p className="text-[10px] text-[#8B8BA7]">Derniers appels reçus par l'IA</p>
          </div>
          <Link to="/dashboard/calls" className="flex items-center gap-1 text-xs text-[#7B5CF0] hover:underline">
            Voir tout <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {calls.length > 0 ? (
          <div className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="pb-2 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">Appelant</th>
                  <th className="pb-2 text-left text-[10px] text-[#8B8BA7] font-medium uppercase hidden sm:table-cell">Durée</th>
                  <th className="pb-2 text-left text-[10px] text-[#8B8BA7] font-medium uppercase hidden md:table-cell">Sentiment</th>
                  <th className="pb-2 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">Statut</th>
                  <th className="pb-2 text-right text-[10px] text-[#8B8BA7] font-medium uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call: any, i: number) => (
                  <motion.tr key={call.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => navigate('/dashboard/calls')}>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          call.isLead ? 'bg-[#7B5CF0]/10' : 'bg-white/[0.04]'
                        }`}>
                          <PhoneIncoming className={`w-3.5 h-3.5 ${call.isLead ? 'text-[#7B5CF0]' : 'text-[#8B8BA7]'}`} />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[#F8F8FF] truncate max-w-[140px]">
                            {call.callerName || call.callerNumber || 'Inconnu'}
                          </p>
                          {call.isLead && (
                            <span className="text-[9px] font-semibold text-[#7B5CF0] bg-[#7B5CF0]/10 px-1.5 py-0.5 rounded">LEAD</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 hidden sm:table-cell">
                      <span className="text-xs text-[#8B8BA7] tabular-nums">{formatDuration(call.durationSeconds)}</span>
                    </td>
                    <td className="py-2.5 hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: SENTIMENT_COLORS[call.sentiment] || '#8B8BA7' }} />
                        <span className="text-xs text-[#8B8BA7]">{SENTIMENT_LABELS[call.sentiment] || '—'}</span>
                      </div>
                    </td>
                    <td className="py-2.5">
                      {call.status === 'completed' ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle2 className="w-3 h-3" /> Terminé</span>
                      ) : (
                        <span className="text-[10px] text-[#8B8BA7]">{call.status || '—'}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="text-[11px] text-[#8B8BA7]">{formatDateTime(call.createdAt)}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Headphones className="w-8 h-8 text-[#8B8BA7]/40 mb-2" />
            <p className="text-sm text-[#8B8BA7]">Aucun appel récent</p>
            <p className="text-xs text-[#8B8BA7]/60 mt-0.5">Les appels apparaîtront ici automatiquement</p>
          </div>
        )}
      </div>

      {/* ── Quick links ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/dashboard/leads', icon: Users, label: 'Voir les leads', color: '#F59E0B', bg: 'bg-amber-500/10' },
          { to: '/dashboard/analytics', icon: BarChart3, label: 'Analytique', color: '#3B82F6', bg: 'bg-blue-500/10' },
          { to: '/dashboard/receptionist', icon: Bot, label: 'Configurer AI', color: '#7B5CF0', bg: 'bg-[#7B5CF0]/10' },
          { to: '/dashboard/billing', icon: Zap, label: 'Facturation', color: '#22C55E', bg: 'bg-emerald-500/10' },
        ].map((item, i) => (
          <Link key={i} to={item.to}
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[#12121A] border border-white/[0.06] hover:border-[#7B5CF0]/20 hover:bg-white/[0.03] transition-all group">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.bg}`}>
              <item.icon className="w-4 h-4" style={{ color: item.color }} />
            </div>
            <span className="text-sm font-medium text-[#8B8BA7] group-hover:text-[#F8F8FF] transition-colors">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
