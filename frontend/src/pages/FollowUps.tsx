import { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, Mail, Clock, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { StatCardSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';

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

  const ttStyle = { background: '#1E1E2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">Suivis automatiques</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">Relances et séquences</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7] transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : <>
          <StatCard label="Total envoyés" value={data?.totalSent ?? 0} icon={<Mail className="w-4 h-4" />} />
          <StatCard label="En attente" value={data?.pending ?? 0} icon={<Clock className="w-4 h-4" />} color="#F59E0B" />
          <StatCard label="Taux réponse" value={data?.responseRate ?? 0} suffix="%" format="percent" icon={<CheckCircle className="w-4 h-4" />} color="#22C55E" />
          <StatCard label="Conversions" value={data?.conversions ?? 0} icon={<CheckCircle className="w-4 h-4" />} color="#7B5CF0" />
        </>}
      </div>

      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Suivis par étape</h3>
        {loading ? <ChartSkeleton /> : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.byStep ?? []}>
                <XAxis dataKey="step" tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} width={35} />
                <Tooltip contentStyle={ttStyle} />
                <Bar dataKey="sent" fill="#7B5CF0" radius={[4, 4, 0, 0]} name="Envoyés" />
                <Bar dataKey="opened" fill="#22C55E" radius={[4, 4, 0, 0]} name="Ouverts" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {data?.recentFollowUps?.length > 0 && (
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Récents suivis</h3>
          <div className="space-y-2">
            {data.recentFollowUps.map((f: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-[#0D0D15] rounded-xl">
                <div>
                  <p className="text-sm text-[#F8F8FF]">{f.businessName}</p>
                  <p className="text-xs text-[#8B8BA7]">{f.type} · Étape {f.step}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={f.status} dot size="xs" />
                  <span className="text-xs text-[#8B8BA7]">{new Date(f.sentAt).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
