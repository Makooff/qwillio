import { useEffect, useState } from 'react';
import api from '../services/api';
import { Mail, MessageSquare, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface FollowUpData {
  pending: number;
  sent: number;
  failed: number;
  successRate: number;
  byType: Record<string, number>;
  sms: { sent: number; delivered: number; failed: number };
}

export default function FollowUps() {
  const [data, setData] = useState<FollowUpData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/admin-analytics/followups');
        setData(res.data);
      } catch (e) {
        console.error('Failed to fetch follow-ups:', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading || !data) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>;
  }

  const typeLabels: Record<string, string> = {
    quote_followup_d1: 'Quote D+1',
    quote_followup_d3: 'Quote D+3',
    quote_followup_d7: 'Quote D+7',
    trial_ending_7days: 'Trial -7d',
    trial_ending_1day: 'Trial -1d',
    trial_expired: 'Trial Expired',
    callback_3months: 'Callback 3mo',
    payment_failed: 'Payment Failed',
    payment_overdue_3days: 'Overdue 3d',
    account_deactivation: 'Deactivation',
    sms_post_call: 'SMS Post-Call',
    email_video: 'Email Video',
    email_reminder_24h: 'Email 24h',
    email_dashboard_48h: 'Email 48h',
    callback_retry: 'Callback Retry',
  };

  const byTypeChart = Object.entries(data.byType)
    .map(([type, count]) => ({ type: typeLabels[type] || type, count }))
    .sort((a, b) => b.count - a.count);

  const smsDeliveryRate = data.sms.sent > 0
    ? Math.round((data.sms.delivered / data.sms.sent) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Follow-Up Management</h1>
        <p className="text-gray-500">Email & SMS follow-up pipeline (last 30 days)</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={Clock} label="Pending" value={data.pending} color="amber" />
        <KPI icon={CheckCircle} label="Sent" value={data.sent} color="green" />
        <KPI icon={XCircle} label="Failed" value={data.failed} color="red" />
        <KPI icon={AlertTriangle} label="Success Rate" value={`${data.successRate}%`} color="blue" />
      </div>

      {/* SMS Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-[#6366f1]" />
          <h3 className="text-lg font-semibold text-gray-900">SMS Pipeline</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-gray-900">{data.sms.sent}</p>
            <p className="text-sm text-gray-500 mt-1">Sent</p>
          </div>
          <div className="text-center p-4 bg-emerald-50 rounded-lg">
            <p className="text-3xl font-bold text-emerald-600">{data.sms.delivered}</p>
            <p className="text-sm text-gray-500 mt-1">Delivered</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-3xl font-bold text-red-600">{data.sms.failed}</p>
            <p className="text-sm text-gray-500 mt-1">Failed</p>
          </div>
        </div>
        <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${smsDeliveryRate}%` }} />
        </div>
        <p className="text-xs text-gray-500 mt-1">{smsDeliveryRate}% delivery rate</p>
      </div>

      {/* Follow-ups by Type Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-[#6366f1]" />
          <h3 className="text-lg font-semibold text-gray-900">Follow-ups by Type</h3>
        </div>
        {byTypeChart.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={byTypeChart} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="type" type="category" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-400 text-center py-12">No follow-ups sent yet</p>
        )}
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
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
