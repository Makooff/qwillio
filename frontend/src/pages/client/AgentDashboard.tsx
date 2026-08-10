import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { motion } from 'framer-motion';
import {
  Mail, CreditCard, BookOpen, Package,
  Megaphone, Star, CalendarClock, LifeBuoy,
  Users, FileText, MapPin, Crosshair, LineChart,
  Plus, Activity, Zap, ChevronRight, ToggleLeft, ToggleRight
} from '../../components/icons';

type ModuleStatus = 'active' | 'setup_required' | 'paused';

interface Module {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  iconStyle: { color: string; background: string };
  status: ModuleStatus;
  enabled: boolean;
  href: string;
  /** Module shown as roadmap only — page is not functional yet, so the card
   *  does not link to it and cannot be toggled on. */
  comingSoon?: boolean;
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

const ICON_STYLES: Record<string, { color: string; background: string }> = {
  blue:       { color: 'oklch(60% 0.20 230)', background: 'oklch(60% 0.20 230 / 0.12)' },
  emerald:    { color: 'oklch(65% 0.17 162)', background: 'oklch(65% 0.17 162 / 0.12)' },
  indigo:     { color: 'oklch(56% 0.02 265)', background: 'oklch(56% 0.02 265 / 0.12)' },
  violet:     { color: 'oklch(67% 0.03 265)', background: 'oklch(67% 0.03 265 / 0.12)' },
  amber:      { color: 'oklch(75% 0.18 85)',  background: 'oklch(75% 0.18 85 / 0.12)'  },
};

const INITIAL_MODULES: Module[] = [
  {
    id: 'email',
    name: 'Email AI',
    description: 'Trie votre boîte de réception, répond seul et gère les emails de rendez-vous et de paiement.',
    icon: Mail,
    iconStyle: ICON_STYLES.blue,
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/email',
    comingSoon: true,
  },
  {
    id: 'payments',
    name: 'Payments AI',
    description: 'Envoie les demandes d’acompte, suit les paiements et relance par SMS automatiquement.',
    icon: CreditCard,
    iconStyle: ICON_STYLES.emerald,
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/payments',
    comingSoon: true,
  },
  {
    id: 'accounting',
    name: 'Accounting AI',
    description: 'Génère les factures, suit recettes et dépenses, et relance les impayés à échéance.',
    icon: BookOpen,
    iconStyle: ICON_STYLES.violet,
    status: 'paused',
    enabled: false,
    href: '/dashboard/agent/accounting',
    comingSoon: true,
  },
  {
    id: 'inventory',
    name: 'Inventory AI',
    description: 'Surveille les stocks, alerte avant la rupture et peut commander seul chez vos fournisseurs.',
    icon: Package,
    iconStyle: ICON_STYLES.amber,
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/inventory',
    comingSoon: true,
  },
  {
    id: 'marketing',
    name: 'Marketing AI',
    description: 'Rédige vos publications, vos emails de campagne et vos annonces, dans le ton de votre métier.',
    icon: Megaphone,
    iconStyle: ICON_STYLES.indigo,
    status: 'setup_required',
    enabled: false,
    comingSoon: true,
    href: '/dashboard/agent/marketing',
  },
  {
    id: 'reputation',
    name: 'Reputation AI',
    description: 'Surveille les avis Google et Facebook, propose les réponses, signale les mauvaises notes.',
    icon: Star,
    iconStyle: ICON_STYLES.amber,
    status: 'setup_required',
    enabled: false,
    comingSoon: true,
    href: '/dashboard/agent/reputation',
  },
  {
    id: 'scheduling',
    name: 'Scheduling AI',
    description: 'Optimise vos créneaux, réduit les absences par des rappels, conseille les meilleures heures.',
    icon: CalendarClock,
    iconStyle: ICON_STYLES.violet,
    status: 'setup_required',
    enabled: false,
    comingSoon: true,
    href: '/dashboard/agent/scheduling',
  },
  {
    id: 'support',
    name: 'Support AI',
    description: 'Trie les demandes entrantes, rédige les réponses, transmet les urgences à un humain.',
    icon: LifeBuoy,
    iconStyle: ICON_STYLES.emerald,
    status: 'setup_required',
    enabled: false,
    comingSoon: true,
    href: '/dashboard/agent/support',
  },
  {
    id: 'crm',
    name: 'CRM AI',
    description: 'Suivi du pipeline, synchronisation HubSpot, analyse des affaires perdues et prévision de chiffre.',
    icon: Users,
    iconStyle: ICON_STYLES.indigo,
    /* Le seul module OUVERT à ce jour. Sa page est routée et ses appels lisent
       des tables réelles. Les autres portent `comingSoon` non par prudence
       commerciale mais par honnêteté: leur lien « Configure » menait à une
       redirection vers l'accueil, ce qui se lit comme un produit cassé alors
       que la page n'avait simplement jamais été ouverte. */
    status: 'active',
    enabled: true,
    href: '/dashboard/agent/crm',
  },
  {
    id: 'document',
    name: 'Document AI',
    description: 'Génère devis, contrats et estimations à partir de vos éléments, prêts à signer.',
    icon: FileText,
    iconStyle: ICON_STYLES.violet,
    status: 'setup_required',
    enabled: false,
    comingSoon: true,
    href: '/dashboard/agent/document',
  },
  {
    id: 'local_seo',
    name: 'Local SEO AI',
    description: 'Publications Google Business, mots-clés locaux, audit de fiche et suivi de position.',
    icon: MapPin,
    iconStyle: ICON_STYLES.amber,
    status: 'setup_required',
    enabled: false,
    comingSoon: true,
    href: '/dashboard/agent/local-seo',
  },
  {
    id: 'lead_gen',
    name: 'Lead Gen AI',
    description: 'Trouve des prospects ciblés et déroule des séquences de prise de contact personnalisées.',
    icon: Crosshair,
    iconStyle: ICON_STYLES.blue,
    status: 'setup_required',
    enabled: false,
    comingSoon: true,
    href: '/dashboard/agent/lead-gen',
  },
  {
    id: 'analytics',
    name: 'Analytics AI',
    description: 'Bilan hebdomadaire, détection d’anomalies, prévisions et recommandations transverses.',
    icon: LineChart,
    iconStyle: ICON_STYLES.emerald,
    status: 'setup_required',
    enabled: false,
    comingSoon: true,
    href: '/dashboard/agent/analytics',
  },
];

const STATUS_CONFIG: Record<ModuleStatus, { label: string; dotColor: string; labelColor: string; bgColor: string }> = {
  active:         { label: 'Actif',          dotColor: 'oklch(65% 0.17 162)',        labelColor: 'oklch(65% 0.17 162)',        bgColor: 'oklch(65% 0.17 162 / 0.10)' },
  setup_required: { label: 'À configurer',   dotColor: 'oklch(75% 0.18 85)',         labelColor: 'oklch(75% 0.18 85)',         bgColor: 'oklch(75% 0.18 85 / 0.10)'  },
  paused:         { label: 'En pause',       dotColor: 'oklch(55% 0.00 0)',          labelColor: 'oklch(60% 0.00 0)',          bgColor: 'oklch(55% 0.00 0 / 0.10)'   },
};

const SURFACE  = 'oklch(8% 0.009 265)';
const CARD_BG  = 'rgba(255,255,255,0.025)';
const CARD_BORDER = 'rgba(255,255,255,0.07)';
const TEXT_PRIMARY   = '#F2F2F2';
const TEXT_SECONDARY = '#9A9AA5';
const INDIGO = 'oklch(56% 0.02 265)';
const INDIGO_HOVER = 'oklch(50% 0.02 265)';

export default function AgentDashboard() {
  const [modules, setModules] = useState<Module[]>(INITIAL_MODULES);

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

  return (
    <main aria-label="AI Agent Hub">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-[22px] font-semibold tracking-tight mb-1"
              style={{ color: TEXT_PRIMARY }}
            >
              AI Agent Hub
            </h1>
            <p className="text-[13px]" style={{ color: TEXT_SECONDARY }}>
              Vos modules autonomes
            </p>
          </div>
          <Link
            to="/dashboard/billing"
            aria-label="Ajouter un module"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: INDIGO,
              color: '#fff',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = INDIGO_HOVER)}
            onMouseLeave={e => (e.currentTarget.style.background = INDIGO)}
          >
            <Plus size={15} aria-hidden="true" />
            Ajouter un module
          </Link>
        </div>
      </motion.div>

      {/* Les quatre chiffres du mois ont été RETIRÉS.
          « 1 284 emails traités », « 14 320 $ encaissés », « 47 factures » :
          c'étaient des constantes écrites dans le fichier, présentées comme
          les chiffres du client. Un tableau de bord qui invente ses chiffres
          est pire qu'un tableau de bord vide, parce qu'on le croit. Ils
          reviendront branchés sur les vraies tables le jour où les modules
          qu'ils décrivent tourneront. */}

      {/* Module Cards */}
      <section aria-label="Modules" className="mb-8">
        <h2
          className="text-[13px] font-semibold uppercase tracking-wider mb-4"
          style={{ color: TEXT_SECONDARY }}
        >
          Your Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((mod, i) => {
            const Icon = mod.icon;
            const statusCfg = STATUS_CONFIG[mod.status];
            return (
              <motion.article
                key={mod.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                aria-label={mod.name}
                className="rounded-2xl p-6 transition-colors"
                style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: mod.iconStyle.background }}
                      aria-hidden="true"
                    >
                      <Icon size={22} style={{ color: mod.iconStyle.color }} />
                    </div>
                    <div>
                      <h3
                        className="text-[13px] font-semibold"
                        style={{ color: TEXT_PRIMARY }}
                      >
                        {mod.name}
                      </h3>
                      {mod.comingSoon ? (
                        <span
                          className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: 'oklch(67% 0.03 265 / 0.12)', color: 'oklch(67% 0.03 265)' }}
                          aria-label="Statut : bientôt disponible"
                        >
                          Bientôt disponible
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: statusCfg.bgColor, color: statusCfg.labelColor }}
                          aria-label={`Status: ${statusCfg.label}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: statusCfg.dotColor }}
                            aria-hidden="true"
                          />
                          {statusCfg.label}
                        </span>
                      )}
                    </div>
                  </div>
                  {!mod.comingSoon && (
                    <button
                      onClick={() => toggleModule(mod.id)}
                      aria-label={mod.enabled ? `Désactiver ${mod.name}` : `Activer ${mod.name}`}
                      aria-pressed={mod.enabled}
                      className="transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded"
                      style={{ color: mod.enabled ? INDIGO : TEXT_SECONDARY }}
                    >
                      {mod.enabled
                        ? <ToggleRight size={28} aria-hidden="true" />
                        : <ToggleLeft  size={28} aria-hidden="true" />
                      }
                    </button>
                  )}
                </div>
                <p
                  className="text-[13px] leading-relaxed mb-4"
                  style={{ color: TEXT_SECONDARY }}
                >
                  {mod.description}
                </p>
                {mod.comingSoon ? (
                  <span
                    className="inline-flex items-center gap-1 text-[12px] font-medium"
                    style={{ color: TEXT_SECONDARY }}
                  >
                    Bientôt disponible
                  </span>
                ) : (
                  <Link
                    to={mod.href}
                    aria-label={`Configurer ${mod.name}`}
                    className="inline-flex items-center gap-1 text-[12px] font-medium hover:underline focus:outline-none focus-visible:ring-2 rounded"
                    style={{ color: INDIGO }}
                  >
                    Configurer <ChevronRight size={12} aria-hidden="true" />
                  </Link>
                )}
              </motion.article>
            );
          })}
        </div>
      </section>

      {/* Le flux « Actions récentes de l'IA » a été RETIRÉ, pour la même
          raison et en pire: douze entrées écrites en dur (« Facture #1042
          générée pour Johnson & Co. », « Rappel d'acompte envoyé au
          +1 (555) 234-5678 »), sous une pastille « Live ». Elles décrivaient
          l'activité de modules qui, par construction, ne tournent pas. */}

    </main>
  );
}
