import { useState, useEffect, useCallback } from 'react';
import { Users, Phone, TrendingUp, CheckCircle, Zap, Clock, BarChart2, RefreshCw } from 'lucide-react';

interface DashboardStats {
  totalProspects: number;
  prospectsReadyToCall: number;
  prospectsThisWeek: number;
  callsToday: number;
  callsThisWeek: number;
  answeredCalls: number;
  conversionRate: number;
  activeClients: number;
  botIsActive: boolean;
  lastProspection: string | null;
  lastCall: string | null;
  servicesStatus: {
    prospection: 'running' | 'idle' | 'inactive';
    calling: 'running' | 'idle' | 'inactive';
    reminders: 'running' | 'idle' | 'inactive';
    analytics: 'running' | 'idle' | 'inactive';
    dailyReset: 'running' | 'idle' | 'inactive';
  };
}

interface ActivityItem {
  id: string;
  message?: string;
  description?: string;
  timestamp?: string;
  date?: string;
  type?: string;
}

const API = import.meta.env.VITE_API_URL || '';

const serviceDefs = [
  { key: 'prospection', label: 'Prospection', icon: Users },
  { key: 'calling', label: 'Appels', icon: Phone },
  { key: 'reminders', label: 'Relances', icon: Clock },
  { key: 'analytics', label: 'Analytics', icon: BarChart2 },
] as const;

function StatusBadge({ status }: { status: 'running' | 'idle' | 'inactive' }) {
  if (status === 'running') return (
    <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
      En cours
    </span>
  );
  if (status === 'idle') return (
    <span className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
      En attente
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
      Inactif
    </span>
  );
}

function fmt(n: number | undefined | null): string {
  if (n == null) return '0';
  return n.toLocaleString('fr-FR');
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Jamais';
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Il y a ${days}j`;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const [statsRes, actRes] = await Promise.allSettled([
        fetch(`${API}/api/admin/stats`, { headers }),
        fetch(`${API}/api/admin/activity-feed`, { headers }),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const data = await statsRes.value.json();
        setStats(data);
      }
      if (actRes.status === 'fulfilled' && actRes.value.ok) {
        const data = await actRes.value.json();
        setActivity(Array.isArray(data) ? data.slice(0, 8) : []);
      }
    } catch (e) {
      console.error('Dashboard load error', e);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const botActive = stats?.botIsActive ?? false;
  const services = stats?.servicesStatus;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Status Banner */}
      <div className={`px-4 py-3 ${botActive ? 'bg-green-600' : 'bg-red-500'}`}>
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${botActive ? 'bg-white animate-pulse' : 'bg-red-200'}`} />
            <span className="text-white font-semibold text-sm">
              {botActive ? 'Bot Actif · LIVE' : 'Bot Arrêté'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/80 text-xs">
              {botActive ? 'Tous les crons actifs' : 'Aucun cron ne tourne'}
            </span>
            <button onClick={load} className="text-white/80 hover:text-white">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 max-w-lg mx-auto space-y-4">

        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Prêts à appeler — highlight */}
          <div className="bg-violet-600 rounded-xl p-4 text-white shadow-md col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-violet-200 text-xs font-medium uppercase tracking-wide">Prêts à appeler</p>
                <p className="text-4xl font-bold mt-1">{fmt(stats?.prospectsReadyToCall)}</p>
                <p className="text-violet-200 text-xs mt-1">
                  {(stats?.prospectsReadyToCall ?? 0) > 0 ? 'Prospects qualifiés disponibles' : 'Aucun prospect qualifié'}
                </p>
              </div>
              <Phone size={32} className="text-violet-300" />
            </div>
          </div>

          {/* Total Prospects */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <Users size={18} className="text-gray-400" />
              <span className="text-xs text-green-600 font-medium">
                {(stats?.prospectsThisWeek ?? 0) > 0 ? `+${stats?.prospectsThisWeek} / 7j` : 'cette semaine'}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmt(stats?.totalProspects)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total prospects</p>
          </div>

          {/* Appels aujourd'hui */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <Phone size={18} className="text-gray-400" />
              <span className="text-xs text-gray-400">quota 50/j</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmt(stats?.callsToday)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Appels aujourd&apos;hui</p>
          </div>

          {/* Taux réponse */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp size={18} className="text-gray-400" />
              <span className="text-xs text-gray-400">{fmt(stats?.answeredCalls)} réponses</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats?.conversionRate ?? 0}%</p>
            <p className="text-xs text-gray-500 mt-0.5">Taux de réponse</p>
          </div>

          {/* Clients actifs */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle size={18} className="text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmt(stats?.activeClients)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Clients actifs</p>
          </div>
        </div>

        {/* Services */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Services</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {serviceDefs.map(({ key, label, icon: Icon }) => {
              const s = services?.[key as keyof typeof services] ?? (botActive ? 'idle' : 'inactive');
              return (
                <div key={key} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
                      <Icon size={16} className="text-gray-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-800">{label}</span>
                  </div>
                  <StatusBadge status={s} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Dernières infos */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 font-medium">Dernière prospection</p>
            <p className="text-sm font-semibold text-gray-800 mt-1">{timeAgo(stats?.lastProspection ?? null)}</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 font-medium">Dernier appel</p>
            <p className="text-sm font-semibold text-gray-800 mt-1">{timeAgo(stats?.lastCall ?? null)}</p>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Activité récente</h2>
          </div>
          {activity.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Zap size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">Aucune activité pour l&apos;instant</p>
              <p className="text-xs text-gray-300 mt-1">Démarrez le bot pour commencer</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activity.map((item, i) => (
                <div key={item.id ?? i} className="px-4 py-3">
                  <p className="text-sm text-gray-700">{item.description ?? item.message ?? '—'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(item.timestamp ?? item.date ?? null)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Last refresh */}
        <p className="text-center text-xs text-gray-300 pb-2">
          Actualisé à {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · Auto-refresh 30s
        </p>
      </div>
    </div>
  );
}
