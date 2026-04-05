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
    return (
      <div className="flex items-center justify-center h-96" style={{ background: '#0A0A0F' }}>
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor: '#7C3AED', borderRightColor: '#06B6D4' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 md:p-6" style={{ background: '#0A0A0F', minHeight: '100vh' }}>

      {/* Bot Status Hero Card */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(6,182,212,0.10) 100%)',
          border: '1px solid rgba(255,255,255,0.05)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Glow blob */}
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'rgba(124,58,237,0.15)', filter: 'blur(40px)' }} />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'rgba(6,182,212,0.10)', filter: 'blur(40px)' }} />

        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* Left: Toggle */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleBot}
              className="relative flex items-center transition-all duration-300 focus:outline-none"
              style={{ width: 64, height: 32 }}
              aria-label="Toggle bot"
            >
              <div
                className="w-full h-full rounded-full transition-all duration-300"
                style={{
                  background: botStatus?.isActive
                    ? 'linear-gradient(90deg, #7C3AED, #06B6D4)'
                    : 'rgba(255,255,255,0.08)',
                  boxShadow: botStatus?.isActive ? '0 0 16px rgba(124,58,237,0.5)' : 'none',
                }}
              />
              <div
                className="absolute w-6 h-6 rounded-full bg-white transition-all duration-300 shadow-lg"
                style={{
                  left: botStatus?.isActive ? 'calc(100% - 28px)' : '4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
            </button>
            <div>
              <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Bot Status
              </p>
              <p className="text-sm font-bold" style={{ color: botStatus?.isActive ? '#10B981' : 'rgba(255,255,255,0.5)' }}>
                {botStatus?.isActive ? 'Actif' : 'Inactif'}
              </p>
            </div>
          </div>

          {/* Center: Big call count */}
          <div className="flex-1 text-center">
            <p className="font-black text-white leading-none" style={{ fontSize: 48 }}>
              {botStatus?.callsToday || 0}
            </p>
            <p className="text-sm font-medium mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              appels aujourd'hui
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
              quota: {botStatus?.callsQuotaDaily || 50}/jour
            </p>
          </div>

          {/* Right: LIVE badge */}
          <div className="flex items-center">
            {botStatus?.isActive ? (
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-full"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-bold tracking-widest" style={{ color: '#EF4444' }}>LIVE</span>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-full"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
                <span className="text-xs font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>OFFLINE</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Prospects */}
        <div
          className="rounded-2xl p-5 group transition-all duration-300 cursor-default"
          style={{
            background: '#12121A',
            border: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(4px)',
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 24px rgba(124,58,237,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
        >
          <div className="flex items-center gap-1.5 mb-3">
            <div className="p-1.5 rounded-lg" style={{ background: 'rgba(124,58,237,0.15)' }}>
              <Users className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} />
            </div>
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Prospects</span>
          </div>
          <div className="flex items-end gap-2">
            <p className="font-black text-white leading-none" style={{ fontSize: 32 }}>
              {stats?.prospects.total || 0}
            </p>
            <span className="flex items-center gap-0.5 text-xs font-bold mb-1" style={{ color: '#10B981' }}>
              <ArrowUp className="w-3 h-3" />+{stats?.prospects.newThisMonth || 0}
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>ce mois</p>
        </div>

        {/* Appels */}
        <div
          className="rounded-2xl p-5 transition-all duration-300 cursor-default"
          style={{
            background: '#12121A',
            border: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(4px)',
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 24px rgba(124,58,237,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
        >
          <div className="flex items-center gap-1.5 mb-3">
            <div className="p-1.5 rounded-lg" style={{ background: 'rgba(6,182,212,0.15)' }}>
              <Phone className="w-3.5 h-3.5" style={{ color: '#06B6D4' }} />
            </div>
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Appels</span>
          </div>
          <div className="flex items-end gap-2">
            <p className="font-black text-white leading-none" style={{ fontSize: 32 }}>
              {stats?.calls.today || 0}
            </p>
            <span className="flex items-center gap-0.5 text-xs font-bold mb-1" style={{ color: '#10B981' }}>
              <ArrowUp className="w-3 h-3" />{stats?.calls.successRate?.toFixed(0) || 0}%
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>aujourd'hui</p>
        </div>

        {/* Clients */}
        <div
          className="rounded-2xl p-5 transition-all duration-300 cursor-default"
          style={{
            background: '#12121A',
            border: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(4px)',
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 24px rgba(124,58,237,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
        >
          <div className="flex items-center gap-1.5 mb-3">
            <div className="p-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.15)' }}>
              <Building2 className="w-3.5 h-3.5" style={{ color: '#10B981' }} />
            </div>
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Clients</span>
          </div>
          <div className="flex items-end gap-2">
            <p className="font-black text-white leading-none" style={{ fontSize: 32 }}>
              {stats?.clients.totalActive || 0}
            </p>
            <span className="flex items-center gap-0.5 text-xs font-bold mb-1" style={{ color: '#10B981' }}>
              <ArrowUp className="w-3 h-3" />+{stats?.clients.newThisMonth || 0}
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>actifs</p>
        </div>

        {/* MRR */}
        <div
          className="rounded-2xl p-5 transition-all duration-300 cursor-default"
          style={{
            background: '#12121A',
            border: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(4px)',
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 24px rgba(124,58,237,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
        >
          <div className="flex items-center gap-1.5 mb-3">
            <div className="p-1.5 rounded-lg" style={{ background: 'rgba(124,58,237,0.15)' }}>
              <TrendingUp className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} />
            </div>
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>MRR</span>
          </div>
          <div className="flex items-end gap-2">
            <p className="font-black text-white leading-none" style={{ fontSize: 28 }}>
              {(stats?.revenue.mrr || 0).toLocaleString('fr-FR')}€
            </p>
          </div>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>mensuel</p>
        </div>
      </div>

      {/* Revenue Chart + Conversion */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Revenue Chart */}
        <div
          className="rounded-2xl p-6 col-span-1 lg:col-span-2"
          style={{
            background: '#12121A',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold text-white">Revenue</h3>
            <span className="text-xs font-medium px-3 py-1 rounded-full"
              style={{ background: 'rgba(124,58,237,0.15)', color: '#7C3AED' }}>
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
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }}
                  axisLine={false}
                  tickLine={false}
                />
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
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#7C3AED"
                  fill="url(#colorRevenue)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Conversion + Revenue breakdown */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: '#12121A',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
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

      {/* Recent Activity */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: '#12121A',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
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
                className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200"
                style={{ cursor: 'default' }}
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
