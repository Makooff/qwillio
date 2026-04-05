import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { DashboardStats, BotStatus } from '../types';
import {
  Users, Building2, Phone, PhoneCall, Mail, Search, Star,
  RefreshCw, Loader2, Activity,
} from 'lucide-react';

type TriggerKey = 'prospecting' | 'scoring' | 'calling' | 'followup';

interface FeedItem {
  icon: string;
  message: string;
  date: string;
  type: string;
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return 'Jamais';
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [triggering, setTriggering] = useState<TriggerKey | null>(null);
  const [triggerFeedback, setTriggerFeedback] = useState<Record<TriggerKey, string | null>>({
    prospecting: null, scoring: null, calling: null, followup: null,
  });

  const fetchData = useCallback(async () => {
    const [statsRes, botRes, feedRes] = await Promise.allSettled([
      api.get('/dashboard/stats'),
      api.get('/bot/status'),
      api.get('/admin/activity-feed'),
    ]);
    if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
    if (botRes.status === 'fulfilled') setBotStatus(botRes.value.data);
    if (feedRes.status === 'fulfilled') setFeed(feedRes.value.data);
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
      await api.post(botStatus?.isActive ? '/bot/stop' : '/bot/start');
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
      setTriggerFeedback(prev => ({ ...prev, [key]: data.message || 'Terminé' }));
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
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 rounded-full border-2 border-transparent border-t-violet-600 border-r-violet-600 animate-spin" />
      </div>
    );
  }

  const isActive = botStatus?.isActive ?? false;
  const callsToday = botStatus?.callsToday ?? stats?.calls.today ?? 0;
  const callsQuota = botStatus?.callsQuotaDaily ?? 50;

  const services = [
    {
      key: 'prospecting' as TriggerKey,
      icon: <Search className="w-4 h-4" />,
      color: '#7C3AED',
      label: 'Prospection (Apify)',
      cronKey: 'apifyScraping',
      lastRun: (botStatus as any)?.lastRunProspecting ?? botStatus?.lastProspection,
      stat: `${(botStatus as any)?.prospectsFound ?? 0} trouvés`,
    },
    {
      key: 'scoring' as TriggerKey,
      icon: <Star className="w-4 h-4" />,
      color: '#F59E0B',
      label: 'Scoring des leads',
      cronKey: 'rescoreProspects',
      lastRun: (botStatus as any)?.lastRunScoring,
      stat: null,
    },
    {
      key: 'calling' as TriggerKey,
      icon: <PhoneCall className="w-4 h-4" />,
      color: '#10B981',
      label: 'Appels sortants (VAPI)',
      cronKey: 'outboundEngine',
      lastRun: (botStatus as any)?.lastRunCalling ?? botStatus?.lastCall,
      stat: `${callsToday}/${callsQuota} appels`,
    },
    {
      key: 'followup' as TriggerKey,
      icon: <Mail className="w-4 h-4" />,
      color: '#06B6D4',
      label: 'Séquences de suivi',
      cronKey: 'followUpSequences',
      lastRun: (botStatus as any)?.lastRunFollowUp,
      stat: `${(botStatus as any)?.followUpsSent ?? 0} envoyés`,
    },
  ];

  return (
    <div className="space-y-5">

      {/* 1 — Bot Status Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleBot}
              disabled={toggling}
              className="relative flex items-center focus:outline-none disabled:opacity-60 flex-shrink-0"
              style={{ width: 56, height: 28 }}
              aria-label="Toggle bot"
            >
              <div
                className="w-full h-full rounded-full transition-all duration-300"
                style={{
                  background: isActive ? '#7C3AED' : '#E5E7EB',
                  boxShadow: isActive ? '0 0 16px rgba(124,58,237,0.4)' : 'none',
                }}
              />
              {toggling ? (
                <Loader2
                  className="absolute w-4 h-4 animate-spin"
                  style={{ color: '#fff', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}
                />
              ) : (
                <div
                  className="absolute w-5 h-5 rounded-full bg-white shadow transition-all duration-300"
                  style={{ left: isActive ? 'calc(100% - 22px)' : '3px', top: '50%', transform: 'translateY(-50%)' }}
                />
              )}
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">
                  Bot {isActive ? 'Actif' : 'Inactif'}
                </h2>
                {isActive && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-500 border border-red-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {isActive ? 'Pipeline actif · Tous les crons sont en cours' : 'Bot arrêté · Aucun cron actif'}
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-3xl font-black text-gray-900">{callsToday}</p>
            <p className="text-xs text-gray-400">appels aujourd'hui</p>
          </div>
        </div>
      </div>

      {/* 2 — 4 KPI Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: <Users className="w-4 h-4" />,
            color: '#7C3AED', bg: '#F5F3FF',
            value: stats?.prospects.total ?? 0,
            label: 'Prospects',
            sub: stats?.prospects.newThisMonth ? `+${stats.prospects.newThisMonth} ce mois` : 'aucun ce mois',
          },
          {
            icon: <Phone className="w-4 h-4" />,
            color: '#10B981', bg: '#ECFDF5',
            value: callsToday,
            label: "Appels aujourd'hui",
            sub: `quota: ${callsQuota}`,
          },
          {
            icon: <Building2 className="w-4 h-4" />,
            color: '#F59E0B', bg: '#FFFBEB',
            value: stats?.clients.totalActive ?? 0,
            label: 'Clients actifs',
            sub: stats?.clients.newThisMonth ? `+${stats.clients.newThisMonth} ce mois` : 'aucun ce mois',
          },
          {
            icon: <Activity className="w-4 h-4" />,
            color: '#06B6D4', bg: '#ECFEFF',
            value: `${(stats?.calls.successRate ?? 0).toFixed(0)}%`,
            label: 'Taux réponse',
            sub: `${stats?.calls.thisWeek ?? 0} cette semaine`,
          },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="inline-flex p-2 rounded-xl mb-3" style={{ background: card.bg, color: card.color }}>
              {card.icon}
            </div>
            <p className="text-2xl font-black text-gray-900">{card.value}</p>
            <p className="text-sm font-medium text-gray-700 mt-0.5">{card.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* 3 — Bot Services */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Services du bot</h3>
        <div className="space-y-2">
          {services.map(svc => {
            const cronStatus = (botStatus as any)?.crons?.[svc.cronKey];
            const isRunning = triggering === svc.key;
            const feedback = triggerFeedback[svc.key];
            const isOn = cronStatus === 'active';

            return (
              <div
                key={svc.key}
                className="flex items-center justify-between rounded-xl px-4 py-3 bg-gray-50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${isOn ? 'animate-pulse' : ''}`}
                    style={{ background: isOn ? '#10B981' : '#D1D5DB' }}
                  />
                  <div
                    className="p-1.5 rounded-lg flex-shrink-0"
                    style={{ background: `${svc.color}18`, color: svc.color }}
                  >
                    {svc.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{svc.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
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
                  className="ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 shrink-0 bg-white"
                  style={{ color: svc.color, border: `1px solid ${svc.color}40` }}
                >
                  {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {isRunning ? 'Running…' : 'Run'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4 — Activity Feed */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-sm font-semibold text-gray-900">Activité en direct</h3>
          <span className="ml-auto text-xs text-gray-400">Mise à jour toutes les 30s</span>
        </div>
        {feed.length === 0 ? (
          <p className="text-center py-10 text-sm text-gray-400">
            Aucune activité récente. Démarrez le bot pour commencer&nbsp;!
          </p>
        ) : (
          <div className="space-y-1">
            {feed.slice(0, 10).map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-default"
              >
                <span className="text-lg w-7 text-center flex-shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{item.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(item.date).toLocaleString('fr-FR')}
                  </p>
                </div>
                {i === 0 && (
                  <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold bg-violet-50 text-violet-600">
                    nouveau
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
