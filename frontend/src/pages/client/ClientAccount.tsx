import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, Check, Bell, LogOut, Eye, EyeOff, ChevronRight,
  CreditCard, Bot, HelpCircle, Sparkles, Shield, Globe,
  Building2, MapPin,
  LucideIcon,
} from '../../components/icons';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import { fetchLive, invalidateLive } from '../../services/liveData';

const C = {
  bg:       '#0A0A0C',
  panel:    'rgba(255,255,255,0.03)',
  border:   'rgba(255,255,255,0.07)',
  borderHi: 'rgba(255,255,255,0.12)',
  text:     '#F5F5F7',
  textSec:  '#A1A1A8',
  textTer:  '#6B6B75',
  accent:   '#7349fe',
  ok:       '#22C55E',
  bad:      '#EF4444',
};

const inputCls =
  'w-full px-3.5 py-2.5 text-[13px] rounded-xl border bg-white/[0.03] text-[#F5F5F7] placeholder-[#6B6B75] focus:outline-none transition-colors disabled:opacity-50';

// ── Building blocks ─────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`rounded-2xl border overflow-hidden ${className}`} style={{ background: C.panel, borderColor: C.border }}>
      {children}
    </div>
  );
}

interface SectionHeadProps {
  title: string;
}

function SectionHead({ title }: SectionHeadProps) {
  return (
    <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] mb-3 px-1" style={{ color: C.textSec }}>{title}</h2>
  );
}

interface RowProps {
  icon: LucideIcon;
  label: string;
  hint?: string;
  badge?: React.ReactNode;
  onClick?: () => void;
  to?: string;
  danger?: boolean;
}

function Row({ icon: Icon, label, hint, badge, onClick, to, danger }: RowProps) {
  const inner = (
    <div className={`flex items-center gap-3.5 px-4 h-[58px] group transition-colors
      ${danger ? 'hover:bg-red-500/[0.05]' : 'hover:bg-white/[0.02]'}`}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
           style={{ background: danger ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.05)' }}>
        <Icon size={14} style={{ color: danger ? C.bad : C.text }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate" style={{ color: danger ? C.bad : C.text }}>{label}</p>
        {hint && <p className="text-[11.5px] truncate" style={{ color: C.textTer }}>{hint}</p>}
      </div>
      {badge}
      {(onClick || to) && <ChevronRight size={14} style={{ color: C.textTer }} className="opacity-60 group-hover:opacity-100 transition-opacity" />}
    </div>
  );
  if (to) return <Link to={to} className="block">{inner}</Link>;
  return <button type="button" data-radius="keep" onClick={onClick} className="w-full text-left">{inner}</button>;
}

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative w-[38px] h-[22px] rounded-full flex-shrink-0 transition-colors"
      style={{ background: checked ? C.ok : 'rgba(255,255,255,0.10)' }}
    >
      <span className="absolute top-[2px] left-[2px] w-[18px] h-[18px] bg-white rounded-full shadow transition-transform"
        style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }} />
    </button>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

type PlanType = 'solo' | 'starter' | 'pro' | 'enterprise';

const PLAN_LABELS: Record<PlanType, string> = {
  solo:       'Solo',
  starter:    'Starter',
  pro:        'Pro',
  enterprise: 'Enterprise',
};

/**
 * Les métiers proposés. La liste vit ici parce que c'est ici qu'on la choisit
 * désormais; elle était sur Réceptionniste, avec les mêmes valeurs.
 */
const BUSINESS_TYPES: { value: string; label: string }[] = [
  { value: '',              label: 'Sélectionner...' },
  { value: 'dental',        label: 'Dentaire' },
  { value: 'medical',       label: 'Médical' },
  { value: 'law',           label: 'Juridique' },
  { value: 'salon',         label: 'Salon' },
  { value: 'restaurant',    label: 'Restaurant' },
  { value: 'garage',        label: 'Garage auto' },
  { value: 'hotel',         label: 'Hôtel' },
  { value: 'home_services', label: 'Services maison' },
  { value: 'other',         label: 'Autre' },
];

const selectCls =
  'w-full px-3.5 py-2.5 text-[13px] rounded-xl border bg-white/[0.03] text-[#F5F5F7] focus:outline-none transition-colors appearance-none';

// ── Main page ────────────────────────────────────────────────────────────────

export default function ClientAccount() {
  const { user, checkAuth, logout } = useAuthStore();
  const { toasts, add: addToast, remove: removeToast } = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  /* Changement d'adresse de connexion. L'ancien champ « Email » était
     `disabled`: le compte n'offrait aucun moyen de changer d'adresse, et un
     client qui quitte son fournisseur de messagerie perdait l'accès à son
     propre tableau de bord. */
  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const [emailError, setEmailError] = useState('');
  /* Suppression du compte (RGPD art. 17). */
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletePw, setDeletePw] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState('');

  const [notifEmail, setNotifEmail] = useState(true);
  const [notifWeekly, setNotifWeekly] = useState(true);
  const [notifLeads, setNotifLeads] = useState(true);
  const [notifQuota, setNotifQuota] = useState(true);

  /**
   * L'entreprise et ses coordonnées.
   *
   * Elles vivaient sur Réceptionniste, entre la voix de l'agent et ses scripts,
   * alors qu'elles ne décrivent pas l'agent: elles décrivent le client. Elles
   * sont ici, et ELLES NE SONT PLUS ENVOYÉES PAR RÉCEPTIONNISTE — les deux vont
   * ensemble. Cette page et l'autre écrivent sur la même route, dont le PUT est
   * partiel: si Réceptionniste continuait à poster sa copie de `businessName`,
   * son autosave réécrirait par-dessus ce qui vient d'être tapé ici, avec une
   * valeur figée au chargement de sa page. Rien ne s'afficherait de travers, la
   * donnée disparaîtrait simplement.
   */
  const [agentLanguage, setAgentLanguage] = useState('fr');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  /* Le numéro de TVA vit ici, avec le nom et le métier (demande utilisateur):
     c'est une donnée d'IDENTITÉ de l'entreprise, pas un état d'abonnement. Il
     était sur la page Facturation, où on ne va que pour lire une facture, et
     où personne ne pense à aller renseigner l'identité de sa société.
     Le champ a QUITTÉ Facturation en même temps qu'il arrive ici: laisser les
     deux aurait donné deux sources pour une valeur, dont la dernière
     enregistrée gagne. */
  const [vatNumber, setVatNumber] = useState('');
  /* Le chargement a-t-il réussi, question distincte de « le champ est-il
     vide ». Sans elle, un échec de `GET /settings` laisse le champ vide et le
     bouton actif: un clic effacerait alors un numéro qu'on n'a jamais lu. */
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  /* Non modifiables ici: ils viennent du contrat, pas des préférences. */
  const [readOnly, setReadOnly] = useState<{ contactName?: string; contactEmail?: string; country?: string }>({});
  const [bizSaving, setBizSaving] = useState(false);
  const [bizSaved, setBizSaved] = useState(false);
  const [bizError, setBizError] = useState('');

  useEffect(() => {
    // Same settings the Réceptionniste tab reads, warmed at launch: from the
    // cache it is already there, so the toggles never render at their defaults
    // and then jump.
    fetchLive<any>('/my-dashboard/settings').then((data) => {
      const notif = data?.vapiConfig?.notifications as {
        notifEmail?: boolean;
        notifWeekly?: boolean;
        notifLeads?: boolean;
        notifQuota?: boolean;
      } | undefined;
      if (notif) {
        if (typeof notif.notifEmail  === 'boolean') setNotifEmail(notif.notifEmail);
        if (typeof notif.notifWeekly === 'boolean') setNotifWeekly(notif.notifWeekly);
        if (typeof notif.notifLeads  === 'boolean') setNotifLeads(notif.notifLeads);
        if (typeof notif.notifQuota  === 'boolean') setNotifQuota(notif.notifQuota);
      }
      if (data?.agentLanguage) setAgentLanguage(data.agentLanguage);
      setBusinessName(data?.businessName || '');
      setBusinessType(data?.businessType || '');
      setContactPhone(data?.contactPhone || '');
      setAddress(data?.address || '');
      setCity(data?.city || '');
      setPostalCode(data?.postalCode || '');
      setVatNumber(data?.vatNumber || '');
      setSettingsLoaded(true);
      setReadOnly({ contactName: data?.contactName, contactEmail: data?.contactEmail, country: data?.country });
    }).catch(() => { /* keep defaults */ });
  }, []);

  /**
   * Enregistrement explicite, au bouton, et non en autosave.
   *
   * Réceptionniste sauvegarde toute seule 900 ms après la dernière frappe. Ici
   * on écrit le nom de l'entreprise et la langue de l'agent: deux valeurs qui
   * partent droit dans le prompt de l'assistant et déclenchent une resync Vapi
   * côté serveur. Les enregistrer à chaque lettre tapée ferait resynchroniser
   * l'assistant une fois par caractère.
   */
  const saveBusiness = async () => {
    setBizSaving(true);
    setBizError('');
    try {
      // Charge utile partielle: uniquement les champs de cette page. Le PUT
      // côté serveur ne touche que ce qu'il reçoit, donc les scripts, horaires
      // et voix réglés sur Réceptionniste ne sont pas concernés.
      await api.put('/my-dashboard/settings', {
        agentLanguage, businessName, businessType,
        contactPhone, address, city, postalCode,
        /* Le numéro de TVA n'est envoyé QUE si les réglages ont bien été lus.
           Le PUT est partiel côté serveur (`if (body.x !== undefined)`), donc
           l'omettre le laisse intact; l'envoyer vide après un chargement raté
           l'effacerait. */
        ...(settingsLoaded ? { vatNumber } : {}),
      });
      invalidateLive('/my-dashboard/');
      setBizSaved(true);
      setTimeout(() => setBizSaved(false), 2000);
    } catch {
      setBizError("L'enregistrement a échoué. Réessayez dans un instant.");
    } finally {
      setBizSaving(false);
    }
  };

  const saveNotifications = useCallback((vals: {
    notifEmail: boolean; notifWeekly: boolean; notifLeads: boolean; notifQuota: boolean;
  }) => {
    api.put('/my-dashboard/notifications', vals).catch(() => { /* best-effort */ });
  }, []);

  const [open, setOpen] = useState<string | null>(null);
  const toggle = (k: string) => setOpen(o => (o === k ? null : k));

  const handleUpdateProfile = async () => {
    setProfileSaving(true);
    try {
      await api.put('/my-dashboard/profile', { name });
      setProfileSaved(true);
      checkAuth();
      setTimeout(() => setProfileSaved(false), 2000);
    } catch { /* silent */ }
    finally { setProfileSaving(false); }
  };

  /* La bascule d'adresse ne se fait PAS ici: la route enregistre la demande et
     envoie un lien à la NOUVELLE adresse. Tant qu'il n'est pas cliqué, la
     connexion continue avec l'ancienne, et une faute de frappe reste sans
     conséquence. La page dit donc « vérifiez votre boîte », jamais « c'est
     changé ». */
  const handleChangeEmail = async () => {
    setEmailError('');
    setEmailSent(null);
    setEmailSaving(true);
    try {
      const { data } = await api.put('/my-dashboard/email', { newEmail: newEmail.trim(), currentPassword: emailPw });
      setEmailSent(data?.pendingEmail || newEmail.trim());
      setNewEmail('');
      setEmailPw('');
    } catch (e: any) {
      setEmailError(e?.response?.data?.error || "La demande n'a pas abouti. Réessayez.");
    } finally {
      setEmailSaving(false);
    }
  };

  /* La suppression est définitive et emporte l'abonnement: le nom exact de
     l'entreprise est exigé, tapé à la main. Un « oui » se clique sans lire.
     Au retour, on déconnecte: la session pointe sur un compte qui n'existe
     plus, et toute requête suivante répondrait 401 sans rien expliquer. */
  const handleDeleteAccount = async () => {
    setDeleteError('');
    setDeleting(true);
    try {
      await api.delete('/my-dashboard/account', { data: { password: deletePw, confirm: deleteConfirm } });
      logout();
    } catch (e: any) {
      setDeleteError(e?.response?.data?.error || "La suppression n'a pas abouti. Réessayez, ou écrivez-nous.");
    } finally {
      setDeleting(false);
    }
  };

  /* Le fichier est reçu en mémoire puis rendu téléchargeable, plutôt que
     d'ouvrir la route dans un onglet: elle est authentifiée par un en-tête que
     seule la couche `api` porte, et une navigation ordinaire repartirait avec
     un 401. L'URL temporaire est libérée derrière, sinon le fichier reste en
     mémoire tant que l'onglet vit. */
  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await api.get('/my-dashboard/export', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `qwillio-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Export impossible pour le moment. Réessayez dans une minute.');
    } finally {
      setExporting(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError('');
    if (newPw !== confirmPw) { setPwError('Les mots de passe ne correspondent pas'); return; }
    if (newPw.length < 6)    { setPwError('Minimum 6 caractères'); return; }
    setPwSaving(true);
    try {
      await api.put('/my-dashboard/password', { currentPassword: currentPw, newPassword: newPw });
      setPwSaved(true);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => setPwSaved(false), 2000);
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setPwError(errMsg ?? 'Erreur lors du changement');
    } finally { setPwSaving(false); }
  };

  const initials = (user?.name ?? 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  /* Tout ce qui n'était ni `starter` ni `enterprise` retombait sur « PRO »,
     y compris SOLO, le forfait d'entrée: le client d'entrée de gamme lisait
     donc le nom d'un forfait plus cher que le sien sur sa page de compte.
     Le libellé vient du forfait quand on le connaît, et de rien sinon. */
  const rawPlan = (user as unknown as Record<string, unknown> | undefined)?.planType;
  const planType: PlanType | null =
    typeof rawPlan === 'string' && rawPlan in PLAN_LABELS ? (rawPlan as PlanType) : null;
  const planLabel = planType ? PLAN_LABELS[planType] : 'Non défini';

  return (
    <div className="max-w-[720px] space-y-6">
      <ToastContainer toasts={toasts} remove={removeToast} />

      {/* ─── Header ─── */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: C.text }}>Paramètres du compte</h1>
        <p className="text-[12.5px] mt-0.5" style={{ color: C.textSec }}>Profil, sécurité, notifications, abonnement.</p>
      </motion.div>

      {/* ─── Identity ─── */}
      <Card>
        <div className="p-5 flex items-center gap-4">
          <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center flex-shrink-0"
               style={{ background: 'linear-gradient(135deg, #252529 0%, #141417 100%)', border: `1px solid ${C.border}` }}>
            <span className="text-[20px] font-semibold" style={{ color: C.text }}>{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-semibold truncate" style={{ color: C.text }}>{user?.name ?? 'Utilisateur'}</p>
            <p className="text-[12.5px] truncate" style={{ color: C.textSec }}>{user?.email}</p>
          </div>
          <span className="text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.06)', color: C.text }}>
            {planLabel}
          </span>
        </div>
      </Card>

      {/* ─── Compte ─── */}
      <section>
        <SectionHead title="Compte" />
        <Card>
          <Row icon={User} label="Informations personnelles" hint="Nom affiché, email"
               onClick={() => toggle('profile')} />
          <AnimatePresence initial={false}>
            {open === 'profile' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }} className="overflow-hidden" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="p-5 space-y-3">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Nom complet</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)}
                      className={inputCls + ' mt-1.5'}
                      style={{ borderColor: C.border }}
                      onFocus={e => e.currentTarget.style.borderColor = C.borderHi}
                      onBlur={e => e.currentTarget.style.borderColor = C.border} />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Email de connexion</label>
                    <input type="email" value={user?.email ?? ''} disabled
                      className={inputCls + ' mt-1.5'} style={{ borderColor: C.border }} />
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleUpdateProfile}
                      disabled={profileSaving}
                      className="px-4 h-9 text-[12.5px] font-medium rounded-xl disabled:opacity-50 transition-colors"
                      style={{ background: C.text, color: '#0B0B0D' }}
                    >
                      {profileSaving ? 'Enregistrement…' : 'Sauvegarder'}
                    </button>
                    {profileSaved && <span className="text-[12px] flex items-center gap-1" style={{ color: C.ok }}><Check size={13} /> Sauvegardé</span>}
                  </div>

                  {/* CHANGER D'ADRESSE. En deux temps, volontairement: la
                      nouvelle adresse reçoit un lien, et c'est lui qui fait
                      basculer le compte. Le mot de passe est redemandé, parce
                      qu'une session laissée ouverte sur un poste partagé ne
                      doit pas suffire à détourner un compte. */}
                  <div className="pt-4 space-y-3" style={{ borderTop: `1px solid ${C.border}` }}>
                    <div>
                      <p className="text-[12.5px]" style={{ color: C.text }}>Changer d'adresse</p>
                      <p className="text-[12px] mt-0.5" style={{ color: C.textTer }}>
                        Un lien part vers la nouvelle adresse. Tant qu'il n'est pas ouvert, vous vous connectez avec l'ancienne.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Nouvelle adresse</label>
                        <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                          autoComplete="email" placeholder="vous@exemple.be"
                          className={inputCls + ' mt-1.5'} style={{ borderColor: C.border }} />
                      </div>
                      <div>
                        <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Mot de passe actuel</label>
                        <input type="password" value={emailPw} onChange={e => setEmailPw(e.target.value)}
                          autoComplete="current-password"
                          className={inputCls + ' mt-1.5'} style={{ borderColor: C.border }} />
                      </div>
                    </div>
                    {emailError && <p className="text-[12px]" style={{ color: C.bad }}>{emailError}</p>}
                    {emailSent && (
                      <p className="text-[12px] flex items-start gap-1.5" style={{ color: C.ok }}>
                        <Check size={13} className="mt-0.5 flex-shrink-0" />
                        <span>Lien envoyé à {emailSent}. Ouvrez-le pour confirmer.</span>
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleChangeEmail}
                      disabled={emailSaving || !newEmail.trim() || !emailPw}
                      className="px-4 h-9 text-[12.5px] font-medium rounded-xl disabled:opacity-50 transition-colors"
                      style={{ border: `1px solid ${C.border}`, color: C.text }}
                    >
                      {emailSaving ? 'Envoi…' : 'Envoyer le lien de confirmation'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ borderTop: `1px solid ${C.border}` }} />
          <Row icon={Lock} label="Sécurité" hint="Mot de passe, authentification"
               onClick={() => toggle('security')} />
          <AnimatePresence initial={false}>
            {open === 'security' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }} className="overflow-hidden" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="p-5 space-y-3">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Mot de passe actuel</label>
                    <div className="relative mt-1.5">
                      <input type={showPw ? 'text' : 'password'} value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                        className={inputCls + ' pr-10'} style={{ borderColor: C.border }} />
                      <button
                        type="button"
                        aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        onClick={() => setShowPw(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: C.textSec }}
                      >
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Nouveau</label>
                      <input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)}
                        className={inputCls + ' mt-1.5'} style={{ borderColor: C.border }} />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Confirmer</label>
                      <input type={showPw ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                        className={inputCls + ' mt-1.5'} style={{ borderColor: C.border }} />
                    </div>
                  </div>
                  {pwError && <p className="text-[12px]" style={{ color: C.bad }}>{pwError}</p>}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={pwSaving || !currentPw || !newPw}
                      className="px-4 h-9 text-[12.5px] font-medium rounded-xl disabled:opacity-50 transition-colors"
                      style={{ background: C.text, color: '#0B0B0D' }}
                    >
                      {pwSaving ? 'Changement…' : 'Changer le mot de passe'}
                    </button>
                    {pwSaved && <span className="text-[12px] flex items-center gap-1" style={{ color: C.ok }}><Check size={13} /> Changé</span>}
                  </div>

                  {/* EXPORT DE SES DONNÉES (RGPD art. 20). La page RGPD du site
                      promet ce droit depuis toujours, et il n'existait aucun
                      moyen de l'exercer autrement qu'en nous écrivant. Le
                      fichier part en JSON, lisible par une machine comme le
                      texte l'exige.
                      Le téléchargement passe par un objet blob et non par un
                      lien direct: la route est authentifiée par un en-tête, et
                      une navigation ordinaire ne le porterait pas. */}
                  <div className="pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                    <p className="text-[12.5px] mb-1" style={{ color: C.text }}>Vos données</p>
                    <p className="text-[12px] mb-3" style={{ color: C.textTer }}>
                      Appels, transcriptions, rendez-vous, contacts et paiements, dans un seul fichier.
                    </p>
                    <button
                      type="button"
                      onClick={handleExport}
                      disabled={exporting}
                      className="px-4 h-9 text-[12.5px] font-medium rounded-xl disabled:opacity-50 transition-colors"
                      style={{ border: `1px solid ${C.border}`, color: C.text }}
                    >
                      {exporting ? 'Préparation…' : 'Télécharger mes données'}
                    </button>
                    {exportError && <p className="text-[12px] mt-2" style={{ color: C.bad }}>{exportError}</p>}
                  </div>

                  {/* SUPPRESSION DU COMPTE (RGPD art. 17). Le pendant de
                      l'export, et pour la même raison: la page « Vos données »
                      promet le droit à l'effacement, et il n'existait aucun
                      moyen de l'exercer autrement qu'en nous écrivant.
                      Elle est repliée par défaut: une action définitive ne
                      s'offre pas au clic distrait, elle se demande. */}
                  <div className="pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                    <p className="text-[12.5px] mb-1" style={{ color: C.text }}>Supprimer mon compte</p>
                    <p className="text-[12px] mb-3" style={{ color: C.textTer }}>
                      Votre abonnement est résilié, votre réceptionniste retirée, et toutes vos données effacées. Définitif.
                    </p>
                    {!showDelete ? (
                      <button
                        type="button"
                        onClick={() => setShowDelete(true)}
                        className="px-4 h-9 text-[12.5px] font-medium rounded-xl transition-colors"
                        style={{ border: `1px solid ${C.bad}40`, color: C.bad }}
                      >
                        Supprimer mon compte
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>
                              Nom de l'entreprise
                            </label>
                            <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                              placeholder={businessName || 'Nom exact'}
                              className={inputCls + ' mt-1.5'} style={{ borderColor: C.border }} />
                          </div>
                          <div>
                            <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Mot de passe</label>
                            <input type="password" value={deletePw} onChange={e => setDeletePw(e.target.value)}
                              autoComplete="current-password"
                              className={inputCls + ' mt-1.5'} style={{ borderColor: C.border }} />
                          </div>
                        </div>
                        {deleteError && <p className="text-[12px]" style={{ color: C.bad }}>{deleteError}</p>}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { setShowDelete(false); setDeleteConfirm(''); setDeletePw(''); setDeleteError(''); }}
                            className="px-4 h-9 text-[12.5px] font-medium rounded-xl transition-colors"
                            style={{ border: `1px solid ${C.border}`, color: C.textSec }}
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteAccount}
                            /* Le bouton n'est actif qu'une fois le nom exact
                               tapé: la comparaison est faite aussi côté
                               serveur, celle-ci n'est là que pour éviter un
                               aller-retour inutile. */
                            disabled={deleting || !deleteConfirm.trim()}
                            className="px-4 h-9 text-[12.5px] font-medium rounded-xl disabled:opacity-40 transition-colors text-white"
                            style={{ background: C.bad }}
                          >
                            {deleting ? 'Suppression…' : 'Supprimer définitivement'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ borderTop: `1px solid ${C.border}` }} />
          <Row icon={Bell} label="Notifications" hint="Emails, rapport, alertes"
               onClick={() => toggle('notif')} />
          <AnimatePresence initial={false}>
            {open === 'notif' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }} className="overflow-hidden" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="p-5">
                  {([
                    { label: 'Notifications email',  desc: 'Évènements importants',   checked: notifEmail,  set: (v: boolean) => { setNotifEmail(v);  saveNotifications({ notifEmail: v, notifWeekly, notifLeads, notifQuota }); } },
                    { label: 'Rapport hebdomadaire', desc: 'Résumé chaque lundi',     checked: notifWeekly, set: (v: boolean) => { setNotifWeekly(v); saveNotifications({ notifEmail, notifWeekly: v, notifLeads, notifQuota }); } },
                    { label: 'Nouveaux leads',       desc: 'Alerte à chaque capture', checked: notifLeads,  set: (v: boolean) => { setNotifLeads(v);  saveNotifications({ notifEmail, notifWeekly, notifLeads: v, notifQuota }); } },
                    { label: 'Alertes quota',        desc: 'Seuil 80% et 100%',       checked: notifQuota,  set: (v: boolean) => { setNotifQuota(v);  saveNotifications({ notifEmail, notifWeekly, notifLeads, notifQuota: v }); } },
                  ] as const).map((n, i, arr) => (
                    <div key={i} className="flex items-center justify-between py-2.5"
                         style={{ borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : undefined }}>
                      <div>
                        <p className="text-[13px] font-medium" style={{ color: C.text }}>{n.label}</p>
                        <p className="text-[11.5px]" style={{ color: C.textTer }}>{n.desc}</p>
                      </div>
                      <Toggle checked={n.checked} onChange={n.set} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </section>

      {/* ─── Entreprise ─── */}
      <section>
        <SectionHead title="Entreprise" />
        <Card>
          <Row icon={Building2} label="Identité de l'entreprise" hint={businessName || 'Nom, métier, langue de l’agent'}
               onClick={() => toggle('business')} />
          <AnimatePresence initial={false}>
            {open === 'business' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }} className="overflow-hidden" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="p-5 space-y-3">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Nom de l'entreprise</label>
                    <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                      placeholder="Ex: Plomberie Dupont"
                      className={inputCls + ' mt-1.5'} style={{ borderColor: C.border }} />
                    <p className="text-[11px] mt-1" style={{ color: C.textTer }}>C'est sous ce nom que l'IA se présente au téléphone.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Métier</label>
                      <select value={businessType} onChange={e => setBusinessType(e.target.value)}
                        className={selectCls + ' mt-1.5'} style={{ borderColor: C.border }}>
                        {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <p className="text-[11px] mt-1" style={{ color: C.textTer }}>Il décide des questions que l'IA sait poser.</p>
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Langue de l'agent</label>
                      <select value={agentLanguage} onChange={e => setAgentLanguage(e.target.value)}
                        className={selectCls + ' mt-1.5'} style={{ borderColor: C.border }}>
                        <option value="fr">Français (Marie)</option>
                        <option value="en">Anglais (Ashley)</option>
                      </select>
                      <p className="text-[11px] mt-1" style={{ color: C.textTer }}>La langue parlée à vos appelants.</p>
                    </div>
                  </div>
                  {/* Le numéro de TVA, avec le nom et le métier: c'est
                      l'identité de la société, au même titre qu'eux. Il vivait
                      sur Facturation, où l'on ne va que pour lire une facture.
                      Sans lui, la facture Stripe sort sans mention de TVA: un
                      client belge assujetti ne peut pas la porter en compte, et
                      un client d'un autre État membre perd l'autoliquidation.
                      C'est la première chose que son comptable réclame. */}
                  <div>
                    <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Numéro de TVA</label>
                    <input
                      type="text"
                      value={vatNumber}
                      onChange={e => setVatNumber(e.target.value)}
                      disabled={!settingsLoaded}
                      placeholder="BE0123456789"
                      /* `characters` et non `words`: un numéro de TVA commence
                         par deux lettres de pays, que la majuscule automatique
                         d'iOS ne pose que sur la première. */
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      className={inputCls + ' mt-1.5 font-mono'}
                      style={{ borderColor: C.border }}
                    />
                    <p className="text-[11px] mt-1" style={{ color: C.textTer }}>
                      Il apparaît sur vos factures. Laissez vide si vous n'êtes pas assujetti.
                    </p>
                  </div>
                  {bizError && <p className="text-[12px]" style={{ color: C.bad }}>{bizError}</p>}
                  <div className="flex items-center gap-3 pt-2">
                    <button type="button" onClick={saveBusiness} disabled={bizSaving}
                      className="px-4 h-9 text-[12.5px] font-medium rounded-xl disabled:opacity-50 transition-colors"
                      style={{ background: C.text, color: '#0B0B0D' }}>
                      {bizSaving ? 'Enregistrement…' : 'Sauvegarder'}
                    </button>
                    {bizSaved && <span className="text-[12px] flex items-center gap-1" style={{ color: C.ok }}><Check size={13} /> Sauvegardé</span>}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ borderTop: `1px solid ${C.border}` }} />
          <Row icon={MapPin} label="Coordonnées" hint={[city, postalCode].filter(Boolean).join(' ') || 'Adresse et téléphone de contact'}
               onClick={() => toggle('contact')} />
          <AnimatePresence initial={false}>
            {open === 'contact' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }} className="overflow-hidden" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="p-5 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Téléphone de contact</label>
                      <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                        placeholder="+32 470 00 00 00" className={inputCls + ' mt-1.5'} style={{ borderColor: C.border }} />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Adresse</label>
                      <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                        placeholder="123 Rue Principale" className={inputCls + ' mt-1.5'} style={{ borderColor: C.border }} />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Ville</label>
                      <input type="text" value={city} onChange={e => setCity(e.target.value)}
                        placeholder="Bruxelles" className={inputCls + ' mt-1.5'} style={{ borderColor: C.border }} />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Code postal</label>
                      <input type="text" value={postalCode} onChange={e => setPostalCode(e.target.value)}
                        placeholder="1000" className={inputCls + ' mt-1.5'} style={{ borderColor: C.border }} />
                    </div>
                  </div>
                  <div className="pt-1 space-y-1.5">
                    {([
                      ['Contact principal', readOnly.contactName],
                      ['Email', readOnly.contactEmail],
                      ['Pays', readOnly.country],
                    ] as const).map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between text-[12.5px]">
                        <span style={{ color: C.textTer }}>{label}</span>
                        <span style={{ color: C.textSec }}>{value || '—'}</span>
                      </div>
                    ))}
                  </div>
                  {bizError && <p className="text-[12px]" style={{ color: C.bad }}>{bizError}</p>}
                  <div className="flex items-center gap-3 pt-2">
                    <button type="button" onClick={saveBusiness} disabled={bizSaving}
                      className="px-4 h-9 text-[12.5px] font-medium rounded-xl disabled:opacity-50 transition-colors"
                      style={{ background: C.text, color: '#0B0B0D' }}>
                      {bizSaving ? 'Enregistrement…' : 'Sauvegarder'}
                    </button>
                    {bizSaved && <span className="text-[12px] flex items-center gap-1" style={{ color: C.ok }}><Check size={13} /> Sauvegardé</span>}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </section>

      {/* ─── Qwillio ─── */}
      <section>
        <SectionHead title="Qwillio" />
        <Card>
          <Row icon={Bot} label="Réceptionniste IA"
               hint="Voix, scripts, transferts d'appel"
               to="/dashboard/receptionist" />
          <div style={{ borderTop: `1px solid ${C.border}` }} />
          <Row icon={Sparkles} label="Plan & usage"
               hint={`Plan ${planLabel}`}
               badge={<span className="text-[11px]" style={{ color: C.textSec }}>Gérer</span>}
               to="/dashboard/billing" />
          <div style={{ borderTop: `1px solid ${C.border}` }} />
          <Row icon={CreditCard} label="Moyens de paiement"
               hint="Carte, facturation, factures"
               to="/dashboard/billing" />
          <div style={{ borderTop: `1px solid ${C.border}` }} />
          <Row icon={Globe} label="Renvoi d'appel"
               hint="iPhone ou Android — guide pas à pas"
               to="/dashboard/setup/call-forwarding" />
        </Card>
      </section>

      {/* ─── Préférences ─── */}
      <section>
        <SectionHead title="Préférences" />
        <Card>
          <Row icon={Shield} label="Confidentialité"
               hint="Exporter mes données, consentements"
               onClick={() => addToast('Bientôt disponible', 'info')} />
          <div style={{ borderTop: `1px solid ${C.border}` }} />
          <Row icon={HelpCircle} label="Support & aide"
               hint="Centre d'aide, contact"
               to="/dashboard/support" />
        </Card>
      </section>

      {/* ─── Déconnexion ─── */}
      <section>
        <Card>
          <Row icon={LogOut} label="Se déconnecter" danger onClick={logout} />
        </Card>
      </section>

      <p className="text-center text-[10.5px] pt-2" style={{ color: C.textTer }}>
        Qwillio · {user?.email}
      </p>
    </div>
  );
}
