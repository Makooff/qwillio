import { useState, useEffect, useCallback } from 'react';
import { Phone, Users, TrendingUp, CheckCircle, Clock, Zap, RefreshCw, Play, Square } from 'lucide-react';

const API = (import.meta.env.VITE_API_URL ?? 'https://qwillio.onrender.com').replace(/\/$/, '');

type ServiceStatus = 'running' | 'idle' | 'inactive';

interface DashboardData {
  bot: { isActive: boolean; lastProspection: string | null; lastCall: string | null; callsToday: number; callsQuota: number };
  services: { prospection: ServiceStatus; calling: ServiceStatus; reminders: ServiceStatus; analytics: ServiceStatus };
  prospects: { total: number; readyToCall: number; thisWeek: number };
  calls: { today: number; thisWeek: number; answered: number; conversionRate: number };
  clients: { total: number };
  activity: Array<{ id: string; message: string; timestamp: string; type: string }>;
}

function ago(d: string | null) {
  if (!d) return 'Jamais';
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

function ServiceBadge({ s }: { s: ServiceStatus }) {
  const map = {
    running: 'bg-green-100 text-green-700',
    idle:    'bg-gray-100 text-gray-500',
    inactive:'bg-red-50 text-red-500',
  };
  const label = { running: 'En cours', idle: 'En attente', inactive: 'Inactif' };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[s]}`}>
      {s === 'running' && <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full mr-1 animate-pulse" />}
      {label[s]}
    </span>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [refreshed, setRefreshed] = useState(new Date());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken') ?? localStorage.getItem('token') ?? '';
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        : {};

      const r = await fetch(`${API}/api/admin/dashboard`, { headers });

      if (r.ok) {
        const json = await r.json();
        setData(json);
        setError(null);
      } else {
        const text = await r.text().catch(() => '');
        setError(`HTTP ${r.status}: ${text.slice(0, 100)}`);
      }
    } catch (e: any) {
      setError(`Network: ${e?.message ?? 'unknown'}`);
      console.error('[Dashboard]', e);
    } finally {
      setLoading(false);
      setRefreshed(new Date());
    }
  }, []);

  const toggleBot = useCallback(async () => {
    if (!data || toggling) return;
    setToggling(true);
    try {
      const token = localStorage.getItem('accessToken') ?? localStorage.getItem('token') ?? '';
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        : {};
      const endpoint = data.bot.isActive ? '/api/bot/stop' : '/api/bot/start';
      await fetch(`${API}${endpoint}`, { method: 'POST', headers });
      await load();
    } finally {
      setToggling(false);
    }
  }, [data, toggling, load]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!loading && !data) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 px-6 text-center">
      <p className="text-sm font-semibold text-gray-800">Erreur de chargement</p>
      {error && <p className="text-xs text-red-500 font-mono bg-red-50 px-3 py-2 rounded-lg max-w-xs">{error}</p>}
      <button onClick={load} className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg font-medium mt-2">
        Réessayer
      </button>
    </div>
  );
  const d = data!;
  const active = d.bot.isActive;

  return (
    <div className="bg-gray-50 min-h-screen pb-24">

      {/* ── Banner ── */}
      <div className={`${active ? 'bg-green-600' : 'bg-gray-800'} px-4 py-3`}>
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            {active && <span className="w-2 h-2 bg-white rounded-full animate-pulse" />}
            <span className="text-white font-semibold text-sm">
              {active ? 'Bot Actif · LIVE' : 'Bot Arrêté'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="text-white/60 hover:text-white p-1">
              <RefreshCw size={13} />
            </button>
            <button
              onClick={toggleBot}
              disabled={toggling}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                active
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-white hover:bg-gray-100 text-gray-800'
              } ${toggling ? 'opacity-50' : ''}`}
            >
              {toggling ? <RefreshCw size={12} className="animate-spin" /> : active ? <Square size={12} /> : <Play size={12} />}
              {active ? 'Arrêter' : 'Démarrer'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3 max-w-lg mx-auto">

        {/* ── Prêts à appeler (hero) ── */}
        <div className="bg-violet-600 rounded-2xl p-5 text-white flex items-center justify-between">
          <div>
            <p className="text-violet-200 text-xs font-medium uppercase tracking-widest mb-1">Prêts à appeler</p>
            <p className="text-5xl font-bold">{d.prospects.readyToCall}</p>
            <p className="text-violet-300 text-xs mt-2">
              {d.prospects.total} prospects total · +{d.prospects.thisWeek} cette semaine
            </p>
          </div>
          <Phone size={40} className="text-violet-300" />
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <Phone size={16} className="text-gray-400" />
              <span className="text-xs text-gray-400">quota {d.bot.callsQuota}/j</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{d.calls.today}</p>
            <p className="text-xs text-gray-400 mt-0.5">Appels aujourd'hui</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <TrendingUp size={16} className="text-gray-400" />
              <span className="text-xs text-gray-400">{d.calls.answered} réponses</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{d.calls.conversionRate}%</p>
            <p className="text-xs text-gray-400 mt-0.5">Taux de réponse</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <Users size={16} className="text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{d.prospects.total}</p>
            <p className="text-xs text-gray-400 mt-0.5">Total prospects</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <CheckCircle size={16} className="text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{d.clients.total}</p>
            <p className="text-xs text-gray-400 mt-0.5">Clients actifs</p>
          </div>
        </div>

        {/* ── Services ── */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <p className="px-4 py-3 text-sm font-semibold text-gray-800 border-b border-gray-50">Services</p>
          {([
            ['prospection', 'Prospection', Users],
            ['calling',     'Appels sortants', Phone],
            ['reminders',   'Relances', Clock],
            ['analytics',   'Analytics', TrendingUp],
          ] as const).map(([key, label, Icon]) => (
            <div key={key} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                  <Icon size={15} className="text-gray-400" />
                </div>
                <span className="text-sm text-gray-700">{label}</span>
              </div>
              <ServiceBadge s={d.services[key]} />
            </div>
          ))}
        </div>

        {/* ── Dernières activités ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <p className="text-xs text-gray-400">Dernière prospection</p>
            <p className="text-sm font-semibold text-gray-800 mt-1">{ago(d.bot.lastProspection)}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <p className="text-xs text-gray-400">Dernier appel</p>
            <p className="text-sm font-semibold text-gray-800 mt-1">{ago(d.bot.lastCall)}</p>
          </div>
        </div>

        {/* ── Feed ── */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <p className="px-4 py-3 text-sm font-semibold text-gray-800 border-b border-gray-50">Activité récente</p>
          {d.activity.length === 0 ? (
            <div className="py-10 text-center">
              <Zap size={22} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">Aucune activité</p>
              <p className="text-xs text-gray-300">Le bot n'a pas encore tourné</p>
            </div>
          ) : d.activity.map((a, i) => (
            <div key={a.id ?? i} className="px-4 py-3 border-b border-gray-50 last:border-0">
              <p className="text-sm text-gray-700">{a.message}</p>
              <p className="text-xs text-gray-400 mt-0.5">{ago(a.timestamp)}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-300 pb-2">
          Actualisé {refreshed.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · auto 30s
        </p>
      </div>
    </div>
  );
}
