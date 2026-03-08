import { useEffect, useState } from 'react';
import { Bot, Phone, PhoneForwarded, Clock, FileText, Pause, Play, Settings } from 'lucide-react';
import { useLang } from '../../stores/langStore';
import api from '../../services/api';

export default function ClientReceptionist() {
  const { t } = useLang();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [transferNumber, setTransferNumber] = useState('');
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overview, settings] = await Promise.all([
          api.get('/my-dashboard/overview'),
          api.get('/my-dashboard/settings').catch(() => ({ data: null })),
        ]);
        setData({ ...overview.data, settings: settings.data });
        setTransferNumber(overview.data?.client?.transferNumber || settings.data?.transferNumber || '');
      } catch (err) {
        console.error('Receptionist fetch error', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const action = data?.client?.subscriptionStatus === 'active' ? 'pause' : 'resume';
      await api.post(`/my-dashboard/${action}`);
      setData((prev: any) => ({
        ...prev,
        client: {
          ...prev.client,
          subscriptionStatus: action === 'pause' ? 'paused' : 'active',
        },
      }));
    } catch (err) {
      console.error('Toggle error', err);
    } finally {
      setToggling(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/my-dashboard/settings', { transferNumber });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save settings error', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const client = data?.client || {};
  const isActive = client.subscriptionStatus === 'active' || client.subscriptionStatus === 'trialing';

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">{t('cdash.recep.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status card */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isActive ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                <Bot size={24} className={isActive ? 'text-emerald-600' : 'text-amber-600'} />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{t('cdash.recep.status')}</h3>
                <span className={`text-sm font-medium ${isActive ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {isActive ? t('cdash.recep.active') : t('cdash.recep.paused')}
                </span>
              </div>
            </div>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                isActive
                  ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                  : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
              }`}
            >
              {isActive ? <><Pause size={14} /> {t('cdash.recep.pause')}</> : <><Play size={14} /> {t('cdash.recep.resume')}</>}
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Phone size={16} className="text-[#86868b]" />
              <div>
                <span className="text-xs text-[#86868b] block">{t('cdash.recep.phone')}</span>
                <span className="text-sm font-medium">{client.vapiPhoneNumber || '-'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <PhoneForwarded size={16} className="text-[#86868b]" />
              <div>
                <span className="text-xs text-[#86868b] block">{t('cdash.recep.transfer')}</span>
                <span className="text-sm font-medium">{transferNumber || t('cdash.recep.noTransfer')}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock size={16} className="text-[#86868b]" />
              <div>
                <span className="text-xs text-[#86868b] block">{t('cdash.recep.businessHours')}</span>
                <span className="text-sm font-medium">{t('cdash.recep.always')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quota usage */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Phone size={16} className="text-[#6366f1]" />
            {t('cdash.recep.quotaUsage')}
          </h3>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-bold text-[#1d1d1f]">{data?.calls?.quotaUsed || 0}</span>
            <span className="text-sm text-[#86868b]">
              / {data?.calls?.quota || 0} {t('cdash.recep.callsUsed')}
            </span>
          </div>
          <div className="h-4 bg-[#d2d2d7]/30 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all ${
                (data?.calls?.quotaPercent || 0) > 90 ? 'bg-red-500' :
                (data?.calls?.quotaPercent || 0) > 70 ? 'bg-amber-500' : 'bg-[#6366f1]'
              }`}
              style={{ width: `${Math.min(data?.calls?.quotaPercent || 0, 100)}%` }}
            />
          </div>
          <p className="text-xs text-[#86868b]">{data?.calls?.quotaPercent || 0}%</p>

          <div className="mt-6 pt-4 border-t border-[#d2d2d7]/40">
            <div className="flex items-center gap-3 text-sm">
              <FileText size={16} className="text-[#86868b]" />
              <div>
                <span className="text-xs text-[#86868b] block">{t('cdash.recep.script')}</span>
                <span className="text-sm text-[#1d1d1f]">{t('cdash.recep.noScript')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Settings size={16} className="text-[#6366f1]" />
            {t('cdash.recep.settings')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#86868b] mb-1 block">{t('cdash.recep.businessName')}</label>
              <input
                type="text"
                defaultValue={client.businessName || ''}
                disabled
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white/60 text-[#86868b]"
              />
            </div>
            <div>
              <label className="text-xs text-[#86868b] mb-1 block">{t('cdash.recep.industry')}</label>
              <input
                type="text"
                defaultValue={client.businessType || ''}
                disabled
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white/60 text-[#86868b]"
              />
            </div>
            <div>
              <label className="text-xs text-[#86868b] mb-1 block">{t('cdash.recep.transfer')}</label>
              <input
                type="tel"
                value={transferNumber}
                onChange={e => setTransferNumber(e.target.value)}
                placeholder="+1 555 000 0000"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-[#6366f1] rounded-xl hover:bg-[#4f46e5] disabled:opacity-50 transition-colors"
            >
              {saving ? '...' : t('cdash.recep.save')}
            </button>
            {saved && <span className="text-sm text-emerald-600">{t('cdash.recep.saved')}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
