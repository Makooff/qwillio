import { useEffect, useState } from 'react';
import api from '../services/api';
import { UserCheck, UserMinus, RefreshCw, Clock, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface RetentionData {
  totalActive: number;
  activeTrial: number;
  totalTrials: number;
  convertedTrials: number;
  trialConversionRate: number;
  churned90d: number;
  churnedThisMonth: number;
  churnRate: number;
  avgLifetimeDays: number;
  byPlan: Record<string, number>;
}

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd'];

export default function Retention() {
  const [data, setData] = useState<RetentionData | null>(null);
  const [conversionByDay, setConversionByDay] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [retRes, convRes] = await Promise.all([
          api.get('/admin-analytics/retention'),
          api.get('/admin-analytics/conversion-by-day'),
        ]);
        setData(retRes.data);
        setConversionByDay(convRes.data);
      } catch (e) {
        console.error('Failed to fetch retention:', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading || !data) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>;
  }

  const planData = Object.entries(data.byPlan).map(([name, count]) => ({ name, count }));

  // Trial conversion funnel
  const funnel = [
    { stage: 'Total Trials', value: data.totalTrials },
    { stage: 'Converted', value: data.convertedTrials },
    { stage: 'Active Now', value: data.totalActive },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Retention & Churn</h1>
        <p className="text-gray-500">Client lifecycle analytics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPI icon={UserCheck} label="Active Clients" value={data.totalActive} color="green" />
        <KPI icon={RefreshCw} label="Active Trials" value={data.activeTrial} color="blue" />
        <KPI icon={BarChart3} label="Conversion Rate" value={`${data.trialConversionRate}%`} color="purple" />
        <KPI icon={UserMinus} label="Churn Rate" value={`${data.churnRate}%`} color="red" />
        <KPI icon={Clock} label="Avg Lifetime" value={`${data.avgLifetimeDays}d`} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trial Conversion Funnel */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Trial Conversion Funnel</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={funnel} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="stage" type="category" width={100} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Clients by Plan */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Clients by Plan</h3>
          {planData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={planData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, count }) => `${name}: ${count}`}>
                  {planData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-12">No client data yet</p>
          )}
        </div>
      </div>

      {/* Conversion by Day of Week */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Rate by Day of Week</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={conversionByDay}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} unit="%" />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Bar dataKey="rate" fill="#6366f1" radius={[6, 6, 0, 0]} name="Conversion Rate" />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 mt-4 text-xs text-gray-500">
          {conversionByDay.map(d => (
            <span key={d.day}>{d.day}: {d.total} calls, {d.qualified} qualified</span>
          ))}
        </div>
      </div>

      {/* Churn Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-gray-500 uppercase font-medium">Churned (30d)</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{data.churnedThisMonth}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-gray-500 uppercase font-medium">Churned (90d)</p>
          <p className="text-3xl font-bold text-red-500 mt-1">{data.churned90d}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-gray-500 uppercase font-medium">Trials Converted</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{data.convertedTrials}/{data.totalTrials}</p>
        </div>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    red: 'bg-red-50 text-red-700 border-red-100',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 opacity-70" />
        <span className="text-xs font-medium uppercase opacity-70">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
