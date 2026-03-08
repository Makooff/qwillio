import { useEffect, useState } from 'react';
import { CreditCard, User, Lock, AlertTriangle, Check } from 'lucide-react';
import { useLang } from '../../stores/langStore';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import StatusBadge from '../../components/client-dashboard/StatusBadge';
import ConfirmDialog from '../../components/client-dashboard/ConfirmDialog';
import { formatDate } from '../../utils/format';

export default function ClientAccount() {
  const { t } = useLang();
  const { user, checkAuth } = useAuthStore();
  const [overview, setOverview] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile
  const [name, setName] = useState(user?.name || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState('');

  // Cancel
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ov, billing] = await Promise.all([
          api.get('/my-dashboard/overview'),
          api.get('/my-dashboard/billing').catch(() => ({ data: [] })),
        ]);
        setOverview(ov.data);
        setPayments(billing.data || []);
      } catch (err) {
        console.error('Account fetch error', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleUpdateProfile = async () => {
    setProfileSaving(true);
    try {
      await api.put('/my-dashboard/profile', { name });
      setProfileSaved(true);
      checkAuth();
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err) {
      console.error('Profile update error', err);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError('');
    if (newPw !== confirmPw) {
      setPwError(t('cdash.account.pwMismatch'));
      return;
    }
    if (newPw.length < 6) {
      setPwError('Min 6 characters');
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
    } catch (err: any) {
      setPwError(err.response?.data?.error || 'Error');
    } finally {
      setPwSaving(false);
    }
  };

  const handleCancel = async () => {
    try {
      await api.post('/my-dashboard/cancel');
      setShowCancel(false);
      setOverview((prev: any) => ({
        ...prev,
        client: { ...prev.client, subscriptionStatus: 'cancelled' },
      }));
    } catch (err) {
      console.error('Cancel error', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const client = overview?.client || {};

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">{t('cdash.account.title')}</h1>

      {/* Plan info */}
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-6 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <CreditCard size={16} className="text-[#6366f1]" />
          {t('cdash.account.plan')}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-xs text-[#86868b] block">{t('cdash.account.planType')}</span>
            <span className="font-semibold capitalize">{client.planType || '-'}</span>
          </div>
          <div>
            <span className="text-xs text-[#86868b] block">{t('cdash.account.status')}</span>
            <StatusBadge status={client.subscriptionStatus || 'active'} />
          </div>
          <div>
            <span className="text-xs text-[#86868b] block">{t('cdash.overview.quota')}</span>
            <span className="font-semibold">{overview?.calls?.quotaUsed || 0} / {overview?.calls?.quota || 0}</span>
          </div>
          <div>
            <span className="text-xs text-[#86868b] block">{t('cdash.account.setupFee')}</span>
            <span className="font-semibold">${Number(client.setupFee || 0).toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Profile */}
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-6 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <User size={16} className="text-[#6366f1]" />
          {t('cdash.account.profile')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#86868b] mb-1 block">{t('cdash.account.name')}</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
            />
          </div>
          <div>
            <label className="text-xs text-[#86868b] mb-1 block">{t('cdash.account.email')}</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white/60 text-[#86868b]"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleUpdateProfile}
            disabled={profileSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-[#6366f1] rounded-xl hover:bg-[#4f46e5] disabled:opacity-50 transition-colors"
          >
            {profileSaving ? '...' : t('cdash.account.updateProfile')}
          </button>
          {profileSaved && (
            <span className="text-sm text-emerald-600 flex items-center gap-1">
              <Check size={14} /> {t('cdash.account.updated')}
            </span>
          )}
        </div>
      </div>

      {/* Password */}
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-6 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Lock size={16} className="text-[#6366f1]" />
          {t('cdash.account.password')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-[#86868b] mb-1 block">{t('cdash.account.currentPw')}</label>
            <input
              type="password"
              value={currentPw}
              onChange={e => setCurrentPw(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
            />
          </div>
          <div>
            <label className="text-xs text-[#86868b] mb-1 block">{t('cdash.account.newPw')}</label>
            <input
              type="password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
            />
          </div>
          <div>
            <label className="text-xs text-[#86868b] mb-1 block">{t('cdash.account.confirmPw')}</label>
            <input
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
            />
          </div>
        </div>
        {pwError && <p className="text-sm text-red-500 mt-2">{pwError}</p>}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleChangePassword}
            disabled={pwSaving || !currentPw || !newPw}
            className="px-4 py-2 text-sm font-medium text-white bg-[#6366f1] rounded-xl hover:bg-[#4f46e5] disabled:opacity-50 transition-colors"
          >
            {pwSaving ? '...' : t('cdash.account.changePw')}
          </button>
          {pwSaved && (
            <span className="text-sm text-emerald-600 flex items-center gap-1">
              <Check size={14} /> {t('cdash.account.pwChanged')}
            </span>
          )}
        </div>
      </div>

      {/* Billing history */}
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-6 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <CreditCard size={16} className="text-[#6366f1]" />
          {t('cdash.account.billing')}
        </h2>
        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#86868b] border-b border-[#d2d2d7]/40">
                  <th className="pb-2">{t('cdash.account.amount')}</th>
                  <th className="pb-2">{t('cdash.account.type')}</th>
                  <th className="pb-2">{t('cdash.account.status')}</th>
                  <th className="pb-2">{t('cdash.account.paidAt')}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} className="border-b border-[#d2d2d7]/20 last:border-0">
                    <td className="py-2.5 font-medium">${Number(p.amount).toFixed(2)}</td>
                    <td className="py-2.5 capitalize">{p.paymentType}</td>
                    <td className="py-2.5"><StatusBadge status={p.status} /></td>
                    <td className="py-2.5 text-[#86868b]">{formatDate(p.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[#86868b]">{t('cdash.account.noBilling')}</p>
        )}
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-red-200 bg-red-50/30 p-6">
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2 text-red-600">
          <AlertTriangle size={16} />
          {t('cdash.account.danger')}
        </h2>
        <p className="text-sm text-[#86868b] mb-4">{t('cdash.account.cancelMsg')}</p>
        <button
          onClick={() => setShowCancel(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors"
        >
          {t('cdash.account.cancel')}
        </button>
      </div>

      <ConfirmDialog
        open={showCancel}
        title={t('cdash.account.cancelConfirm')}
        message={t('cdash.account.cancelMsg')}
        confirmLabel={t('cdash.account.cancel')}
        cancelLabel={t('cdash.cancel')}
        variant="danger"
        onConfirm={handleCancel}
        onCancel={() => setShowCancel(false)}
      />
    </div>
  );
}
