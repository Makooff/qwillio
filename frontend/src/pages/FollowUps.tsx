import { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, Mail, Clock, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { StatCardSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import { t, glass, tooltipStyle } from '../styles/admin-theme';

export default function FollowUps() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/admin-analytics/followups');
      setData(res);
    } catch { setData(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: t.text }}>Suivis automatiques</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>Relances et séquences</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl hover:bg-white/[0.08] transition-all" style={{ background: t.elevated, color: t.textSec }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : <>
          <StatCard label="Total envoyés" value={data?.totalSent ?? 0} icon={<Mail className="w-4 h-4" />} />
          <StatCard label="En attente" value={data?.pending ?? 0} icon={<Clock className="w-4 h-4" />} color="#F59E0B" />
          <StatCard label="Taux réponse" value={data?.responseRate ?? 0} suffix="%" format="percent" icon={<CheckCircle className="w-4 h-4" />} color="#22C55E" />
          <StatCard label="Conversions" value={data?.conversions ?? 0} icon={<CheckCircle className="w-4 h-4" />} />
        </>}
      </div>

      <div className="p-5" style={glass}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: t.text }}>Suivis par étape</h3>
        {loading ? <ChartSkeleton /> : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.byStep ?? []}>
                <XAxis dataKey="step" tick={{ fontSize: 10, fill: t.textSec }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: t.textSec }} axisLine={false} tickLine={false} width={35} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="sent" fill={t.textTer} radius={[4, 4, 0, 0]} name="Envoyés" />
                <Bar dataKey="opened" fill={t.success} radius={[4, 4, 0, 0]} name="Ouverts" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {data?.recentFollowUps?.length > 0 && (
        <div className="p-5" style={glass}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: t.text }}>Récents suivis</h3>
          <div className="space-y-2">
            {data.recentFollowUps.map((f: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ background: t.inset }}>
                <div>
                  <p className="text-sm" style={{ color: t.text }}>{f.businessName}</p>
                  <p className="text-xs" style={{ color: t.textSec }}>{f.type} · Étape {f.step}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={f.status} dot size="xs" />
                  <span className="text-xs" style={{ color: t.textSec }}>{new Date(f.sentAt).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
