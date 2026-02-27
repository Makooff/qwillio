import { useEffect, useState } from 'react';
import api from '../services/api';
import { DashboardStats, BotStatus } from '../types';
import {
  Users, Building2, TrendingUp, Phone, Power, PowerOff, Zap,
  ArrowUp, ArrowDown, Play, Square
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [revenueHistory, setRevenueHistory] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsRes, botRes, revenueRes, activityRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/bot/status'),
        api.get('/dashboard/revenue-history'),
        api.get('/dashboard/activity'),
      ]);
      setStats(statsRes.data);
      setBotStatus(botRes.data);
      setRevenueHistory(revenueRes.data);
      setActivity(activityRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleBot = async () => {
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
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de Bord</h1>
          <p className="text-gray-500">Qwillio overview</p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border-2 ${
            botStatus?.isActive ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className={`w-3 h-3 rounded-full ${botStatus?.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
            <div>
              <p className="text-sm font-semibold">{botStatus?.isActive ? 'Bot Actif' : 'Bot Inactif'}</p>
              <p className="text-xs text-gray-500">{botStatus?.callsToday || 0}/{botStatus?.callsQuotaDaily || 50} appels</p>
            </div>
            <button onClick={toggleBot} className={`ml-3 p-2 rounded-lg transition-all ${
              botStatus?.isActive ? 'bg-red-100 hover:bg-red-200 text-red-600' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-600'
            }`}>
              {botStatus?.isActive ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

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
