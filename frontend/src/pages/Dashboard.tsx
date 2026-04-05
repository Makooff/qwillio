import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { DashboardStats, BotStatus } from '../types';
import {
  Users, Building2, TrendingUp, Phone, Play, Square,
  ArrowUp, Search, Star, PhoneCall, Mail, RefreshCw, Loader2,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type TriggerKey = 'prospecting' | 'scoring' | 'calling' | 'followup';

function formatTime(iso: string | null | undefined) {
  if (!iso) return 'Jamais';
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${active ? 'animate-pulse' : ''}`}
      style={{ background: active ? '#10B981' : 'rgba(255,255,255,0.2)' }}
    />
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [revenueHistory, setRevenueHistory] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [triggering, setTriggering] = useState<TriggerKey | null>(null);
  const [triggerFeedback, setTriggerFeedback] = useState<Record<TriggerKey, string | null>>({
    prospecting: null, scoring: null, calling: null, followup: null,
  });

  const fetchData = useCallback(async () => {
    const [statsRes, botRes, revenueRes, activityRes] = await Promise.allSettled([
      api.get('/dashboard/stats'),
      api.get('/bot/status'),
      api.get('/dashboard/revenue-history'),
      api.get('/dashboard/activity'),
    ]);

    if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
    if (botRes.status === 'fulfilled') setBotStatus(botRes.value.data);
    if (revenueRes.status === 'fulfilled') setRevenueHistory(revenueRes.value.data);
    if (activityRes.status === 'fulfilled') setActivity(activityRes.value.data);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const toggleBot = async () => {
    setToggling(true);
    try {
      if (botStatus?.isActive) {
        await api.post('/bot/stop');
      } else {
        await api.post('/bot/start');
      }
      const { data } = await api.get('/bot/status');
      setBotStatus(data);
    } catch (error) {
      console.error('Failed to toggle bot:', error);
    } finally {
      setToggling(false);
    }
  };

  const runTrigger = async (key: TriggerKey) => {
    setTriggering(key);
    setTriggerFeedback(prev => ({ ...prev, [key]: null }));
    try {
      const { data } = await api.post(`/bot/run/${key}`);
      const msg = data.message || 'Terminé';
      setTriggerFeedback(prev => ({ ...prev, [key]: msg }));
      const { data: newStatus } = await api.get('/bot/status');
      setBotStatus(newStatus);
    } catch (error: any) {
      setTriggerFeedback(prev => ({ ...prev, [key]: `Erreur: ${error?.response?.data?.error || error.message}` }));
    } finally {
      setTriggering(null);
      setTimeout(() => setTriggerFeedback(prev => ({ ...prev, [key]: null })), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" style={{ background: '#0A0A0F' }}>
        <div
          className="w-12 h-12 rounded-full border-2 border-transparent animate-spin"
          style={{ borderTopColor: '#7C3AED', borderRightColor: '#06B6D4' }}
        />
      </div>
    );
  }

  const isActive = botStatus?.isActive ?? false;

  const services = [
    {
      key: 'prospecting' as TriggerKey,
      icon: <Search className="w-4 h-4" />,
      iconColor: '#06B6D4',
      iconBg: 'rgba(6,182,212,0.15)',
      label: 'Prospection (Apify)',
      cronKey: 'apifyScraping',
      lastRun: botStatus?.lastRunProspecting ?? botStatus?.lastProspection,
      stat: `${botStatus?.prospectsFound ?? 0} trouvés aujourd'hui`,
    },
    {
      key: 'scoring' as TriggerKey,
      icon: <Star className="w-4 h-4" />,
      iconColor: '#F59E0B',
      iconBg: 'rgba(245,158,11,0.15)',
      label: 'Scoring des leads',
      cronKey: 'rescoreProspects',
      lastRun: botStatus?.lastRunScoring,
      stat: null,
    },
    {
      key: 'calling' as TriggerKey,
      icon: <PhoneCall className="w-4 h-4" />,
      iconColor: '#7C3AED',
      iconBg: 'rgba(124,58,237,0.15)',
      label: 'Appels sortants (VAPI)',
      cronKey: 'outboundEngine',
      lastRun: botStatus?.lastRunCalling ?? botStatus?.lastCall,
      stat: `${botStatus?.callsToday ?? 0}/${botStatus?.callsQuotaDaily ?? 50} appels`,
    },
    {
      key: 'followup' as TriggerKey,
      icon: <Mail className="w-4 h-4" />,
      iconColor: '#10B981',
      iconBg: 'rgba(16,185,129,0.15)',
      label: 'Séquences de suivi',
      cronKey: 'followUpSequences',
      lastRun: botStatus?.lastRunFollowUp,
      stat: `${botStatus?.followUpsSent ?? 0} envoyés aujourd'hui`,
    },
  ];

  return (
    <div className="space-y-5 p-4 md:p-6" style={{ background: '#0A0A0F', minHeight: '100vh' }}>

      {/* ── Bot Control Hero ──────────────────────────────── */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(6,182,212,0.08) 100%)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Ambient glow */}
        <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'rgba(124,58,237,0.12)', filter: 'blur(48px)' }} />
        <div className="absolute -bottom-12 -right-12 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'rgba(6,182,212,0.08)', filter: 'blur(48px)' }} />

        <div className="relative">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              {/* Pill toggle */}
              <button
                onClick={toggleBot}
                disabled={toggling}
                className="relative flex items-center transition-all duration-300 focus:outline-none disabled:opacity-60"
                style={{ width: 64, height: 32 }}
                aria-label="Toggle bot"
              >
                <div
                  className="w-full h-full rounded-full transition-all duration-300"
                  style={{
                    background: isActive
                      ? 'linear-gradient(90deg, #7C3AED, #06B6D4)'
                      : 'rgba(255,255,255,0.08)',
                    boxShadow: isActive ? '0 0 20px rgba(124,58,237,0.45)' : 'none',
                  }}
                />
                {toggling ? (
                  <Loader2
                    className="absolute w-4 h-4 animate-spin text-white"
                    style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                  />
                ) : (
                  <div
                    className="absolute w-6 h-6 rounded-full bg-white shadow-lg transition-all duration-300"
                    style={{
                      left: isActive ? 'calc(100% - 28px)' : '4px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                    }}
                  />
                )}
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">Bot Control Panel</h2>
                  {isActive && (
                    <span
                      className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-widest"
                      style={{
                        background: 'rgba(239,68,68,0.15)',
                        color: '#EF4444',
                        border: '1px solid rgba(239,68,68,0.25)',
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      LIVE
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {isActive ? 'Pipeline actif · Tous les crons sont en cours' : 'Bot arrêté · Aucun cron actif'}
                </p>
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-black text-white leading-none">{botStatus?.callsToday ?? 0}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Appels</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-white leading-none">{botStatus?.prospectsFound ?? 0}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Prospects</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-white leading-none">{botStatus?.followUpsSent ?? 0}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Suivis</p>
              </div>
            </div>
          </div>

          {/* Service rows */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {services.map(svc => {
              const cronStatus = botStatus?.crons?.[svc.cronKey];
              const isRunning = triggering === svc.key;
              const feedback = triggerFeedback[svc.key];

              return (
                <div
                  key={svc.key}
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{
                    background: '#12121A',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusDot active={cronStatus === 'active'} />
                    <div
                      className="p-1.5 rounded-lg flex-shrink-0"
                      style={{ background: svc.iconBg, color: svc.iconColor }}
                    >
                      {svc.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{svc.label}</p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {feedback ? (
                          <span style={{ color: feedback.startsWith('Erreur') ? '#EF4444' : '#10B981' }}>
                            {feedback}
                          </span>
                        ) : (
                          <>Dernier: {formatTime(svc.lastRun)}{svc.stat ? ` · ${svc.stat}` : ''}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => runTrigger(svc.key)}
                    disabled={isRunning || triggering !== null}
                    className="ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 shrink-0"
                    style={{
                      border: '1px solid rgba(124,58,237,0.4)',
                      color: '#7C3AED',
                      background: isRunning ? 'rgba(124,58,237,0.15)' : 'transparent',
                    }}
                    onMouseEnter={e => {
                      if (!isRunning && triggering === null) {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.2)';
                      }
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = isRunning ? 'rgba(124,58,237,0.15)' : 'transparent';
                    }}
                  >
                    {isRunning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    {isRunning ? 'Running…' : 'Run'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: <Users className="w-3.5 h-3.5" />,
            iconColor: '#7C3AED', iconBg: 'rgba(124,58,237,0.15)',
            value: stats?.prospects.total || 0,
            trend: `+${stats?.prospects.newThisMonth || 0}`,
            label: 'Prospects', sublabel: 'ce mois',
            large: false,
          },
          {
            icon: <Phone className="w-3.5 h-3.5" />,
            iconColor: '#06B6D4', iconBg: 'rgba(6,182,212,0.15)',
            value: stats?.calls.today || 0,
            trend: `${stats?.calls.successRate?.toFixed(0) || 0}%`,
            label: 'Appels', sublabel: "aujourd'hui",
            large: false,
          },
          {
            icon: <Building2 className="w-3.5 h-3.5" />,
            iconColor: '#10B981', iconBg: 'rgba(16,185,129,0.15)',
            value: stats?.clients.totalActive || 0,
            trend: `+${stats?.clients.newThisMonth || 0}`,
            label: 'Clients', sublabel: 'actifs',
            large: false,
          },
          {
            icon: <TrendingUp className="w-3.5 h-3.5" />,
            iconColor: '#7C3AED', iconBg: 'rgba(124,58,237,0.15)',
            value: `${(stats?.revenue.mrr || 0).toLocaleString('fr-FR')}€`,
            trend: null,
            label: 'MRR', sublabel: 'mensuel',
            large: true,
          },
        ].map((card, i) => (
          <div
            key={i}
            className="rounded-2xl p-5 transition-all duration-300 cursor-default"
            style={{ background: '#12121A', border: '1px solid rgba(255,255,255,0.05)' }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 24px rgba(124,58,237,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            <div className="flex items-center gap-1.5 mb-3">
              <div className="p-1.5 rounded-lg" style={{ background: card.iconBg, color: card.iconColor }}>
                {card.icon}
              </div>
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{card.label}</span>
            </div>
            <div className="flex items-end gap-2">
              <p className="font-black text-white leading-none" style={{ fontSize: card.large ? 26 : 30 }}>
                {card.value}
              </p>
              {card.trend && (
                <span className="flex items-center gap-0.5 text-xs font-bold mb-0.5" style={{ color: '#10B981' }}>
                  <ArrowUp className="w-3 h-3" />{card.trend}
                </span>
              )}
            </div>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>{card.sublabel}</p>
          </div>
        ))}
      </div>

      {/* ── Charts ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div
          className="rounded-2xl p-6 col-span-1 lg:col-span-2"
          style={{ background: '#12121A', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold text-white">Revenue</h3>
            <span
              className="text-xs font-medium px-3 py-1 rounded-full"
              style={{ background: 'rgba(124,58,237,0.15)', color: '#7C3AED' }}
            >
              12 mois
            </span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueHistory}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: any) => [`${value}€`, 'Revenue']}
                  contentStyle={{
                    background: '#1A1A27',
                    border: '1px solid rgba(124,58,237,0.3)',
                    borderRadius: 12,
                    color: '#fff',
                    fontSize: 13,
                  }}
                  cursor={{ stroke: 'rgba(124,58,237,0.3)', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#7C3AED" fill="url(#colorRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl p-6" style={{ background: '#12121A', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="text-base font-bold text-white mb-6">Conversion</h3>
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Prospect → Client</span>
                <span className="font-bold text-white">{(stats?.conversion.prospectToClient || 0).toFixed(1)}%</span>
              </div>
              <div className="w-full rounded-full h-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.min(stats?.conversion.prospectToClient || 0, 100)}%`,
                    background: 'linear-gradient(90deg, #7C3AED, #06B6D4)',
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Devis Acceptés</span>
                <span className="font-bold text-white">{(stats?.conversion.quoteAcceptanceRate || 0).toFixed(1)}%</span>
              </div>
              <div className="w-full rounded-full h-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.min(stats?.conversion.quoteAcceptanceRate || 0, 100)}%`,
                    background: 'linear-gradient(90deg, #10B981, #06B6D4)',
                  }}
                />
              </div>
            </div>
            <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Setup fees ce mois</p>
              <p className="text-2xl font-black text-white mt-1">
                {(stats?.revenue.setupFeesThisMonth || 0).toLocaleString('fr-FR')}€
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Revenu total ce mois</p>
              <p className="text-2xl font-black mt-1" style={{ color: '#10B981' }}>
                {(stats?.revenue.totalThisMonth || 0).toLocaleString('fr-FR')}€
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Activity Feed ──────────────────────────────────── */}
      <div className="rounded-2xl p-6" style={{ background: '#12121A', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 className="text-base font-bold text-white mb-5">Activité Récente</h3>
        <div className="space-y-1">
          {activity.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Aucune activité récente. Démarrez le bot pour commencer&nbsp;!
            </p>
          ) : (
            activity.slice(0, 10).map((item: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 cursor-default"
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="text-lg w-7 text-center flex-shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{item.message}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {new Date(item.date).toLocaleString('fr-FR')}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
