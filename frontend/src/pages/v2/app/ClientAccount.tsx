import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  Globe,
  HelpCircle,
  Lock,
  LogOut,
  MapPin,
  Shield,
  Sparkles,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../../../stores/authStore';
import { useToast } from '../../../hooks/useToast';
import ToastContainer from '../../../components/ui/Toast';
import api from '../../../services/api';
import { Card, Field, PageActions, Pill, Row, SectionHead } from '../../../components/v2/app/Blocks';

/* Compte V2 « instrument », géométrie de la V1 client (rangées repliables,
   carte identité, sections en liste). Endpoints inchangés:
   GET /my-dashboard/settings, PUT /my-dashboard/profile,
   PUT /my-dashboard/password, PUT /my-dashboard/notifications,
   PUT /my-dashboard/settings (identité de l'agent et coordonnées).
   Le h1 est rendu par AppShell. */

type PlanType = 'starter' | 'pro' | 'enterprise';

const PLAN_LABELS: Record<PlanType, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

/* Verticales: même liste que la page Réceptionniste, mêmes valeurs stockées. */
const BUSINESS_TYPES: { v: string; l: string }[] = [
  { v: 'dental', l: 'Dentaire' },
  { v: 'medical', l: 'Médical' },
  { v: 'law', l: 'Juridique' },
  { v: 'salon', l: 'Salon' },
  { v: 'restaurant', l: 'Restaurant' },
  { v: 'garage', l: 'Garage auto' },
  { v: 'hotel', l: 'Hôtel' },
  { v: 'home_services', l: 'Services maison' },
  { v: 'other', l: 'Autre' },
];

/* La V1 posait ses champs sur un fond plus clair que la surface de la carte.
   C'est ce qui les faisait lire comme des zones de saisie sans ajouter de trait. */
const accInput =
  'w-full min-h-[44px] sm:min-h-0 rounded-xl border border-q2-graphite-d bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-white placeholder:text-q2-fog focus:outline-none focus:border-q2-indigo/60 focus:ring-2 focus:ring-q2-indigo/25 transition-colors duration-150 disabled:opacity-50';

/** Rangée dépliable. Le kit a bien la rangée de réglage, mais pas la variante
    accordéon : même géométrie, chevron qui bascule, panneau en dessous. */
function AccRow({
  icon: Icon,
  label,
  hint,
  open,
  onToggle,
  first = false,
  children,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full min-h-[52px] sm:min-h-[56px] flex items-center justify-between gap-3 px-3.5 sm:px-4 text-left hover:bg-q2-obsidian/60 transition-colors duration-100 focus:outline-none focus-visible:bg-q2-obsidian ${
          first ? '' : 'border-t border-q2-graphite-d'
        }`}
      >
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
          <span className="w-8 h-8 shrink-0 rounded-lg bg-q2-obsidian flex items-center justify-center">
            <Icon size={15} aria-hidden="true" className="text-q2-lift" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] sm:text-[13.5px] font-medium text-white truncate">{label}</p>
            {hint && <p className="text-[11.5px] text-q2-fog truncate">{hint}</p>}
          </div>
        </div>
        {open ? (
          <ChevronDown size={14} className="text-q2-fog shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight size={14} className="text-q2-fog shrink-0" aria-hidden="true" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-q2-graphite-d"
          >
            <div className="p-4 sm:p-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* Bouton primaire inversé de la V1: fond clair, texte sombre, coin de la carte. */
function InvertBtn({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-9 px-4 rounded-xl bg-q2-mist text-q2-void text-[12.5px] font-medium hover:bg-white transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 disabled:opacity-50 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}

/* Toggle vert de la V1: l'état « activé » d'une notification est un état de
   santé, pas un accent de marque. */
function GreenToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative w-[38px] h-[22px] shrink-0 rounded-full transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 after:content-[''] after:absolute after:-inset-[11px] sm:after:hidden"
      style={{ background: checked ? 'var(--q2p-ok)' : 'rgba(255,255,255,0.10)' }}
    >
      <span
        className="absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform duration-150"
        style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
      />
    </button>
  );
}

function SavedMark({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12px] flex items-center gap-1.5" style={{ color: 'var(--q2p-ok)' }}>
      <Check size={13} aria-hidden="true" /> {children}
    </span>
  );
}

export default function ClientAccount() {
  const { user, checkAuth, logout } = useAuthStore();
  const { toasts, add: addToast, remove: removeToast } = useToast();
  const navigate = useNavigate();

  const [open, setOpen] = useState<string | null>(null);
  const toggle = (k: string) => setOpen((o) => (o === k ? null : k));

  const [name, setName] = useState(user?.name ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState('');

  const [notifEmail, setNotifEmail] = useState(true);
  const [notifWeekly, setNotifWeekly] = useState(true);
  const [notifLeads, setNotifLeads] = useState(true);
  const [notifQuota, setNotifQuota] = useState(true);

  // Identité de l'agent et coordonnées: mêmes clés que la page Réceptionniste,
  // PUT /my-dashboard/settings n'écrit que les clés envoyées.
  const [agentLanguage, setAgentLanguage] = useState('fr');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [agentSaving, setAgentSaving] = useState(false);
  const [agentSaved, setAgentSaved] = useState(false);

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactSaving, setContactSaving] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);

  useEffect(() => {
    api
      .get('/my-dashboard/settings')
      .then((res) => {
        const s = res.data ?? {};
        const notif = s.vapiConfig?.notifications as
          | {
              notifEmail?: boolean;
              notifWeekly?: boolean;
              notifLeads?: boolean;
              notifQuota?: boolean;
            }
          | undefined;
        if (notif) {
          if (typeof notif.notifEmail === 'boolean') setNotifEmail(notif.notifEmail);
          if (typeof notif.notifWeekly === 'boolean') setNotifWeekly(notif.notifWeekly);
          if (typeof notif.notifLeads === 'boolean') setNotifLeads(notif.notifLeads);
          if (typeof notif.notifQuota === 'boolean') setNotifQuota(notif.notifQuota);
        }
        setAgentLanguage(s.agentLanguage || 'fr');
        setBusinessName(s.businessName || '');
        setBusinessType(s.businessType || '');
        setAddress(s.address || '');
        setCity(s.city || '');
        setPostalCode(s.postalCode || '');
        setContactPhone(s.contactPhone || '');
      })
      .catch(() => {
        /* valeurs par défaut conservées */
      });
  }, []);

  const saveNotifications = useCallback(
    (vals: { notifEmail: boolean; notifWeekly: boolean; notifLeads: boolean; notifQuota: boolean }) => {
      api.put('/my-dashboard/notifications', vals).catch(() => {
        /* best effort */
      });
    },
    [],
  );

  const handleUpdateProfile = async () => {
    setProfileSaving(true);
    try {
      await api.put('/my-dashboard/profile', { name });
      setProfileSaved(true);
      checkAuth();
      setTimeout(() => setProfileSaved(false), 2000);
    } catch {
      /* silencieux */
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError('');
    if (newPw !== confirmPw) {
      setPwError('Les mots de passe ne correspondent pas');
      return;
    }
    if (newPw.length < 6) {
      setPwError('Minimum 6 caractères');
      return;
    }
    setPwSaving(true);
    try {
      await api.put('/my-dashboard/password', { currentPassword: currentPw, newPassword: newPw });
      setPwSaved(true);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setTimeout(() => setPwSaved(false), 2000);
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setPwError(errMsg ?? 'Erreur lors du changement');
    } finally {
      setPwSaving(false);
    }
  };

  const saveAgentIdentity = async () => {
    setAgentSaving(true);
    try {
      await api.put('/my-dashboard/settings', { agentLanguage, businessName, businessType });
      setAgentSaved(true);
      setTimeout(() => setAgentSaved(false), 2000);
    } catch {
      addToast("Impossible d'enregistrer l'identité de l'agent", 'error');
    } finally {
      setAgentSaving(false);
    }
  };

  const saveContactDetails = async () => {
    setContactSaving(true);
    try {
      await api.put('/my-dashboard/settings', { address, city, postalCode, contactPhone });
      setContactSaved(true);
      setTimeout(() => setContactSaved(false), 2000);
    } catch {
      addToast('Impossible d\'enregistrer les coordonnées', 'error');
    } finally {
      setContactSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials =
    (user?.name ?? 'U')
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';
  const rawPlan = (user as unknown as Record<string, unknown> | undefined)?.planType;
  const planType: PlanType = rawPlan === 'starter' || rawPlan === 'enterprise' ? rawPlan : 'pro';
  const planLabel = PLAN_LABELS[planType];

  const notifications = [
    {
      key: 'email',
      label: 'Notifications email',
      desc: 'Évènements importants',
      checked: notifEmail,
      set: (v: boolean) => {
        setNotifEmail(v);
        saveNotifications({ notifEmail: v, notifWeekly, notifLeads, notifQuota });
      },
    },
    {
      key: 'weekly',
      label: 'Rapport hebdomadaire',
      desc: 'Résumé chaque lundi',
      checked: notifWeekly,
      set: (v: boolean) => {
        setNotifWeekly(v);
        saveNotifications({ notifEmail, notifWeekly: v, notifLeads, notifQuota });
      },
    },
    {
      key: 'leads',
      label: 'Nouveaux leads',
      desc: 'Alerte à chaque capture',
      checked: notifLeads,
      set: (v: boolean) => {
        setNotifLeads(v);
        saveNotifications({ notifEmail, notifWeekly, notifLeads: v, notifQuota });
      },
    },
    {
      key: 'quota',
      label: 'Alertes quota',
      desc: 'Seuil 80 % et 100 %',
      checked: notifQuota,
      set: (v: boolean) => {
        setNotifQuota(v);
        saveNotifications({ notifEmail, notifWeekly, notifLeads, notifQuota: v });
      },
    },
  ];

  const agentHint = [businessName || null, agentLanguage === 'en' ? 'English' : 'Français'].filter(Boolean).join(', ') || 'Langue, entreprise';

  return (
    <div className="max-w-[720px] space-y-4 sm:space-y-6">
      <ToastContainer toasts={toasts} remove={removeToast} />

      <PageActions subtitle="Profil, sécurité, agent, coordonnées, notifications." />

      {/* Identité */}
      <Card className="flex items-center gap-3.5 sm:gap-4">
        <span
          className="w-[52px] h-[52px] sm:w-[60px] sm:h-[60px] shrink-0 rounded-full border border-q2-graphite-d flex items-center justify-center text-[18px] sm:text-[20px] font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #252529 0%, #141417 100%)' }}
        >
          {initials}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] sm:text-[16px] font-medium text-white truncate">{user?.name ?? 'Utilisateur'}</p>
          <p className="text-[12.5px] text-q2-fog truncate">{user?.email}</p>
        </div>
        <Pill className="uppercase tracking-[0.06em]">{planLabel}</Pill>
      </Card>

      {/* Compte */}
      <section>
        <SectionHead title="Compte" />
        <Card pad={false}>
          <AccRow
            first
            icon={User}
            label="Informations personnelles"
            hint="Nom affiché, email"
            open={open === 'profile'}
            onToggle={() => toggle('profile')}
          >
            <div className="space-y-2.5 sm:space-y-3">
              <Field label="Nom complet">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={accInput} />
              </Field>
              <Field label="Email" hint="L'adresse de connexion ne peut pas être modifiée ici.">
                <input type="email" value={user?.email ?? ''} disabled className={accInput} />
              </Field>
              <div className="flex items-center gap-3 pt-1">
                <InvertBtn type="button" onClick={handleUpdateProfile} disabled={profileSaving}>
                  {profileSaving ? 'Enregistrement…' : 'Sauvegarder'}
                </InvertBtn>
                {profileSaved && <SavedMark>Sauvegardé</SavedMark>}
              </div>
            </div>
          </AccRow>

          <AccRow
            icon={Lock}
            label="Sécurité"
            hint="Mot de passe, authentification"
            open={open === 'security'}
            onToggle={() => toggle('security')}
          >
            <div className="space-y-2.5 sm:space-y-3">
              <Field label="Mot de passe actuel">
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    className={`${accInput} pr-10`}
                  />
                  <button
                    type="button"
                    aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-q2-fog hover:text-q2-mist transition-colors duration-150"
                  >
                    {showPw ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                  </button>
                </div>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <Field label="Nouveau mot de passe">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className={accInput}
                  />
                </Field>
                <Field label="Confirmer">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    className={accInput}
                  />
                </Field>
              </div>

              {pwError && (
                <p className="text-[12px]" style={{ color: 'var(--q2p-bad)' }}>
                  {pwError}
                </p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <InvertBtn
                  type="button"
                  onClick={handleChangePassword}
                  disabled={pwSaving || !currentPw || !newPw}
                >
                  {pwSaving ? 'Changement…' : 'Changer le mot de passe'}
                </InvertBtn>
                {pwSaved && <SavedMark>Changé</SavedMark>}
              </div>
            </div>
          </AccRow>

          <AccRow
            icon={Bell}
            label="Notifications"
            hint="Emails, rapport, alertes"
            open={open === 'notif'}
            onToggle={() => toggle('notif')}
          >
            <div>
              {notifications.map((n, i, arr) => (
                <div
                  key={n.key}
                  className={`flex items-center justify-between gap-3 sm:gap-4 py-2.5 ${
                    i < arr.length - 1 ? 'border-b border-q2-graphite-d' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-white truncate">{n.label}</p>
                    <p className="text-[11.5px] text-q2-fog truncate">{n.desc}</p>
                  </div>
                  <GreenToggle checked={n.checked} onChange={n.set} label={n.label} />
                </div>
              ))}
            </div>
          </AccRow>

          <AccRow
            icon={Bot}
            label="Entreprise et langue"
            hint={agentHint}
            open={open === 'agent'}
            onToggle={() => toggle('agent')}
          >
            <div className="space-y-2.5 sm:space-y-3">
              {/* Le nom de l'agent se choisit sur la page Réceptionniste (carrousel),
                  pas ici: seuls langue et entreprise vivent dans le compte. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <Field label="Langue" hint="Langue parlée par votre réceptionniste IA">
                  <select
                    value={agentLanguage}
                    onChange={(e) => setAgentLanguage(e.target.value)}
                    className={accInput}
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </Field>
                <Field label="Nom de l'entreprise" hint="Utilisé par l'IA pour se présenter au téléphone">
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Ex: Plomberie Dupont"
                    className={accInput}
                  />
                </Field>
                <Field label="Type d'entreprise">
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className={accInput}
                  >
                    <option value="">Sélectionner...</option>
                    {BUSINESS_TYPES.map((b) => (
                      <option key={b.v} value={b.v}>
                        {b.l}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <InvertBtn type="button" onClick={saveAgentIdentity} disabled={agentSaving}>
                  {agentSaving ? 'Enregistrement…' : 'Enregistrer'}
                </InvertBtn>
                {agentSaved && <SavedMark>Enregistré</SavedMark>}
              </div>
              <p className="text-[11px] text-q2-fog">
                Voix, personnalité et base de connaissances se règlent sur la page Réceptionniste IA.
              </p>
            </div>
          </AccRow>

          <AccRow
            icon={MapPin}
            label="Coordonnées"
            hint={[address, city].filter(Boolean).join(', ') || 'Adresse, téléphone de contact'}
            open={open === 'contact'}
            onToggle={() => toggle('contact')}
          >
            <div className="space-y-2.5 sm:space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <Field label="Téléphone de contact">
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className={accInput}
                  />
                </Field>
                <Field label="Adresse">
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Rue Principale"
                    className={accInput}
                  />
                </Field>
                <Field label="Ville">
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Montréal"
                    className={accInput}
                  />
                </Field>
                <Field label="Code postal">
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="H2X 1Y4"
                    className={accInput}
                  />
                </Field>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <InvertBtn type="button" onClick={saveContactDetails} disabled={contactSaving}>
                  {contactSaving ? 'Enregistrement…' : 'Enregistrer'}
                </InvertBtn>
                {contactSaved && <SavedMark>Enregistré</SavedMark>}
              </div>
            </div>
          </AccRow>
        </Card>
      </section>

      {/* Raccourcis Qwillio */}
      <section>
        <SectionHead title="Qwillio" />
        <Card pad={false}>
          <Row
            first
            icon={Bot}
            label="Réceptionniste IA"
            hint="Voix, scripts, transferts d'appel"
            to="/dashboard/receptionist"
          />
          <Row
            icon={Sparkles}
            label="Plan & usage"
            hint={`Plan ${planLabel}`}
            right={<span className="text-[11.5px] text-q2-fog">Gérer</span>}
            to="/dashboard/billing"
          />
          <Row
            icon={CreditCard}
            label="Moyens de paiement"
            hint="Carte, facturation, factures"
            to="/dashboard/billing"
          />
          <Row
            icon={Globe}
            label="Renvoi d'appel"
            hint="iPhone ou Android, guide pas à pas"
            to="/dashboard/setup/call-forwarding"
          />
        </Card>
      </section>

      {/* Préférences */}
      <section>
        <SectionHead title="Préférences" />
        <Card pad={false}>
          <Row
            first
            icon={Shield}
            label="Confidentialité"
            hint="Exporter mes données, consentements"
            onClick={() => addToast('Bientôt disponible', 'info')}
          />
          <Row icon={HelpCircle} label="Support & aide" hint="Centre d'aide, contact" to="/dashboard/support" />
        </Card>
      </section>

      {/* Déconnexion */}
      <Card pad={false}>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full min-h-[52px] sm:min-h-[56px] flex items-center gap-3 sm:gap-3.5 px-3.5 sm:px-4 text-left rounded-xl hover:bg-red-500/[0.05] transition-colors duration-100 focus:outline-none focus-visible:bg-red-500/[0.05]"
        >
          <span
            className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center"
            style={{ background: 'color-mix(in oklch, var(--q2p-bad) 12%, transparent)' }}
          >
            <LogOut size={15} aria-hidden="true" style={{ color: 'var(--q2p-bad)' }} />
          </span>
          <span className="text-[13px] sm:text-[13.5px] font-medium" style={{ color: 'var(--q2p-bad)' }}>
            Se déconnecter
          </span>
        </button>
      </Card>

      <p className="text-center text-[11px] text-q2-fog pt-1">Qwillio · {user?.email}</p>
    </div>
  );
}
