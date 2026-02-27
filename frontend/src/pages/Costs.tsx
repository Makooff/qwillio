import { useEffect, useState } from 'react';
import api from '../services/api';
import { DollarSign, Phone, MessageSquare, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface CostData {
  period: { days: number; startDate: string };
  daily: Array<{
    date: string;
    vapi: number;
    apis: number;
    twilioSms: number;
    twilioLookup: number;
    total: number;
  }>;
  totals: {
    vapiCalls: number;
    apis: number;
    twilioSms: number;
    twilioLookup: number;
    totalCost: number;
    totalRevenue: number;
    profit: number;
    totalCalls: number;
    totalSms: number;
    totalValidations: number;
  };
}

export default function Costs() {
  const [data, setData] = useState<CostData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/admin-analytics/costs?days=${days}`);
        setData(res.data);
      } catch (e) {
        console.error('Failed to fetch costs:', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [days]);

  if (loading || !data) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>;
  }

  const { totals } = data;
  const isProfitable = totals.profit >= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operating Costs</h1>
          <p className="text-gray-500">P&L breakdown by service</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 text-sm rounded-lg transition ${days === d ? 'bg-[#6366f1] text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card icon={DollarSign} label="Total Cost" value={`$${totals.totalCost.toFixed(2)}`} color="red" />
        <Card icon={TrendingUp} label="Total Revenue" value={`$${totals.totalRevenue.toFixed(2)}`} color="green" />
        <Card icon={isProfitable ? TrendingUp : TrendingDown} label="Profit" value={`$${totals.profit.toFixed(2)}`} color={isProfitable ? 'green' : 'red'} />
        <Card icon={Phone} label="Total Calls" value={totals.totalCalls.toString()} color="blue" />
      </div>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniCard label="VAPI Calls" value={`$${totals.vapiCalls.toFixed(2)}`} sub={`${totals.totalCalls} calls`} />
        <MiniCard label="Google APIs" value={`$${totals.apis.toFixed(2)}`} sub="Places + Details" />
        <MiniCard label="Twilio SMS" value={`$${totals.twilioSms.toFixed(4)}`} sub={`${totals.totalSms} sent`} />
        <MiniCard label="Twilio Lookup" value={`$${totals.twilioLookup.toFixed(4)}`} sub={`${totals.totalValidations} validated`} />
      </div>

      {/* Daily Cost Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Cost Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data.daily.map(d => ({ ...d, date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => `$${v.toFixed(4)}`} />
            <Area type="monotone" dataKey="vapi" stackId="1" fill="#6366f1" stroke="#6366f1" name="VAPI" />
            <Area type="monotone" dataKey="apis" stackId="1" fill="#8b5cf6" stroke="#8b5cf6" name="APIs" />
            <Area type="monotone" dataKey="twilioSms" stackId="1" fill="#a78bfa" stroke="#a78bfa" name="SMS" />
            <Area type="monotone" dataKey="twilioLookup" stackId="1" fill="#c4b5fd" stroke="#c4b5fd" name="Lookup" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    red: 'bg-red-50 text-red-600 border-red-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color] || colors.blue}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase opacity-70">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function MiniCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase font-medium">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}
