import { useEffect, useState } from 'react';
import {
  Phone, Calendar, Users, BarChart3, Clock, TrendingUp,
  ChevronDown, ChevronUp, Star, ArrowRight,
  RefreshCw, AlertCircle, CheckCircle2, LogOut
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import QwillioLogo from '../components/QwillioLogo';
import QwillioLoader from '../components/QwillioLoader';
import LangToggle from '../components/LangToggle';
import { useLang } from '../stores/langStore';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';

type Tab = 'overview' | 'calls' | 'bookings' | 'leads' | 'analytics';

interface DashData {
  overview: any;
  calls: any;
  bookings: any;
  leads: any;
  analytics: any;
}

const sentimentStyle = (s: string) => {
  switch (s?.toLowerCase()) {
    case 'positive': return 'bg-emerald-50 text-emerald-600 border border-emerald-200';
    case 'negative': return 'bg-red-50 text-red-600 border border-red-200';
    default: return 'bg-amber-50 text-amber-600 border border-amber-200';
  }
};

export default function ClientDashboardJWT() {
  const { user, logout } = useAuthStore();
  const { t } = useLang();

  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<DashData>({ overview: null, calls: null, bookings: null, leads: null, analytics: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedCall, setExpandedCall] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [overview, calls, bookings, leads, analytics] = await Promise.all([
        api.get('/my-dashboard/overview'),
        api.get('/my-dashboard/calls?page=1&limit=20'),
        api.get('/my-dashboard/bookings'),
        api.get('/my-dashboard/leads?page=1&limit=20'),
        api.get('/my-dashboard/analytics?days=30'),
      ]);
      setData({
        overview: overview.data,
        calls: calls.data,
        bookings: bookings.data,
        leads: leads.data,
        analytics: analytics.data,
      });
    } catch (err: any) {
      const errData = err.response?.data?.error;
      setError(typeof errData === 'string' ? errData : (errData?.message || err.message || t('portal.error.load')));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-2xl font-semibold text-[#1d1d1f] mb-2">{t('portal.error.title')}</h2>
          <p className="text-[#86868b]">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <QwillioLoader size={128} label={t('portal.loading')} />;
  }

  const ov = data.overview || {};
  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'overview', label: t('portal.tab.overview'), icon: BarChart3 },
    { key: 'calls', label: t('portal.tab.calls'), icon: Phone },
    { key: 'bookings', label: t('portal.tab.bookings'), icon: Calendar },
    { key: 'leads', label: t('portal.tab.leads'), icon: Users },
    { key: 'analytics', label: t('portal.tab.analytics'), icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f]">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#d2d2d7]/60">
        <div className="max-w-[1120px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QwillioLogo size={28} />
            <span className="text-xl font-semibold tracking-tight">Qwillio</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user?.name || ov.businessName || t('portal.business.default')}</p>
              <p className="text-xs text-[#86868b]">{ov.planType || 'Pro'}</p>
            </div>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 text-sm text-[#6366f1] hover:text-[#4f46e5] transition-colors"
            >
              <RefreshCw size={16} /> {t('portal.refresh')}
            </button>
            <LangToggle />
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 text-sm text-[#86868b] hover:text-red-500 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Tabs ── */}
      <nav className="border-b border-[#d2d2d7]/60 bg-[#f5f5f7]">
        <div className="max-w-[1120px] mx-auto px-6 flex gap-1 overflow-x-auto">
          {tabs.map(tb => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                tab === tb.key
                  ? 'border-[#6366f1] text-[#6366f1]'
                  : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              <tb.icon size={16} />
              {tb.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Content ── */}
      <main className="max-w-[1120px] mx-auto px-6 py-8">

        {/* ═══ OVERVIEW ═══ */}
        {tab === 'overview' && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <KpiCard label={t('portal.kpi.today')} value={ov.callsToday || 0} icon={Phone} color="blue" />
              <KpiCard label={t('portal.kpi.month')} value={ov.callsThisMonth || 0} icon={Phone} color="indigo" />
              <KpiCard label={t('portal.kpi.bookings')} value={ov.bookingsThisMonth || 0} icon={Calendar} color="purple" />
              <KpiCard label={t('portal.kpi.leads')} value={ov.leadsThisMonth || 0} icon={Users} color="amber" />
              <KpiCard label={t('portal.kpi.avgDuration')} value={`${ov.avgDuration || 0}s`} icon={Clock} color="cyan" />
              <KpiCard label={t('portal.kpi.positiveRate')} value={`${ov.positiveRate || 0}%`} icon={Star} color="emerald" />
            </div>

            {ov.isTrial && (
              <div className="flex items-center gap-3 bg-[#6366f1]/5 border border-[#6366f1]/20 rounded-2xl px-6 py-4">
                <AlertCircle size={20} className="text-[#6366f1] flex-shrink-0" />
                <span className="text-sm text-[#1d1d1f]">{t('portal.trial.text')} <strong>{ov.trialDaysLeft || 0} {t('portal.trial.days')}</strong></span>
                <a href="#" className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-[#6366f1] hover:underline">
                  {t('portal.trial.upgrade')} <ArrowRight size={14} />
                </a>
              </div>
            )}
          </div>
        )}

        {/* ═══ CALLS ═══ */}
        {tab === 'calls' && (
          <div>
            <h2 className="text-2xl font-semibold tracking-tight mb-6">{t('portal.calls.title')}</h2>
            <div className="space-y-3">
              {(data.calls?.data || []).map((call: any) => {
                const isExpanded = expandedCall === call.id;
                return (
                  <div key={call.id} className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] overflow-hidden">
                    <div
                      className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-[#e8e8ed] transition-colors"
                      onClick={() => setExpandedCall(isExpanded ? null : call.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Phone size={16} className="text-[#86868b]" />
                        <span className="text-sm font-medium">{call.phoneNumber || t('portal.calls.unknown')}</span>
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${sentimentStyle(call.sentiment)}`}>
                          {call.sentiment || t('portal.calls.neutral')}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-[#86868b]">
                        <span>{call.durationSeconds ? `${Math.floor(call.durationSeconds / 60)}m${call.durationSeconds % 60}s` : '-'}</span>
                        <span className="hidden sm:inline">{new Date(call.createdAt).toLocaleString('fr-FR')}</span>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-6 pb-5 pt-2 border-t border-[#d2d2d7]/40 space-y-2">
                        {call.summary && <p className="text-sm text-[#1d1d1f]/80"><strong>{t('portal.calls.summary')} :</strong> {call.summary}</p>}
                        {call.outcome && <p className="text-sm text-[#1d1d1f]/80"><strong>{t('portal.calls.outcome')} :</strong> {call.outcome}</p>}
                        {call.bookingRequested && (
                          <p className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                            <CheckCircle2 size={14} /> {t('portal.calls.bookingReq')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {(!data.calls?.data || data.calls.data.length === 0) && (
                <div className="text-center py-16 text-[#86868b]">{t('portal.calls.empty')}</div>
              )}
            </div>
          </div>
        )}

        {/* ═══ BOOKINGS ═══ */}
        {tab === 'bookings' && (
          <div>
            <h2 className="text-2xl font-semibold tracking-tight mb-6">{t('portal.bookings.title')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data.bookings?.data || data.bookings || []).map((b: any) => (
                <div key={b.id} className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-6 flex items-start gap-4">
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-[#6366f1]/10 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-[#6366f1] leading-none">{new Date(b.bookingDate).toLocaleDateString('fr-FR', { day: '2-digit' })}</span>
                    <span className="text-[10px] text-[#6366f1] uppercase font-medium">{new Date(b.bookingDate).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{b.customerName || t('portal.bookings.client')}</p>
                    <p className="text-xs text-[#86868b] mt-0.5">{new Date(b.bookingDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                    {b.customerPhone && <p className="text-xs text-[#86868b] mt-0.5">{b.customerPhone}</p>}
                  </div>
                  <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
                    b.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' :
                    b.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                    'bg-amber-50 text-amber-600'
                  }`}>
                    {b.status === 'confirmed' ? t('portal.bookings.confirmed') : b.status === 'cancelled' ? t('portal.bookings.cancelled') : t('portal.bookings.pending')}
                  </span>
                </div>
              ))}
              {(!(data.bookings?.data || data.bookings) || (data.bookings?.data || data.bookings).length === 0) && (
                <div className="col-span-full text-center py-16 text-[#86868b]">{t('portal.bookings.empty')}</div>
              )}
            </div>
          </div>
        )}

        {/* ═══ LEADS ═══ */}
        {tab === 'leads' && (
          <div>
            <h2 className="text-2xl font-semibold tracking-tight mb-6">{t('portal.leads.title')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(data.leads?.data || []).map((lead: any) => (
                <div key={lead.id} className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold">{lead.customerName || t('portal.leads.prospect')}</span>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${sentimentStyle(lead.sentiment)}`}>
                      {lead.sentiment || t('portal.calls.neutral')}
                    </span>
                  </div>
                  {lead.customerPhone && (
                    <p className="flex items-center gap-1.5 text-sm text-[#86868b] mb-3">
                      <Phone size={14} /> {lead.customerPhone}
                    </p>
                  )}
                  {lead.score && (
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs text-[#86868b]">{t('portal.leads.score')}</span>
                      <div className="flex-1 h-2 bg-[#d2d2d7]/40 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#6366f1] rounded-full transition-all"
                          style={{ width: `${Math.min(lead.score * 10, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-[#6366f1]">{lead.score}/10</span>
                    </div>
                  )}
                  {lead.summary && <p className="text-sm text-[#86868b] leading-relaxed">{lead.summary}</p>}
                </div>
              ))}
              {(!data.leads?.data || data.leads.data.length === 0) && (
                <div className="col-span-full text-center py-16 text-[#86868b]">{t('portal.leads.empty')}</div>
              )}
            </div>
          </div>
        )}

        {/* ═══ ANALYTICS ═══ */}
        {tab === 'analytics' && (
          <div>
            <h2 className="text-2xl font-semibold tracking-tight mb-6">{t('portal.analytics.title')}</h2>

            {data.analytics?.dailyTrends && data.analytics.dailyTrends.length > 0 && (
              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">{t('portal.analytics.daily')}</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.analytics.dailyTrends}>
                      <defs>
                        <linearGradient id="blueGrad2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d2d2d7" strokeOpacity={0.4} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#86868b' }}
                        tickFormatter={(d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#86868b' }} />
                      <Tooltip
                        contentStyle={{
                          background: '#fff',
                          border: '1px solid #d2d2d7',
                          borderRadius: 12,
                          color: '#1d1d1f',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        }}
                      />
                      <Area type="monotone" dataKey="totalCalls" stroke="#6366f1" fill="url(#blueGrad2)" strokeWidth={2} name={t('portal.analytics.calls')} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {data.analytics?.sentimentBreakdown && (
              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-6">
                <h3 className="text-lg font-semibold mb-4">{t('portal.analytics.sentiment')}</h3>
                <div className="space-y-4">
                  {Object.entries(data.analytics.sentimentBreakdown).map(([key, val]: [string, any]) => (
                    <div key={key} className="flex items-center gap-4">
                      <span className="text-sm text-[#86868b] w-20 capitalize">{key}</span>
                      <div className="flex-1 h-3 bg-[#d2d2d7]/30 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            key === 'positive' ? 'bg-emerald-500' :
                            key === 'negative' ? 'bg-red-400' :
                            'bg-amber-400'
                          }`}
                          style={{ width: `${val}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold w-12 text-right">{val}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/* ── KPI Card ── */
function KpiCard({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-[#86868b] mt-1">{label}</p>
    </div>
  );
}
