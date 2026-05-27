import { useEffect, useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail, Calculator, Package, CreditCard,
  Megaphone, Star, CalendarClock, LifeBuoy,
  ChevronRight, RefreshCw,
} from 'lucide-react';
import api from '../../../services/api';
import { pro } from '../../../styles/pro-theme';
import { Card, PageHeader, SectionHead, Pill } from '../../../components/pro/ProBlocks';

interface AgentRow {
  type: string;
  displayName: string;
  activitiesLast24h: number;
}

interface ListResponse {
  agents: AgentRow[];
  subscriptions: Array<{ status: string; _count: { _all: number } }>;
}

const ICONS: Record<string, ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  email:      Mail,
  accounting: Calculator,
  inventory:  Package,
  payments:   CreditCard,
  marketing:  Megaphone,
  reputation: Star,
  scheduling: CalendarClock,
  support:    LifeBuoy,
};

const TAGLINES: Record<string, string> = {
  email:      'Classification + auto-reply email',
  accounting: 'Dépenses + rapports financiers',
  inventory:  'Suivi stock + alertes seuil',
  payments:   'Facturation + relances',
  marketing:  'Posts + emails + ad copy',
  reputation: 'Avis + réponses générées',
  scheduling: 'Optimisation RDV + anti no-show',
  support:    'Tickets + draft réponses',
};

const SLUG: Record<string, string> = {
  email:      'email-ai',
  accounting: 'accounting-ai',
  inventory:  'inventory-ai',
  payments:   'payments-ai',
  marketing:  'marketing-ai',
  reputation: 'reputation-ai',
  scheduling: 'scheduling-ai',
  support:    'support-ai',
};

export default function ListProductAgents() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.get<ListResponse>('/admin/agents')
      .then(r => { if (mounted) setData(r.data); })
      .catch(() => { /* shown as zero counts below */ })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="space-y-5 admin-page">
      <PageHeader
        title="Agents produit"
        subtitle="Pilote les 8 modules Agent IA: prompts, métriques live, exécutions manuelles, audit log"
      />

      <Card>
        <div className="p-4">
          <SectionHead title="Souscriptions globales" />
          {loading ? (
            <p className="text-[12px] mt-2" style={{ color: pro.textTer }}>
              <RefreshCw size={12} className="inline-block animate-spin mr-1.5" />
              Chargement…
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 mt-2">
              {(data?.subscriptions ?? []).length === 0 ? (
                <p className="text-[12px]" style={{ color: pro.textTer }}>Aucune souscription active.</p>
              ) : data?.subscriptions.map(s => (
                <Pill key={s.status} color={s.status === 'active' ? 'ok' : 'warn'}>
                  {s.status}: {s._count?._all ?? 0}
                </Pill>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {(data?.agents ?? Object.keys(ICONS).map(type => ({ type, displayName: type, activitiesLast24h: 0 }))).map(agent => {
          const Icon = ICONS[agent.type];
          const slug = SLUG[agent.type] ?? agent.type;
          const active24h = agent.activitiesLast24h ?? 0;
          return (
            <Link
              key={agent.type}
              to={`/admin/agents/${slug}`}
              className="block group active:scale-[0.99] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-2xl"
            >
              <Card>
                <div className="p-4 flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: pro.panelHi, border: `1px solid ${pro.border}` }}
                  >
                    {Icon && <Icon size={18} style={{ color: pro.accent }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13.5px] font-semibold truncate" style={{ color: pro.text }}>
                        {agent.displayName}
                      </p>
                      <ChevronRight
                        size={14}
                        className="flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                        style={{ color: pro.textTer }}
                      />
                    </div>
                    <p className="text-[11.5px] mt-0.5 truncate" style={{ color: pro.textSec }}>
                      {TAGLINES[agent.type] ?? ''}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Pill color={active24h > 0 ? 'ok' : 'neutral'}>
                        {active24h} actions 24h
                      </Pill>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
