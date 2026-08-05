import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import {
  Mail, CreditCard, BookOpen, Package,
  Megaphone, Star, CalendarClock, LifeBuoy,
  Users, FileText, MapPin, Crosshair, LineChart,
  Plus, Zap, type LucideIcon,
} from '../../../components/icons';
import {
  Card,
  PageActions,
  SectionHead,
  Stat,
  Row,
  PrimaryBtn,
  Pill,
  Toggle,
} from '../../../components/v2/app/Blocks';

type ModuleStatus = 'active' | 'setup_required' | 'paused';
type ActivityType = 'email' | 'payment' | 'accounting' | 'inventory';
type GroupId = 'growth' | 'operations' | 'steering' | 'roadmap';

interface Module {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  group: GroupId;
  status: ModuleStatus;
  enabled: boolean;
  href: string;
  /* Module de feuille de route: la page n'est pas fonctionnelle, donc pas de
     lien ni d'activation possible. */
  comingSoon?: boolean;
}

interface ActivityItem {
  id: number;
  module: string;
  action: string;
  time: string;
  type: ActivityType;
}

interface SavedModule {
  id: string;
  enabled: boolean;
}

interface DashboardSettings {
  vapiConfig?: {
    agentModules?: SavedModule[];
  };
}

interface StatItem {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
}

const INITIAL_MODULES: Module[] = [
  {
    id: 'email',
    name: 'Email AI',
    description: "Classe, répond et trie votre boîte de réception. Gère seul les emails de rendez-vous et de paiement.",
    icon: Mail,
    group: 'roadmap',
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/email',
    comingSoon: true,
  },
  {
    id: 'payments',
    name: 'Payments AI',
    description: "Envoie les demandes d'acompte, suit les statuts de paiement et déclenche les rappels SMS.",
    icon: CreditCard,
    group: 'roadmap',
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/payments',
    comingSoon: true,
  },
  {
    id: 'accounting',
    name: 'Accounting AI',
    description: 'Génère les factures, suit revenus et dépenses, relance les impayés selon un calendrier.',
    icon: BookOpen,
    group: 'roadmap',
    status: 'paused',
    enabled: false,
    href: '/dashboard/agent/accounting',
    comingSoon: true,
  },
  {
    id: 'inventory',
    name: 'Inventory AI',
    description: 'Surveille les niveaux de stock, alerte sous le seuil et commande auprès des fournisseurs.',
    icon: Package,
    group: 'roadmap',
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/inventory',
    comingSoon: true,
  },
  {
    id: 'marketing',
    name: 'Marketing AI',
    description: 'Posts sociaux, emails campagne et textes publicitaires adaptés à votre niche.',
    icon: Megaphone,
    group: 'growth',
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/marketing',
  },
  {
    id: 'reputation',
    name: 'Reputation AI',
    description: 'Surveille les avis Google et Facebook, rédige les réponses, escalade les notes basses.',
    icon: Star,
    group: 'growth',
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/reputation',
  },
  {
    id: 'scheduling',
    name: 'Scheduling AI',
    description: 'Optimise les créneaux, réduit les no-shows par rappels, recommande les meilleurs horaires.',
    icon: CalendarClock,
    group: 'operations',
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/scheduling',
  },
  {
    id: 'support',
    name: 'Support AI',
    description: 'Trie les tickets entrants, rédige les réponses, escalade les cas urgents vers un humain.',
    icon: LifeBuoy,
    group: 'operations',
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/support',
  },
  {
    id: 'crm',
    name: 'CRM AI',
    description: 'Gestion du pipeline, synchronisation HubSpot, analyse des deals perdus et forecast.',
    icon: Users,
    group: 'operations',
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/crm',
  },
  {
    id: 'document',
    name: 'Document AI',
    description: 'Génère devis, contrats et estimations depuis vos informations, prêts pour signature.',
    icon: FileText,
    group: 'operations',
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/document',
  },
  {
    id: 'local_seo',
    name: 'Local SEO AI',
    description: 'Posts Google Business, mots-clés locaux, audit de fiche et suivi de position.',
    icon: MapPin,
    group: 'growth',
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/local-seo',
  },
  {
    id: 'lead_gen',
    name: 'Lead Gen AI',
    description: 'Découvre des prospects ciblés et lance des séquences multi-touch personnalisées.',
    icon: Crosshair,
    group: 'growth',
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/lead-gen',
  },
  {
    id: 'analytics',
    name: 'Analytics AI',
    description: "Digest hebdomadaire, détection d'anomalies, forecast et recommandations transverses.",
    icon: LineChart,
    group: 'steering',
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/analytics',
  },
];

const GROUPS: Array<{ id: GroupId; label: string }> = [
  { id: 'growth', label: 'Croissance' },
  { id: 'operations', label: 'Clients et opérations' },
  { id: 'steering', label: 'Pilotage' },
  { id: 'roadmap', label: 'Feuille de route' },
];

const ACTIVITY_FEED: ActivityItem[] = [
  { id: 1,  module: 'Email AI',      action: "Réponse automatique à une demande de rendez-vous de sarah@email.com", time: 'il y a 2 min',  type: 'email'      },
  { id: 2,  module: 'Email AI',      action: '3 emails classés Urgent, déplacés en file de revue',                  time: 'il y a 8 min',  type: 'email'      },
  { id: 3,  module: 'Payments AI',   action: "Rappel d'acompte envoyé par SMS au +1 (555) 234-5678",                time: 'il y a 15 min', type: 'payment'    },
  { id: 4,  module: 'Email AI',      action: 'Spam détecté et déplacé : « Gagnez un prix maintenant »',              time: 'il y a 22 min', type: 'email'      },
  { id: 5,  module: 'Accounting AI', action: 'Facture #1042 générée pour Johnson & Co. : 850,00 $',                 time: 'il y a 1 h',    type: 'accounting' },
  { id: 6,  module: 'Inventory AI',  action: 'Alerte stock bas : « Huile de massage 500 ml » sous le seuil (3)',    time: 'il y a 2 h',    type: 'inventory'  },
  { id: 7,  module: 'Email AI',      action: 'Digest quotidien compilé : 12 emails traités durant la nuit',         time: 'il y a 8 h',    type: 'email'      },
  { id: 8,  module: 'Payments AI',   action: 'Frais de no-show de 50 $ facturés au client #2201',                   time: 'il y a 9 h',    type: 'payment'    },
  { id: 9,  module: 'Accounting AI', action: 'Relance 14 jours envoyée à Martinez LLC : 1 200 $ en attente',        time: 'il y a 10 h',   type: 'accounting' },
  { id: 10, module: 'Email AI',      action: 'Réponse automatique : confirmation de paiement à mike@domain.com',    time: 'il y a 11 h',   type: 'email'      },
  { id: 11, module: 'Inventory AI',  action: 'Commande auto passée : « Bougies lavande x24 » chez GreenSupply Co.', time: 'il y a 12 h',   type: 'inventory'  },
  { id: 12, module: 'Accounting AI', action: 'Compte de résultat mensuel exporté vers QuickBooks : mars 2026',      time: 'il y a 1 j',    type: 'accounting' },
];

const STATUS_LABEL: Record<ModuleStatus, { label: string; tone: 'ok' | 'warn' | 'neutral' }> = {
  active:         { label: 'Actif',                 tone: 'ok'      },
  setup_required: { label: 'Configuration requise', tone: 'warn'    },
  paused:         { label: 'En pause',              tone: 'neutral' },
};

const ACTIVITY_ICON_MAP: Record<ActivityType, LucideIcon> = {
  email:      Mail,
  payment:    CreditCard,
  accounting: BookOpen,
  inventory:  Package,
};

const STATS: StatItem[] = [
  { label: 'Emails traités',      value: '1 284',   sub: 'ce mois-ci', icon: Mail       },
  { label: 'Paiements encaissés', value: '14 320 $', sub: 'ce mois-ci', icon: CreditCard },
  { label: 'Factures générées',   value: '47',      sub: 'ce mois-ci', icon: BookOpen   },
  { label: 'Alertes de stock',    value: '6',       sub: 'ce mois-ci', icon: Package    },
];

export default function AgentDashboard() {
  const [modules, setModules] = useState<Module[]>(INITIAL_MODULES);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/my-dashboard/settings').then((res) => {
      const saved = (res.data as DashboardSettings)?.vapiConfig?.agentModules;
      if (Array.isArray(saved) && saved.length > 0) {
        setModules(prev =>
          prev.map(m => {
            const s = saved.find(x => x.id === m.id);
            if (!s) return m;
            return { ...m, enabled: s.enabled, status: s.enabled ? 'active' : 'paused' };
          })
        );
      }
    }).catch(() => { /* keep defaults */ });
  }, []);

  const toggleModule = (id: string) => {
    const next = modules.map(m =>
      m.id === id
        ? { ...m, enabled: !m.enabled, status: (!m.enabled ? 'active' : 'paused') as ModuleStatus }
        : m
    );
    setModules(next);
    api.put('/my-dashboard/agent-modules', {
      modules: next.map(m => ({ id: m.id, enabled: m.enabled })),
    }).catch(() => { /* best-effort */ });
  };

  const activeCount = modules.filter(m => m.enabled).length;

  return (
    <div className="space-y-4">
      <PageActions subtitle={`Modules IA autonomes · ${activeCount} actifs`}>
        <PrimaryBtn onClick={() => navigate('/dashboard/billing')}>
          <Plus size={13} aria-hidden="true" />
          Ajouter un module
        </PrimaryBtn>
      </PageActions>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATS.map(s => (
          <Stat key={s.label} icon={s.icon} label={s.label} value={s.value} hint={s.sub} />
        ))}
      </div>

      {GROUPS.map(group => {
        const list = modules.filter(m => m.group === group.id);
        if (list.length === 0) return null;
        const enabled = list.filter(m => m.enabled).length;
        return (
          <Card key={group.id} pad={false}>
            <div className="px-4 pt-4 pb-3 border-b border-q2-graphite-d">
              <SectionHead
                className="mb-0"
                title={group.label}
                action={
                  <span className="text-[11px] text-q2-fog tabular-nums">
                    {group.id === 'roadmap' ? `${list.length} à venir` : `${enabled} / ${list.length} actifs`}
                  </span>
                }
              />
            </div>
            <ul>
              {list.map((mod, i) => (
                <li key={mod.id}>
                  <Row
                    first={i === 0}
                    icon={mod.icon}
                    label={
                      mod.comingSoon ? (
                        mod.name
                      ) : (
                        <Link
                          to={mod.href}
                          className="hover:text-q2-lift transition-colors duration-100 focus:outline-none focus-visible:text-q2-lift"
                        >
                          {mod.name}
                        </Link>
                      )
                    }
                    hint={mod.description}
                    right={
                      mod.comingSoon ? (
                        <Pill tone="info">Bientôt disponible</Pill>
                      ) : (
                        <>
                          <Pill tone={STATUS_LABEL[mod.status].tone} className="hidden sm:inline-flex">
                            {STATUS_LABEL[mod.status].label}
                          </Pill>
                          <Toggle
                            checked={mod.enabled}
                            onChange={() => toggleModule(mod.id)}
                            label={mod.enabled ? `Désactiver ${mod.name}` : `Activer ${mod.name}`}
                          />
                        </>
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          </Card>
        );
      })}

      <Card pad={false}>
        <div className="px-4 pt-4 pb-3 border-b border-q2-graphite-d">
          <SectionHead
            className="mb-0"
            title="Actions récentes de l'agent"
            action={<span className="text-[11px] text-q2-fog tabular-nums">{ACTIVITY_FEED.length} actions</span>}
          />
        </div>
        <ul>
          {ACTIVITY_FEED.map((item, i) => (
            <li key={item.id}>
              <Row
                first={i === 0}
                icon={ACTIVITY_ICON_MAP[item.type] ?? Zap}
                label={item.action}
                hint={item.module}
                right={<time className="text-[11px] text-q2-fog whitespace-nowrap tabular-nums">{item.time}</time>}
              />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
