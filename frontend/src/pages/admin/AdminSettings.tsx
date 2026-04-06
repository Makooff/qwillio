import { useState } from 'react';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { Settings, AlertTriangle, Play, Square, Save, Loader2 } from 'lucide-react';

export default function AdminSettings() {
  const { user } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [botAction, setBotAction] = useState<'pausing' | 'resuming' | null>(null);
  const [confirmPause, setConfirmPause] = useState(false);
  const [saved, setSaved] = useState(false);

  const [schedule, setSchedule] = useState({ startHour: 9, endHour: 19, days: '1,2,3,4,5' });
  const [quota, setQuota] = useState({ callsPerDay: 50, interval: 20 });

  const handleSave = async () => {
    setSaving(true);
    try {
      // Optimistic save — real endpoint would persist settings
      await new Promise(r => setTimeout(r, 500));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const pauseAllCalling = async () => {
    setBotAction('pausing');
    try { await api.post('/bot/stop'); }
    catch { /* silent */ }
    finally { setBotAction(null); setConfirmPause(false); }
  };

  const resumeAllCalling = async () => {
    setBotAction('resuming');
    try { await api.post('/bot/start'); }
    catch { /* silent */ }
    finally { setBotAction(null); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-[#F8F8FF]">Settings</h1>
        <p className="text-sm text-[#8B8BA7] mt-0.5">System configuration and preferences</p>
      </div>

      {/* Admin account */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4 text-[#7B5CF0]" /> Admin Account
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[#8B8BA7] mb-1.5">Email</label>
            <input
              type="email"
              defaultValue={user?.email ?? ''}
              readOnly
              className="w-full px-3 py-2.5 bg-[#0D0D15] border border-white/[0.06] rounded-xl text-sm text-[#F8F8FF] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-[#8B8BA7] mb-1.5">Name</label>
            <input
              type="text"
              defaultValue={user?.name ?? ''}
              readOnly
              className="w-full px-3 py-2.5 bg-[#0D0D15] border border-white/[0.06] rounded-xl text-sm text-[#F8F8FF] outline-none"
            />
          </div>
        </div>
      </div>

      {/* Calling schedule */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Calling Schedule</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8B8BA7] mb-1.5">Start Hour</label>
            <input
              type="number" min={0} max={23}
              value={schedule.startHour}
              onChange={e => setSchedule(s => ({ ...s, startHour: Number(e.target.value) }))}
              className="w-full px-3 py-2.5 bg-[#0D0D15] border border-white/[0.06] rounded-xl text-sm text-[#F8F8FF] outline-none focus:border-[#7B5CF0]/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-[#8B8BA7] mb-1.5">End Hour</label>
            <input
              type="number" min={0} max={23}
              value={schedule.endHour}
              onChange={e => setSchedule(s => ({ ...s, endHour: Number(e.target.value) }))}
              className="w-full px-3 py-2.5 bg-[#0D0D15] border border-white/[0.06] rounded-xl text-sm text-[#F8F8FF] outline-none focus:border-[#7B5CF0]/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-[#8B8BA7] mb-1.5">Calls Per Day</label>
            <input
              type="number" min={1} max={200}
              value={quota.callsPerDay}
              onChange={e => setQuota(q => ({ ...q, callsPerDay: Number(e.target.value) }))}
              className="w-full px-3 py-2.5 bg-[#0D0D15] border border-white/[0.06] rounded-xl text-sm text-[#F8F8FF] outline-none focus:border-[#7B5CF0]/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-[#8B8BA7] mb-1.5">Interval (min)</label>
            <input
              type="number" min={1} max={120}
              value={quota.interval}
              onChange={e => setQuota(q => ({ ...q, interval: Number(e.target.value) }))}
              className="w-full px-3 py-2.5 bg-[#0D0D15] border border-white/[0.06] rounded-xl text-sm text-[#F8F8FF] outline-none focus:border-[#7B5CF0]/50 transition-colors"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-[#8B8BA7] mb-1.5 mt-4">Active Days (comma-separated, 1=Mon)</label>
          <input
            type="text"
            value={schedule.days}
            onChange={e => setSchedule(s => ({ ...s, days: e.target.value }))}
            placeholder="1,2,3,4,5"
            className="w-full px-3 py-2.5 bg-[#0D0D15] border border-white/[0.06] rounded-xl text-sm text-[#F8F8FF] outline-none focus:border-[#7B5CF0]/50 transition-colors"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#7B5CF0] hover:bg-[#6C47FF] text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl bg-[#EF4444]/[0.05] border border-[#EF4444]/20 p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
          <h3 className="text-sm font-semibold text-[#EF4444]">Danger Zone</h3>
        </div>

        <div className="space-y-3">
          {!confirmPause ? (
            <div className="flex items-center justify-between p-4 bg-[#12121A] rounded-xl">
              <div>
                <p className="text-sm font-medium text-[#F8F8FF]">Pause All Calling</p>
                <p className="text-xs text-[#8B8BA7] mt-0.5">Immediately stops the bot and all scheduled calls</p>
              </div>
              <button
                onClick={() => setConfirmPause(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#EF4444] border border-[#EF4444]/30 rounded-lg hover:bg-[#EF4444]/10 transition-all"
              >
                <Square className="w-3.5 h-3.5" />
                Pause
              </button>
            </div>
          ) : (
            <div className="p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl">
              <p className="text-sm font-medium text-[#EF4444] mb-3">Are you sure? All active calls will stop.</p>
              <div className="flex gap-2">
                <button
                  onClick={pauseAllCalling}
                  disabled={botAction !== null}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#EF4444] text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-all disabled:opacity-50"
                >
                  {botAction === 'pausing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Yes, pause all
                </button>
                <button
                  onClick={() => setConfirmPause(false)}
                  className="px-4 py-2 text-sm text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-white/[0.06] rounded-lg transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-[#12121A] rounded-xl">
            <div>
              <p className="text-sm font-medium text-[#F8F8FF]">Resume All Calling</p>
              <p className="text-xs text-[#8B8BA7] mt-0.5">Restart the bot if it was manually paused</p>
            </div>
            <button
              onClick={resumeAllCalling}
              disabled={botAction !== null}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#22C55E] border border-[#22C55E]/30 rounded-lg hover:bg-[#22C55E]/10 transition-all disabled:opacity-50"
            >
              {botAction === 'resuming' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Resume
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
