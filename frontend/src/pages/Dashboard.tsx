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
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
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
    // Each call is independent — one failure should not crash the page
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
      // Refresh bot status to update timestamps
      const { data: newStatus } = await api.get('/bot/status');
      setBotStatus(newStatus);
    } catch (error: any) {
      setTriggerFeedback(prev => ({ ...prev, [key]: `Erreur: ${error?.response?.data?.error || error.message}` }));
    } finally {
      setTriggering(null);
      // Clear feedback after 5s
      setTimeout(() => setTriggerFeedback(prev => ({ ...prev, [key]: null })), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  const isActive = botStatus?.isActive ?? false;

  const services = [
    {
      key: 'prospecting' as TriggerKey,
      icon: <Search className="w-4 h-4" />,
      label: 'Prospection (Apify)',
      cronKey: 'apifyScraping',
      lastRun: botStatus?.lastRunProspecting ?? botStatus?.lastProspection,
      stat: `${botStatus?.prospectsFound ?? 0} trouvés aujourd'hui`,
    },
    {
      key: 'scoring' as TriggerKey,
      icon: <Star className="w-4 h-4" />,
      label: 'Scoring des leads',
      cronKey: 'rescoreProspects',
      lastRun: botStatus?.lastRunScoring,
      stat: null,
    },
    {
      key: 'calling' as TriggerKey,
      icon: <PhoneCall className="w-4 h-4" />,
      label: 'Appels sortants (VAPI)',
      cronKey: 'outboundEngine',
      lastRun: botStatus?.lastRunCalling ?? botStatus?.lastCall,
      stat: `${botStatus?.callsToday ?? 0}/${botStatus?.callsQuotaDaily ?? 50} appels`,
    },
    {
      key: 'followup' as TriggerKey,
      icon: <Mail className="w-4 h-4" />,
      label: 'Séquences de suivi',
      cronKey: 'followUpSequences',
      lastRun: botStatus?.lastRunFollowUp,
      stat: `${botStatus?.followUpsSent ?? 0} envoyés aujourd'hui`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Bot Control Panel ──────────────────────────────── */}
      <div className={`rounded-2xl border-2 p-6 transition-all ${
        isActive
          ? 'bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200'
          : 'bg-gray-50 border-gray-200'
      }`}>
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full transition-all ${
              isActive ? 'bg-emerald-500 animate-pulse shadow-lg shadow-emerald-200' : 'bg-gray-400'
            }`} />
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Bot Control Panel
              </h2>
              <p className="text-sm text-gray-500">
                {isActive ? 'Pipeline actif · Tous les crons sont en cours' : 'Bot arrêté · Aucun cron actif'}
              </p>
            </div>
          </div>

          {/* Big ON/OFF toggle */}
          <button
            onClick={toggleBot}
            disabled={toggling}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-md disabled:opacity-60 ${
              isActive
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-200'
                : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-violet-200'
            }`}
          >
            {toggling ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isActive ? (
              <Square className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
            {toggling ? 'En cours...' : isActive ? 'Arrêter le bot' : 'Démarrer le bot'}
          </button>
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
                className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusDot active={cronStatus === 'active'} />
                  <div className="text-gray-500">{svc.icon}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{svc.label}</p>
                    <p className="text-xs text-gray-400">
                      {feedback ? (
                        <span className={feedback.startsWith('Erreur') ? 'text-red-500' : 'text-emerald-600'}>
                          {feedback}
                        </span>
                      ) : (
                        <>
                          Dernier: {formatTime(svc.lastRun)}
                          {svc.stat ? ` · ${svc.stat}` : ''}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => runTrigger(svc.key)}
                  disabled={isRunning || triggering !== null}
                  className="ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors shrink-0"
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

        {/* Quick stats footer */}
        <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{botStatus?.callsToday ?? 0}</p>
            <p className="text-xs text-gray-500">Appels aujourd'hui</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{botStatus?.prospectsFound ?? 0}</p>
            <p className="text-xs text-gray-500">Prospects trouvés</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{botStatus?.followUpsSent ?? 0}</p>
            <p className="text-xs text-gray-500">Suivis envoyés</p>
          </div>
        </div>
      </div>

      {/* ── Page header ────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de Bord</h1>
          <p className="text-gray-500">Qwillio overview</p>
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg"><Users className="w-5 h-5 text-blue-600" /></div>
            <span className="badge badge-new flex items-center gap-1"><ArrowUp className="w-3 h-3" />+{stats?.prospects.newThisMonth || 0}</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats?.prospects.total || 0}</p>
          <p className="text-sm text-gray-500 mt-1">Prospects</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-100 rounded-lg"><Building2 className="w-5 h-5 text-emerald-600" /></div>
            <span className="badge badge-active flex items-center gap-1"><ArrowUp className="w-3 h-3" />+{stats?.clients.newThisMonth || 0}</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats?.clients.totalActive || 0}</p>
          <p className="text-sm text-gray-500 mt-1">Clients Actifs</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg"><TrendingUp className="w-5 h-5 text-purple-600" /></div>
            <span className="badge bg-purple-100 text-purple-700">MRR</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{(stats?.revenue.mrr || 0).toLocaleString('fr-FR')}€</p>
          <p className="text-sm text-gray-500 mt-1">MRR</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-100 rounded-lg"><Phone className="w-5 h-5 text-orange-600" /></div>
            <span className="text-sm text-gray-500">{stats?.calls.successRate?.toFixed(0) || 0}%</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats?.calls.today || 0}</p>
          <p className="text-sm text-gray-500 mt-1">Appels Aujourd'hui</p>
        </div>
      </div>

      {/* ── Charts ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueHistory}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#667eea" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#667eea" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: any) => `${value}€`} />
                <Area type="monotone" dataKey="revenue" stroke="#667eea" fill="url(#colorRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Taux de Conversion</h3>
          <div className="space-y-6 mt-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Prospect → Client</span>
                <span className="font-semibold">{(stats?.conversion.prospectToClient || 0).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div className="bg-gradient-to-r from-primary-500 to-purple-500 h-3 rounded-full" style={{ width: `${Math.min(stats?.conversion.prospectToClient || 0, 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Devis Acceptés</span>
                <span className="font-semibold">{(stats?.conversion.quoteAcceptanceRate || 0).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-3 rounded-full" style={{ width: `${Math.min(stats?.conversion.quoteAcceptanceRate || 0, 100)}%` }} />
              </div>
            </div>
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-500">Setup fees ce mois</p>
              <p className="text-2xl font-bold text-gray-900">{(stats?.revenue.setupFeesThisMonth || 0).toLocaleString('fr-FR')}€</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Revenu total ce mois</p>
              <p className="text-2xl font-bold text-emerald-600">{(stats?.revenue.totalThisMonth || 0).toLocaleString('fr-FR')}€</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Activity feed ──────────────────────────────────── */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Activité Récente</h3>
        <div className="space-y-3">
          {activity.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucune activité récente. Démarrez le bot pour commencer !</p>
          ) : (
            activity.slice(0, 10).map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <span className="text-xl">{item.icon}</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{item.message}</p>
                  <p className="text-xs text-gray-500">{new Date(item.date).toLocaleString('fr-FR')}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
