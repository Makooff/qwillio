import { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, Phone, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { StatCardSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import StatCard from '../components/ui/StatCard';

export default function PhoneValidation() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/admin-analytics/phone-validation')
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const pieData = data ? [
    { name: 'Valides', value: data.valid ?? 0 },
    { name: 'Invalides', value: data.invalid ?? 0 },
    { name: 'Non vérifiés', value: data.unverified ?? 0 },
  ] : [];
  const PIE_COLORS = ['#22C55E', '#EF4444', '#8B8BA7'];
  const ttStyle = { background: '#1E1E2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">Validation téléphonique</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">Qualité de la base de données</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : <>
          <StatCard label="Total numéros" value={data?.total ?? 0} icon={<Phone className="w-4 h-4" />} />
          <StatCard label="Valides" value={data?.valid ?? 0} icon={<CheckCircle className="w-4 h-4" />} color="#22C55E" />
          <StatCard label="Invalides" value={data?.invalid ?? 0} icon={<XCircle className="w-4 h-4" />} color="#EF4444" />
          <StatCard label="Taux validité" value={data?.validRate ?? 0} suffix="%" format="percent" icon={<AlertCircle className="w-4 h-4" />} color="#7B5CF0" />
        </>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Répartition</h3>
          {loading ? <ChartSkeleton /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="45%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Legend iconType="circle" iconSize={6} formatter={(v) => <span style={{ color: '#8B8BA7', fontSize: 10 }}>{v}</span>} />
                  <Tooltip contentStyle={ttStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Stats détaillées</h3>
          {loading ? <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-10 bg-white/[0.04] rounded-xl animate-pulse" />)}</div> : (
            <div className="space-y-3">
              {[
                { label: 'Numéros mobiles', value: data?.mobile ?? 0, color: '#22C55E' },
                { label: 'Numéros fixes', value: data?.landline ?? 0, color: '#7B5CF0' },
                { label: 'VoIP', value: data?.voip ?? 0, color: '#F59E0B' },
                { label: 'Doublons', value: data?.duplicates ?? 0, color: '#EF4444' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between p-3 bg-[#0D0D15] rounded-xl">
                  <span className="text-sm text-[#8B8BA7]">{s.label}</span>
                  <span className="text-sm font-bold" style={{ color: s.color }}>{s.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
