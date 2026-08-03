import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Bot,
  Check,
  CreditCard,
  Eye,
  EyeOff,
  Globe,
  HelpCircle,
  LogOut,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../../../stores/authStore';
import { useToast } from '../../../hooks/useToast';
import ToastContainer from '../../../components/ui/Toast';
import api from '../../../services/api';
import {
  Card,
  Field,
  GhostBtn,
  Input,
  PageActions,
  Pill,
  PrimaryBtn,
  Row,
  SectionHead,
  Toggle,
  inputCls,
} from '../../../components/v2/app/Blocks';

/* Compte V2 « instrument ». Mêmes endpoints que la V1 client:
   GET /my-dashboard/settings, PUT /my-dashboard/profile,
   PUT /my-dashboard/password, PUT /my-dashboard/notifications.
   Le h1 est rendu par AppShell. */

type PlanType = 'starter' | 'pro' | 'enterprise';

const PLAN_LABELS: Record<PlanType, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export default function ClientAccount() {
  const { user, checkAuth, logout } = useAuthStore();
  const { toasts, add: addToast, remove: removeToast } = useToast();

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

  useEffect(() => {
    api
      .get('/my-dashboard/settings')
      .then((res) => {
        const notif = res.data?.vapiConfig?.notifications as
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

  return (
    <div className="max-w-[720px] space-y-6">
      <ToastContainer toasts={toasts} remove={removeToast} />

      <PageActions subtitle="Profil, sécurité, notifications, abonnement." />

      {/* Identité */}
      <Card className="flex items-center gap-4">
        <span className="w-12 h-12 shrink-0 rounded-full bg-q2-obsidian border border-q2-graphite-d flex items-center justify-center text-[15px] font-medium text-white">
          {initials}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[14.5px] font-medium text-white truncate">{user?.name ?? 'Utilisateur'}</p>
          <p className="text-[12px] text-q2-fog truncate">{user?.email}</p>
        </div>
        <Pill>{planLabel}</Pill>
      </Card>

      {/* Informations personnelles */}
      <section>
        <SectionHead title="Informations personnelles" />
        <Card>
          <div className="space-y-3">
            <Field label="Nom complet">
              <Input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email" hint="L'adresse de connexion ne peut pas être modifiée ici.">
              <Input type="email" value={user?.email ?? ''} disabled />
            </Field>
            <div className="flex items-center gap-3 pt-1">
              <PrimaryBtn type="button" onClick={handleUpdateProfile} disabled={profileSaving}>
                {profileSaving ? 'Enregistrement…' : 'Sauvegarder'}
              </PrimaryBtn>
              {profileSaved && (
                <span className="text-[12px] flex items-center gap-1.5" style={{ color: 'var(--q2p-ok)' }}>
                  <Check size={13} aria-hidden="true" /> Sauvegardé
                </span>
              )}
            </div>
          </div>
        </Card>
      </section>

      {/* Sécurité */}
      <section>
        <SectionHead title="Sécurité" />
        <Card>
          <div className="space-y-3">
            <Field label="Mot de passe actuel">
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className={`${inputCls} pr-10`}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nouveau mot de passe">
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                />
              </Field>
              <Field label="Confirmer">
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                />
              </Field>
            </div>

            {pwError && (
              <p className="text-[12px]" style={{ color: 'var(--q2p-bad)' }}>
                {pwError}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <GhostBtn
                type="button"
                onClick={handleChangePassword}
                disabled={pwSaving || !currentPw || !newPw}
              >
                {pwSaving ? 'Changement…' : 'Changer le mot de passe'}
              </GhostBtn>
              {pwSaved && (
                <span className="text-[12px] flex items-center gap-1.5" style={{ color: 'var(--q2p-ok)' }}>
                  <Check size={13} aria-hidden="true" /> Changé
                </span>
              )}
            </div>
          </div>
        </Card>
      </section>

      {/* Notifications */}
      <section>
        <SectionHead title="Notifications" />
        <Card pad={false}>
          {notifications.map((n, i) => (
            <Row
              key={n.key}
              first={i === 0}
              icon={i === 0 ? Bell : undefined}
              label={n.label}
              hint={n.desc}
              right={<Toggle checked={n.checked} onChange={n.set} label={n.label} />}
            />
          ))}
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
        <Row first icon={LogOut} label="Se déconnecter" danger onClick={logout} />
      </Card>

      <p className="text-center text-[11px] text-q2-fog pt-1">Qwillio · {user?.email}</p>
    </div>
  );
}
