import { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, Phone, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { StatCardSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import StatCard from '../components/ui/StatCard';
import { t, glass, tooltipStyle } from '../styles/admin-theme';

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

  const total = data?.totalWithPhone ?? data?.total ?? 0;
  const valid = data?.validated ?? data?.valid ?? 0;
  const invalid = data?.notValidated ?? data?.invalid ?? 0;
  const validRate = data?.validatedPct ?? data?.validRate ?? 0;
  const pieData = data ? [
    { name: 'Valides', value: valid },
    { name: 'Non validés', value: invalid },
  ].filter(d => d.value > 0) : [];
  const PIE_COLORS = [t.success, t.danger, t.textSec];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: t.text }}>Validation téléphonique</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>Qualité de la base de données</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : <>
          <StatCard label="Total numéros" value={total} icon={<Phone className="w-4 h-4" />} />
          <StatCard label="Validés" value={valid} icon={<CheckCircle className="w-4 h-4" />} color="#22C55E" />
          <StatCard label="Non validés" value={invalid} icon={<XCircle className="w-4 h-4" />} color="#EF4444" />
          <StatCard label="Taux validité" value={validRate} suffix="%" format="percent" icon={<AlertCircle className="w-4 h-4" />} />
        </>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5" style={glass}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: t.text }}>Répartition</h3>
          {loading ? <ChartSkeleton /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="45%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Legend iconType="circle" iconSize={6} formatter={(v) => <span style={{ color: t.textSec, fontSize: 10 }}>{v}</span>} />
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="p-5" style={glass}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: t.text }}>Stats détaillées</h3>
          {loading ? <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}</div> : (
            <div className="space-y-3">
              {[
                { label: 'Confiance haute (≥80%)', value: data?.confidence?.high ?? 0, color: t.success },
                { label: 'Confiance moyenne (50-80%)', value: data?.confidence?.medium ?? 0, color: t.warning },
                { label: 'Confiance basse (<50%)', value: data?.confidence?.low ?? 0, color: t.danger },
                { label: 'Non encore validés', value: invalid - (data?.confidence?.high ?? 0) - (data?.confidence?.medium ?? 0) - (data?.confidence?.low ?? 0) > 0 ? invalid : 0, color: t.textSec },
              ].filter(s => s.value > 0).map(s => (
                <div key={s.label} className="flex items-center justify-between p-3 rounded-xl" style={{ background: t.inset }}>
                  <span className="text-sm" style={{ color: t.textSec }}>{s.label}</span>
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
