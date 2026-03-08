import { useEffect, useState } from 'react';
import { Phone, Calendar, Users, Clock, Star, AlertCircle, ArrowRight, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useLang } from '../../stores/langStore';
import api from '../../services/api';
import KpiCard from '../../components/client-dashboard/KpiCard';
import { formatDuration, formatDateTime, formatShortDate, daysUntil } from '../../utils/format';

export default function ClientOverview() {
  const { t } = useLang();
  const [data, setData] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [ov, an, calls] = await Promise.all([
          api.get('/my-dashboard/overview'),
          api.get('/my-dashboard/analytics?days=7'),
          api.get('/my-dashboard/calls?page=1&limit=5'),
        ]);
        setData(ov.data);
        setAnalytics(an.data);
        setRecentCalls(calls.data?.data || []);
      } catch (err) {
        console.error('Overview fetch error', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const ov = data;
  const sentimentTotal = (ov.sentiment?.positive || 0) + (ov.sentiment?.neutral || 0) + (ov.sentiment?.negative || 0);
  const positiveRate = sentimentTotal > 0 ? Math.round(((ov.sentiment?.positive || 0) / sentimentTotal) * 100) : 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">{t('cdash.overview.title')}</h1>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KpiCard label={t('cdash.overview.callsToday')} value={ov.calls?.today || 0} icon={Phone} color="blue" />
        <KpiCard label={t('cdash.overview.callsMonth')} value={ov.calls?.thisMonth || 0} icon={Phone} color="indigo" />
        <KpiCard label={t('cdash.overview.bookingsMonth')} value={ov.bookings?.thisMonth || 0} icon={Calendar} color="purple" />
        <KpiCard label={t('cdash.overview.leadsMonth')} value={ov.leads?.thisMonth || 0} icon={Users} color="amber" />
        <KpiCard label={t('cdash.overview.avgDuration')} value={formatDuration(ov.calls?.avgDuration)} icon={Clock} color="cyan" />
        <KpiCard label={t('cdash.overview.positiveRate')} value={`${positiveRate}%`} icon={Star} color="emerald" />
      </div>

      {/* Trial banner */}
      {ov.client?.isTrial && (
        <div className="flex items-center gap-3 bg-[#6366f1]/5 border border-[#6366f1]/20 rounded-2xl px-6 py-4 mb-8">
          <AlertCircle size={20} className="text-[#6366f1] flex-shrink-0" />
          <span className="text-sm">
            {t('cdash.overview.trial')}{' '}
            <strong>{daysUntil(ov.client.trialEndDate)} {t('cdash.overview.trialDays')}</strong>
          </span>
          <a href="#" className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-[#6366f1] hover:underline">
            {t('cdash.overview.upgrade')} <ArrowRight size={14} />
          </a>
        </div>
      )}

      {/* Quota usage */}
      {ov.calls?.quota > 0 && (
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-6 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{t('cdash.overview.quota')}</h3>
            <span className="text-sm text-[#86868b]">
              {ov.calls.quotaUsed} {t('cdash.overview.quotaOf')} {ov.calls.quota}
            </span>
          </div>
          <div className="h-3 bg-[#d2d2d7]/30 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                ov.calls.quotaPercent > 90 ? 'bg-red-500' : ov.calls.quotaPercent > 70 ? 'bg-amber-500' : 'bg-[#6366f1]'
              }`}
              style={{ width: `${Math.min(ov.calls.quotaPercent, 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 7-day trend chart */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-[#6366f1]" />
            {t('cdash.overview.trend')}
          </h3>
          <div className="h-52">
            {analytics?.daily && analytics.daily.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.daily}>
                  <defs>
                    <linearGradient id="indigoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d2d2d7" strokeOpacity={0.4} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#86868b' }} tickFormatter={(d) => formatShortDate(d)} />
                  <YAxis tick={{ fontSize: 11, fill: '#86868b' }} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #d2d2d7', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  />
                  <Area type="monotone" dataKey="calls" stroke="#6366f1" fill="url(#indigoGrad)" strokeWidth={2} name={t('cdash.overview.calls')} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[#86868b]">
                {t('cdash.overview.noActivity')}
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-6">
          <h3 className="text-sm font-semibold mb-4">{t('cdash.overview.activity')}</h3>
          {recentCalls.length > 0 ? (
            <div className="space-y-3">
              {recentCalls.map((call: any) => (
                <div key={call.id} className="flex items-center gap-3 text-sm">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    call.isLead ? 'bg-amber-50 text-amber-600' : call.bookingRequested ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {call.isLead ? <Users size={14} /> : call.bookingRequested ? <Calendar size={14} /> : <Phone size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {call.isLead ? t('cdash.overview.newLead') : call.bookingRequested ? t('cdash.overview.newBooking') : t('cdash.overview.callFrom')}{' '}
                      {call.callerName || call.callerNumber || t('cdash.calls.unknown')}
                    </p>
                    <p className="text-xs text-[#86868b]">{formatDateTime(call.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#86868b] py-8 text-center">{t('cdash.overview.noActivity')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
