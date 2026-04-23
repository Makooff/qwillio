import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Users, CheckCircle2, Bell, TrendingUp, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import QwillioLoader from '../../components/QwillioLoader';
import { pro } from '../../styles/pro-theme';
import { PageHeader, Card, Stat, SectionHead, Pill } from '../../components/pro/ProBlocks';
import { useAuthStore } from '../../stores/authStore';

interface Stats {
  claimed: number;
  contactedToday: number;
  interested: number;
  qualified: number;
  converted: number;
  pendingFollowups: number;
}

interface Prospect {
  id: string; businessName: string; contactName?: string; phone?: string;
  city?: string; status: string; score?: number; priorityScore?: number;
  assignedToUserId?: string | null; lastContactDate?: string | null;
}

function greeting(name: string) {
  const h = new Date().getHours();
  const first = name?.split(' ')[0] || name;
  if (h < 12) return `Bonjour, ${first}`;
  if (h < 18) return `Bon après-midi, ${first}`;
  return `Bonsoir, ${first}`;
}

const statusPillColor = (s: string) => {
  switch (s) {
    case 'interested': return 'ok';
    case 'qualified':  return 'ok';
    case 'converted':  return 'ok';
    case 'contacted':  return 'info';
    case 'lost':       return 'bad';
    default:           return 'neutral';
  }
};

export default function CloserOverview() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [mine, setMine] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([
          api.get('/closer/stats'),
          api.get('/closer/prospects?scope=mine&limit=8'),
        ]);
        setStats(s.data);
        setMine(p.data.items || []);
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <QwillioLoader size={120} fullscreen={false} />
    </div>
  );

  return (
    <div className="space-y-5 max-w-[1200px]">
      <PageHeader
        title={greeting(user?.name || 'Emilie')}
        subtitle={new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="En cours"     value={stats?.claimed ?? 0}         hint="Vos prospects actifs" />
        <Stat label="Aujourd'hui"  value={stats?.contactedToday ?? 0}  hint="Contactés depuis ce matin" />
        <Stat label="Intéressés"   value={stats?.interested ?? 0}      hint="À relancer" />
        <Stat label="Convertis"    value={stats?.converted ?? 0}       hint="Clients signés" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link to="/closer/prospects" className="block">
          <Card className="hover:border-white/[0.14] transition-colors group">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: pro.panelHi }}>
                  <Users size={14} style={{ color: pro.text }} />
                </div>
                <ArrowRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: pro.textSec }} />
              </div>
              <p className="text-[13px] font-semibold" style={{ color: pro.text }}>Voir les prospects</p>
              <p className="text-[11.5px] mt-0.5" style={{ color: pro.textTer }}>Liste complète + recherche</p>
            </div>
          </Card>
        </Link>
        <Link to="/closer/followups" className="block">
          <Card className="hover:border-white/[0.14] transition-colors group">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: pro.panelHi }}>
                  <Bell size={14} style={{ color: pro.text }} />
                </div>
                <ArrowRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: pro.textSec }} />
              </div>
              <p className="text-[13px] font-semibold" style={{ color: pro.text }}>Follow-ups</p>
              <p className="text-[11.5px] mt-0.5" style={{ color: pro.textTer }}>
                {stats?.pendingFollowups ?? 0} en attente
              </p>
            </div>
          </Card>
        </Link>
        <Card>
          <div className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: pro.panelHi }}>
                <TrendingUp size={14} style={{ color: pro.text }} />
              </div>
            </div>
            <p className="text-[13px] font-semibold" style={{ color: pro.text }}>Taux conversion</p>
            <p className="text-[11.5px] mt-0.5 tabular-nums" style={{ color: pro.textTer }}>
              {stats && stats.claimed > 0
                ? `${Math.round((stats.converted / stats.claimed) * 100)}% sur ${stats.claimed} prospects`
                : '—'}
            </p>
          </div>
        </Card>
      </div>

      <div>
        <SectionHead
          title="Mes prospects en cours"
          action={
            <Link to="/closer/prospects?scope=mine" className="text-[11px]" style={{ color: pro.textSec }}>
              Tout voir →
            </Link>
          }
        />
        <Card>
          {mine.length === 0 ? (
            <div className="p-12 text-center" style={{ color: pro.textTer }}>
              <p className="text-[13px]">Aucun prospect en cours</p>
              <Link to="/closer/prospects" className="inline-block mt-3 text-[12px] font-medium" style={{ color: pro.accent }}>
                Voir la liste disponible →
              </Link>
            </div>
          ) : (
            mine.map((p, i) => (
              <Link
                key={p.id}
                to={`/closer/prospects/${p.id}`}
                className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.02]"
                style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-semibold"
                     style={{ background: pro.panelHi, color: pro.text }}>
                  {p.businessName?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>{p.businessName}</p>
                  <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                    {p.contactName || p.city || '—'} · {p.phone || '—'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <Pill color={statusPillColor(p.status) as any}>{p.status}</Pill>
                  <p className="text-[11px] mt-1 tabular-nums" style={{ color: pro.textTer }}>
                    {p.score ?? '—'}/22
                  </p>
                </div>
              </Link>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
