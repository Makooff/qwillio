import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, Check, Bell, LogOut, Eye, EyeOff, ChevronRight,
  CreditCard, Bot, HelpCircle, Sparkles, Shield, Globe,
  Building2, MapPin, BookOpen, Clock, Plus, Pencil, Trash2, X, AlertTriangle,
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

/**
 * Base de connaissance — ce que l'agent sait de l'entreprise.
 *
 * Les trois natures et les plafonds sont ceux du backend
 * (`business-knowledge.service.ts`), recopiés ici pour que le formulaire
 * refuse avant l'aller-retour réseau. Toute divergence se voit: le serveur
 * revalide et renvoie son propre message, qu'on affiche tel quel.
 */
type KnowledgeKind = 'faq' | 'staff' | 'rule';

interface KnowledgeEntry {
  id: string;
  kind: KnowledgeKind;
  title: string;
  content: string;
  keywords: string[];
  priority: number;
  isActive: boolean;
}

const KIND_META: Record<KnowledgeKind, { label: string; hint: string; placeholder: string }> = {
  faq: {
    label: 'Question',
    hint: 'Une question que vos clients posent, et la réponse à donner.',
    placeholder: 'Ex. : Faites-vous les urgences le samedi ?',
  },
  staff: {
    label: 'Personne',
    hint: "Qui fait quoi, pour que l'agent oriente vers la bonne personne.",
    placeholder: 'Ex. : Dr Lambert, orthodontie',
  },
  rule: {
    label: 'Règle',
    hint: "Une consigne à respecter: délai d'annulation, acompte, zone desservie.",
    placeholder: 'Ex. : Annulation gratuite jusqu’à 24 h avant',
  },
};

const KNOWLEDGE_MAX_ENTRIES = 500;
const KNOWLEDGE_MAX_TITLE = 300;
const KNOWLEDGE_MAX_CONTENT = 4000;

/** Bornes du backend (`data-retention.service.ts`). */
const RETENTION_MIN = 30;
const RETENTION_MAX = 1825;

/**
 * Les durées proposées. Le champ libre reste accessible: ces valeurs ne sont
 * qu'un raccourci vers les durées que les clients demandent réellement.
 */
const RETENTION_PRESETS: { days: number; label: string }[] = [
  { days: 30,   label: '30 jours' },
  { days: 90,   label: '90 jours' },
  { days: 365,  label: '1 an' },
  { days: 1825, label: '5 ans' },
];

const emptyDraft = (): { id: string | null; kind: KnowledgeKind; title: string; content: string; keywords: string } =>
  ({ id: null, kind: 'faq', title: '', content: '', keywords: '' });

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
  /* Par où partent les messages de la réceptionniste.
     `whatsappAvailable` vient du SERVEUR et n'est pas décoratif: WhatsApp exige
     un modèle approuvé par Meta pour chaque type de message, et sans expéditeur
     ni modèle configurés, cocher la case n'enverrait jamais rien. Proposer un
     canal muet est pire que ne pas le proposer. */
  const [notificationChannel, setNotificationChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [whatsappAvailable, setWhatsappAvailable] = useState(false);
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

  // ── Base de connaissance ──────────────────────────────────────────────────
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[] | null>(null);
  const [kbError, setKbError] = useState('');
  const [kbBusy, setKbBusy] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [draftOpen, setDraftOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // ── Rétention ─────────────────────────────────────────────────────────────
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [retentionIsDefault, setRetentionIsDefault] = useState(true);
  const [retentionDefault, setRetentionDefault] = useState(90);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [retentionSaved, setRetentionSaved] = useState(false);
  const [retentionError, setRetentionError] = useState('');

  /**
   * Les deux blocs ne se chargent qu'à l'ouverture de leur tiroir.
   *
   * La page Paramètres s'ouvre des dizaines de fois par jour pour changer un
   * mot de passe; aller chercher 500 entrées de base de connaissance à chaque
   * fois serait payer le prix fort pour un écran qu'on n'a pas déplié.
   */
  const loadKnowledge = useCallback(async () => {
    if (knowledge !== null) return;
    try {
      const { data } = await api.get('/my-dashboard/knowledge');
      setKnowledge(Array.isArray(data?.entries) ? data.entries : []);
    } catch {
      setKbError("La base de connaissance n'a pas pu être chargée.");
      setKnowledge([]);
    }
  }, [knowledge]);

  const loadRetention = useCallback(async () => {
    try {
      const { data } = await api.get('/my-dashboard/retention');
      if (typeof data?.retentionDays === 'number') setRetentionDays(data.retentionDays);
      if (typeof data?.defaultDays === 'number') setRetentionDefault(data.defaultDays);
      setRetentionIsDefault(data?.isDefault !== false);
    } catch {
      setRetentionError("Le réglage de conservation n'a pas pu être chargé.");
    }
  }, []);

  /** Le serveur revalide tout: son message prime sur le nôtre. */
  const kbMessage = (e: any, fallback: string) =>
    e?.response?.data?.error ? String(e.response.data.error) : fallback;

  const submitDraft = async () => {
    const title = draft.title.trim();
    const content = draft.content.trim();
    if (!title || !content) {
      setKbError('Le titre et le contenu sont obligatoires.');
      return;
    }
    setKbBusy(true);
    setKbError('');
    const payload = {
      kind: draft.kind,
      title,
      content,
      keywords: draft.keywords.split(',').map(k => k.trim()).filter(Boolean),
    };
    try {
      if (draft.id) {
        const { data } = await api.put(`/my-dashboard/knowledge/${draft.id}`, payload);
        setKnowledge(list => (list ?? []).map(e => (e.id === draft.id ? { ...e, ...data } : e)));
      } else {
        const { data } = await api.post('/my-dashboard/knowledge', payload);
        setKnowledge(list => [...(list ?? []), data]);
      }
      setDraft(emptyDraft());
      setDraftOpen(false);
      addToast(draft.id ? 'Entrée mise à jour' : 'Entrée ajoutée', 'success');
    } catch (e: any) {
      setKbError(kbMessage(e, "L'enregistrement a échoué. Réessayez dans un instant."));
    } finally {
      setKbBusy(false);
    }
  };

  const removeEntry = async (id: string) => {
    setKbBusy(true);
    setKbError('');
    try {
      await api.delete(`/my-dashboard/knowledge/${id}`);
      setKnowledge(list => (list ?? []).filter(e => e.id !== id));
      setConfirmDelete(null);
      addToast('Entrée supprimée', 'success');
    } catch (e: any) {
      setKbError(kbMessage(e, 'La suppression a échoué.'));
    } finally {
      setKbBusy(false);
    }
  };

  /**
   * Amorce la base avec la FAQ du métier. Le serveur est idempotent par titre:
   * réimporter n'ajoute que ce qui manque et ne réécrit jamais une réponse que
   * le client a retouchée. On peut donc laisser le bouton toujours cliquable.
   */
  const importPreset = async () => {
    setKbBusy(true);
    setKbError('');
    try {
      const { data } = await api.post('/my-dashboard/knowledge/import-preset');
      const imported = Number(data?.imported ?? 0);
      if (imported > 0) {
        const { data: fresh } = await api.get('/my-dashboard/knowledge');
        setKnowledge(Array.isArray(fresh?.entries) ? fresh.entries : []);
        addToast(`${imported} question${imported > 1 ? 's' : ''} importée${imported > 1 ? 's' : ''}`, 'success');
      } else {
        addToast('Rien à importer : vos questions sont déjà là', 'info');
      }
    } catch (e: any) {
      setKbError(kbMessage(e, "L'import a échoué."));
    } finally {
      setKbBusy(false);
    }
  };

  const saveRetention = async (days: number | null) => {
    setRetentionSaving(true);
    setRetentionError('');
    try {
      await api.put('/my-dashboard/retention', { retentionDays: days });
      setRetentionIsDefault(days === null);
      if (days === null) setRetentionDays(retentionDefault);
      setRetentionSaved(true);
      setTimeout(() => setRetentionSaved(false), 2000);
    } catch (e: any) {
      setRetentionError(kbMessage(e, "L'enregistrement a échoué."));
    } finally {
      setRetentionSaving(false);
    }
  };

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
      if (data?.notificationChannel === 'whatsapp' || data?.notificationChannel === 'sms') {
        setNotificationChannel(data.notificationChannel);
      }
      setWhatsappAvailable(!!data?.whatsappAvailable);
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
                  {/* PAR OÙ partent les messages, avant de dire lesquels.
                      Le canal se choisit une fois et vaut pour tous les envois;
                      les interrupteurs en dessous décident du contenu. Les
                      poser dans l'autre ordre ferait cocher des alertes sans
                      savoir où elles arrivent. */}
                  <div className="pb-4 mb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                    <p className="text-[13px] font-medium mb-1" style={{ color: C.text }}>Canal des messages</p>
                    <p className="text-[11.5px] mb-3" style={{ color: C.textTer }}>
                      Confirmations de rendez-vous aux appelants, et vos propres alertes.
                    </p>
                    <div className="flex gap-2">
                      {([
                        { key: 'sms' as const, label: 'SMS' },
                        { key: 'whatsapp' as const, label: 'WhatsApp' },
                      ]).map(opt => {
                        const active = notificationChannel === opt.key;
                        const blocked = opt.key === 'whatsapp' && !whatsappAvailable;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            disabled={blocked}
                            onClick={() => {
                              if (blocked) return;
                              setNotificationChannel(opt.key);
                              void api.put('/my-dashboard/settings', { notificationChannel: opt.key })
                                .then(() => invalidateLive('/my-dashboard/'))
                                .catch(() => setNotificationChannel(notificationChannel));
                            }}
                            className="h-9 px-4 rounded-xl text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            style={active
                              ? { background: 'rgba(122,95,255,0.16)', color: '#b9a8ff' }
                              : { background: 'rgba(255,255,255,0.04)', color: C.textSec }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {!whatsappAvailable && (
                      <p className="text-[11px] mt-2.5" style={{ color: C.textTer }}>
                        WhatsApp n'est pas encore actif sur votre compte : il demande un expéditeur
                        WhatsApp Business et des modèles de messages approuvés par Meta.
                      </p>
                    )}
                    {whatsappAvailable && notificationChannel === 'whatsapp' && (
                      <p className="text-[11px] mt-2.5" style={{ color: C.textTer }}>
                        Un message dont le modèle n'a pas encore été approuvé part par SMS,
                        pour qu'il ne se perde jamais.
                      </p>
                    )}
                  </div>
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

      {/* ─── Données ─── */}
      <section>
        <SectionHead title="Données" />
        <Card>
          {/* BASE DE CONNAISSANCE. Les routes existaient depuis la PR #133 sans
              aucune porte d'entrée: le client restait devant la zone de texte
              libre de Réceptionniste. Ici il saisit des entrées nommées, que
              l'agent retrouve une par une au lieu d'avaler un bloc de 8000
              caractères. */}
          <Row
            icon={BookOpen}
            label="Base de connaissance"
            hint={
              knowledge === null
                ? "Ce que l'agent sait répondre"
                : knowledge.length === 0
                  ? 'Vide, importez les questions de votre métier'
                  : `${knowledge.length} entrée${knowledge.length > 1 ? 's' : ''}`
            }
            onClick={() => { toggle('knowledge'); void loadKnowledge(); }}
          />
          <AnimatePresence initial={false}>
            {open === 'knowledge' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }} className="overflow-hidden" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="p-5 space-y-4">
                  <p className="text-[12px] leading-relaxed" style={{ color: C.textTer }}>
                    Chaque entrée est retrouvée séparément pendant l'appel. Mieux vaut dix entrées
                    précises qu'un long paragraphe : l'agent cite ce qui répond à la question posée.
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={importPreset}
                      disabled={kbBusy || !businessType}
                      className="px-3.5 h-9 text-[12.5px] font-medium rounded-xl inline-flex items-center gap-2 disabled:opacity-40 transition-colors active:scale-[0.97]"
                      style={{ background: C.text, color: '#0B0B0D' }}
                    >
                      <Sparkles size={13} />
                      Importer les questions de mon métier
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDraft(emptyDraft()); setDraftOpen(v => !v); setKbError(''); }}
                      disabled={kbBusy || (knowledge?.length ?? 0) >= KNOWLEDGE_MAX_ENTRIES}
                      className="px-3.5 h-9 text-[12.5px] font-medium rounded-xl border inline-flex items-center gap-2 disabled:opacity-40 transition-colors active:scale-[0.97]"
                      style={{ borderColor: C.border, color: C.text }}
                    >
                      <Plus size={13} />
                      Ajouter
                    </button>
                  </div>

                  {!businessType && (
                    <p className="text-[12px] flex items-start gap-1.5" style={{ color: C.textTer }}>
                      <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                      <span>
                        Choisissez d'abord votre métier dans « Identité de l'entreprise » :
                        c'est lui qui détermine les questions proposées.
                      </span>
                    </p>
                  )}

                  {kbError && <p className="text-[12px]" style={{ color: C.bad }}>{kbError}</p>}

                  {/* Formulaire d'ajout / d'édition. */}
                  <AnimatePresence initial={false}>
                    {draftOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                        className="rounded-xl border p-4 space-y-3"
                        style={{ borderColor: C.borderHi, background: 'rgba(255,255,255,0.02)' }}
                      >
                        <div>
                          <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Nature</label>
                          <select
                            value={draft.kind}
                            onChange={e => setDraft(d => ({ ...d, kind: e.target.value as KnowledgeKind }))}
                            className={selectCls + ' mt-1.5'} style={{ borderColor: C.border }}
                          >
                            {(Object.keys(KIND_META) as KnowledgeKind[]).map(k => (
                              <option key={k} value={k} style={{ background: C.bg }}>{KIND_META[k].label}</option>
                            ))}
                          </select>
                          <p className="text-[11.5px] mt-1.5" style={{ color: C.textTer }}>{KIND_META[draft.kind].hint}</p>
                        </div>
                        <div>
                          <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>Intitulé</label>
                          <input
                            type="text" value={draft.title} maxLength={KNOWLEDGE_MAX_TITLE}
                            placeholder={KIND_META[draft.kind].placeholder}
                            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                            className={inputCls + ' mt-1.5'} style={{ borderColor: C.border }}
                            onFocus={e => e.currentTarget.style.borderColor = C.borderHi}
                            onBlur={e => e.currentTarget.style.borderColor = C.border}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>
                            {draft.kind === 'faq' ? 'Réponse' : 'Détail'}
                          </label>
                          <textarea
                            value={draft.content} rows={3} maxLength={KNOWLEDGE_MAX_CONTENT}
                            onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
                            className={inputCls + ' mt-1.5 resize-y'} style={{ borderColor: C.border }}
                            onFocus={e => e.currentTarget.style.borderColor = C.borderHi}
                            onBlur={e => e.currentTarget.style.borderColor = C.border}
                          />
                          <p className="text-[11px] mt-1 text-right" style={{ color: C.textTer }}>
                            {draft.content.length} / {KNOWLEDGE_MAX_CONTENT}
                          </p>
                        </div>
                        <div>
                          <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>
                            Mots-clés <span className="normal-case tracking-normal">(séparés par des virgules, facultatif)</span>
                          </label>
                          <input
                            type="text" value={draft.keywords}
                            placeholder="urgence, samedi, week-end"
                            onChange={e => setDraft(d => ({ ...d, keywords: e.target.value }))}
                            className={inputCls + ' mt-1.5'} style={{ borderColor: C.border }}
                            onFocus={e => e.currentTarget.style.borderColor = C.borderHi}
                            onBlur={e => e.currentTarget.style.borderColor = C.border}
                          />
                          <p className="text-[11.5px] mt-1.5" style={{ color: C.textTer }}>
                            Les mots que l'appelant risque d'employer, s'ils ne figurent pas déjà dans l'intitulé.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button" onClick={submitDraft} disabled={kbBusy}
                            className="px-4 h-9 text-[12.5px] font-medium rounded-xl disabled:opacity-50 transition-colors active:scale-[0.97]"
                            style={{ background: C.text, color: '#0B0B0D' }}
                          >
                            {kbBusy ? 'Enregistrement…' : draft.id ? 'Mettre à jour' : 'Ajouter'}
                          </button>
                          <button
                            type="button" onClick={() => { setDraftOpen(false); setDraft(emptyDraft()); setKbError(''); }}
                            className="px-4 h-9 text-[12.5px] font-medium rounded-xl border transition-colors active:scale-[0.97]"
                            style={{ borderColor: C.border, color: C.textSec }}
                          >
                            Annuler
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* La liste. */}
                  {knowledge === null ? (
                    <p className="text-[12.5px]" style={{ color: C.textTer }}>Chargement…</p>
                  ) : knowledge.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-5 text-center" style={{ borderColor: C.border }}>
                      <p className="text-[12.5px]" style={{ color: C.textSec }}>Votre agent ne connaît encore rien de spécifique.</p>
                      <p className="text-[12px] mt-1" style={{ color: C.textTer }}>
                        L'import du métier est le plus rapide : vous corrigez des réponses déjà rédigées.
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {knowledge.map(entry => (
                        <li
                          key={entry.id}
                          className="rounded-xl border p-3.5"
                          style={{ borderColor: C.border, background: 'rgba(255,255,255,0.02)' }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="text-[10.5px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded"
                                  style={{ background: 'rgba(115,73,254,0.14)', color: '#B9A2FF' }}
                                >
                                  {KIND_META[entry.kind]?.label ?? entry.kind}
                                </span>
                                {!entry.isActive && (
                                  <span className="text-[10.5px] uppercase tracking-wider" style={{ color: C.textTer }}>inactive</span>
                                )}
                              </div>
                              <p className="text-[13px] font-medium mt-1.5 break-words" style={{ color: C.text }}>{entry.title}</p>
                              <p className="text-[12px] mt-1 leading-relaxed break-words" style={{ color: C.textSec }}>{entry.content}</p>
                              {entry.keywords?.length > 0 && (
                                <p className="text-[11.5px] mt-1.5" style={{ color: C.textTer }}>
                                  {entry.keywords.join(' · ')}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button" aria-label="Modifier"
                                onClick={() => {
                                  setDraft({
                                    id: entry.id, kind: entry.kind, title: entry.title,
                                    content: entry.content, keywords: (entry.keywords ?? []).join(', '),
                                  });
                                  setDraftOpen(true);
                                  setKbError('');
                                }}
                                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors active:scale-[0.97]"
                              >
                                <Pencil size={13} style={{ color: C.textSec }} />
                              </button>
                              <button
                                type="button" aria-label="Supprimer"
                                onClick={() => setConfirmDelete(entry.id)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/[0.10] transition-colors active:scale-[0.97]"
                              >
                                <Trash2 size={13} style={{ color: C.bad }} />
                              </button>
                            </div>
                          </div>

                          {/* Confirmation en place: une entrée effacée n'est pas
                              récupérable, mais une modale pour trois lignes de
                              FAQ serait disproportionnée. */}
                          <AnimatePresence initial={false}>
                            {confirmDelete === entry.id && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                                className="flex items-center gap-2 mt-3 pt-3"
                                style={{ borderTop: `1px solid ${C.border}` }}
                              >
                                <span className="text-[12px] flex-1" style={{ color: C.textSec }}>Supprimer définitivement ?</span>
                                <button
                                  type="button" onClick={() => removeEntry(entry.id)} disabled={kbBusy}
                                  className="px-3 h-8 text-[12px] font-medium rounded-lg disabled:opacity-50 transition-colors active:scale-[0.97]"
                                  style={{ background: C.bad, color: '#FFF' }}
                                >
                                  Supprimer
                                </button>
                                <button
                                  type="button" onClick={() => setConfirmDelete(null)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors"
                                  aria-label="Annuler"
                                >
                                  <X size={13} style={{ color: C.textSec }} />
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </li>
                      ))}
                    </ul>
                  )}

                  {(knowledge?.length ?? 0) >= KNOWLEDGE_MAX_ENTRIES && (
                    <p className="text-[12px]" style={{ color: C.textTer }}>
                      Base pleine ({KNOWLEDGE_MAX_ENTRIES} entrées). Supprimez-en pour en ajouter.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CONSERVATION. La politique publiée annonçait 90 jours sans que rien
              ne purge; la purge existe désormais et tourne chaque jour. Ce
              réglage est ce qui la pilote, côté client. */}
          <Row
            icon={Clock}
            label="Conservation des données"
            hint={retentionIsDefault ? `${retentionDefault} jours (par défaut)` : `${retentionDays} jours`}
            onClick={() => { toggle('retention'); void loadRetention(); }}
          />
          <AnimatePresence initial={false}>
            {open === 'retention' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }} className="overflow-hidden" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="p-5 space-y-4">
                  <p className="text-[12px] leading-relaxed" style={{ color: C.textTer }}>
                    Passé ce délai, les enregistrements, transcriptions et résumés de vos appels sont
                    effacés automatiquement, chez nous comme chez notre fournisseur de téléphonie.
                    Les statistiques agrégées, elles, restent : elles ne contiennent plus personne.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {RETENTION_PRESETS.map(p => {
                      const active = !retentionIsDefault && retentionDays === p.days;
                      return (
                        <button
                          key={p.days}
                          type="button"
                          onClick={() => { setRetentionDays(p.days); void saveRetention(p.days); }}
                          disabled={retentionSaving}
                          className="px-3.5 h-9 text-[12.5px] font-medium rounded-xl border disabled:opacity-50 transition-colors active:scale-[0.97]"
                          style={{
                            borderColor: active ? C.accent : C.border,
                            background: active ? 'rgba(115,73,254,0.14)' : 'transparent',
                            color: active ? '#C4B2FF' : C.textSec,
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[160px]">
                      <label className="text-[11px] uppercase tracking-wider font-medium" style={{ color: C.textTer }}>
                        Durée précise (jours)
                      </label>
                      <input
                        type="number" min={RETENTION_MIN} max={RETENTION_MAX}
                        value={retentionDays ?? retentionDefault}
                        onChange={e => { setRetentionDays(Number(e.target.value)); setRetentionIsDefault(false); }}
                        className={inputCls + ' mt-1.5'} style={{ borderColor: C.border }}
                        onFocus={e => e.currentTarget.style.borderColor = C.borderHi}
                        onBlur={e => e.currentTarget.style.borderColor = C.border}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => saveRetention(retentionDays ?? retentionDefault)}
                      disabled={retentionSaving}
                      className="px-4 h-9 text-[12.5px] font-medium rounded-xl disabled:opacity-50 transition-colors active:scale-[0.97]"
                      style={{ background: C.text, color: '#0B0B0D' }}
                    >
                      {retentionSaving ? 'Enregistrement…' : 'Appliquer'}
                    </button>
                    {retentionSaved && (
                      <span className="text-[12px] flex items-center gap-1" style={{ color: C.ok }}><Check size={13} /> Enregistré</span>
                    )}
                  </div>

                  <p className="text-[11.5px]" style={{ color: C.textTer }}>
                    Entre {RETENTION_MIN} et {RETENTION_MAX} jours.
                    {!retentionIsDefault && (
                      <>
                        {' '}
                        <button
                          type="button"
                          onClick={() => saveRetention(null)}
                          disabled={retentionSaving}
                          className="underline underline-offset-2 disabled:opacity-50 transition-colors"
                          style={{ color: C.textSec }}
                        >
                          Revenir au réglage par défaut ({retentionDefault} jours)
                        </button>
                      </>
                    )}
                  </p>

                  {retentionError && <p className="text-[12px]" style={{ color: C.bad }}>{retentionError}</p>}
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
