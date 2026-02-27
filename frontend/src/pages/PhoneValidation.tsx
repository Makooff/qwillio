import { useEffect, useState } from 'react';
import api from '../services/api';
import { Phone, CheckCircle, XCircle, Search, Shield } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface PhoneValidationData {
  totalWithPhone: number;
  validated: number;
  notValidated: number;
  validatedPct: number;
  bySource: Record<string, number>;
  confidence: { high: number; medium: number; low: number };
}

interface CPAData {
  overallCPA: number;
  totalCost: number;
  totalClients: number;
  byNiche: Record<string, { clients: number; cpa: number }>;
  byCountry: Record<string, { clients: number; cpa: number }>;
}

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];

export default function PhoneValidation() {
  const [phoneData, setPhoneData] = useState<PhoneValidationData | null>(null);
  const [cpaData, setCpaData] = useState<CPAData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [phoneRes, cpaRes] = await Promise.all([
          api.get('/admin-analytics/phone-validation'),
          api.get('/admin-analytics/cpa'),
        ]);
        setPhoneData(phoneRes.data);
        setCpaData(cpaRes.data);
      } catch (e) {
        console.error('Failed to fetch data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading || !phoneData || !cpaData) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>;
  }

  const confidenceData = [
    { name: 'High (80%+)', value: phoneData.confidence.high, color: '#10b981' },
    { name: 'Medium (50-80%)', value: phoneData.confidence.medium, color: '#f59e0b' },
    { name: 'Low (<50%)', value: phoneData.confidence.low, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const sourceData = Object.entries(phoneData.bySource).map(([source, count]) => ({
    name: source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    count,
  }));

  const cpaNiche = Object.entries(cpaData.byNiche)
    .map(([niche, d]) => ({ niche: niche.charAt(0).toUpperCase() + niche.slice(1), ...d }))
    .sort((a, b) => a.cpa - b.cpa);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Phone Validation & CPA</h1>
        <p className="text-gray-500">Prospect phone quality and cost per acquisition</p>
      </div>

      {/* Phone Validation KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={Phone} label="Total w/ Phone" value={phoneData.totalWithPhone} color="blue" />
        <KPI icon={CheckCircle} label="Validated" value={phoneData.validated} color="green" />
        <KPI icon={XCircle} label="Not Validated" value={phoneData.notValidated} color="amber" />
        <KPI icon={Shield} label="Validated %" value={`${phoneData.validatedPct}%`} color="purple" />
      </div>

      {/* Validation Progress Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Validation Progress</h3>
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] rounded-full transition-all duration-500" style={{ width: `${phoneData.validatedPct}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-500">
          <span>{phoneData.validated} validated</span>
          <span>{phoneData.notValidated} remaining</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confidence Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Confidence Distribution</h3>
          {confidenceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={confidenceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                  {confidenceData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-12">No validation data yet</p>
          )}
        </div>

        {/* Validation Source Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Validation Sources</h3>
          {sourceData.length > 0 ? (
            <div className="space-y-3">
              {sourceData.map(s => (
                <div key={s.name} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{s.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#6366f1] rounded-full" style={{ width: `${(s.count / phoneData.validated) * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8 text-right">{s.count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-12">No sources yet</p>
          )}
        </div>
      </div>

      {/* CPA by Niche */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">CPA by Niche</h3>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase">Overall CPA</p>
            <p className="text-2xl font-bold text-[#6366f1]">${cpaData.overallCPA}</p>
          </div>
        </div>
        {cpaNiche.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cpaNiche}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="niche" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
              <Bar dataKey="cpa" fill="#6366f1" radius={[6, 6, 0, 0]} name="CPA ($)" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-400 text-center py-12">No CPA data yet</p>
        )}
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
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
