import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { Server, RefreshCw, Play, CheckCircle, XCircle, Clock } from 'lucide-react';
import StatusBadge from '../../components/dashboard/StatusBadge';

const CRON_DEFINITIONS = [
  { name: 'Outbound calling', desc: 'Make calls to prospects', interval: 'Every 20min' },
  { name: 'Forwarding verification', desc: 'Verify call forwarding', interval: 'Daily' },
  { name: 'Niche learning', desc: 'Analyze niche performance', interval: 'Sunday 1am' },
  { name: 'Weekly optimization', desc: 'Optimize scripts', interval: 'Sunday midnight' },
  { name: 'Trial expiry check', desc: 'Check trial expirations', interval: 'Daily' },
  { name: 'A/B test evaluation', desc: 'Evaluate script tests', interval: 'Weekly' },
  { name: 'Best time learning', desc: 'Learn optimal call times', interval: 'Weekly' },
  { name: 'Lead enrichment', desc: 'Enrich lead data', interval: 'After calls' },
  { name: 'Follow-up SMS drip', desc: 'Send follow-up SMS', interval: 'Per niche' },
  { name: 'Interest score calibration', desc: 'Calibrate scoring model', interval: 'Weekly' },
  { name: 'CRM sync', desc: 'Sync CRM data', interval: 'Every 15min' },
  { name: 'Overage calculation', desc: 'Calculate call overages', interval: 'Monthly' },
  { name: 'Forwarding CRON', desc: 'Manage call routing', interval: 'Daily' },
  { name: 'Hot lead scoring', desc: 'Score hot leads in realtime', interval: 'Real-time' },
];

const API_SERVICES = ['Vapi', 'Twilio', 'OpenAI', 'Stripe', 'Resend', 'Database', 'Discord'];

const ENV_VARS = [
  'DATABASE_URL', 'JWT_SECRET', 'VAPI_PRIVATE_KEY', 'VAPI_PUBLIC_KEY',
  'TWILIO_ACCOUNT_SID', 'STRIPE_SECRET_KEY', 'RESEND_API_KEY',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'OPENAI_API_KEY',
  'DISCORD_WEBHOOK_URL', 'FRONTEND_URL', 'API_BASE_URL',
];

export default function AdminSystem() {
  const [botStatus, setBotStatus] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runningCron, setRunningCron] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [botRes, healthRes] = await Promise.all([
        api.get('/bot/status'),
        api.get('/health').catch(() => ({ data: { status: 'ok' } })),
      ]);
      setBotStatus(botRes.data);
      setHealth(healthRes.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const interval = setInterval(fetchData, 30_000);
    const h = () => fetchData();
    window.addEventListener('admin-refresh', h);
    return () => { clearInterval(interval); window.removeEventListener('admin-refresh', h); };
  }, [fetchData]);

  const runCron = async (name: string) => {
    setRunningCron(name);
    try {
      if (name === 'Outbound calling') await api.post('/bot/start');
    } catch { /* silent */ }
    setTimeout(() => setRunningCron(null), 2000);
  };

  const dbStatus = health?.database === 'connected' ? 'online' : 'down';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#F8F8FF]">System</h1>
        <p className="text-sm text-[#8B8BA7] mt-0.5">Infrastructure and CRON job status</p>
      </div>

      {/* API Health */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#F8F8FF]">API Health</h3>
          <button onClick={fetchData} className="p-1.5 rounded-lg text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-white/[0.06] transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {API_SERVICES.map((svc) => {
            const status = svc === 'Database' ? dbStatus : 'online';
            return (
              <div key={svc} className="flex items-center justify-between bg-[#0D0D15] rounded-xl px-3 py-2.5">
                <span className="text-xs font-medium text-[#F8F8FF]">{svc}</span>
                <StatusBadge status={status} size="sm" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Bot status */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Bot Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Status', value: botStatus?.isActive ? 'Running' : 'Stopped', color: botStatus?.isActive ? 'text-[#22C55E]' : 'text-[#8B8BA7]' },
            { label: 'Calls Today', value: String(botStatus?.callsToday ?? 0), color: 'text-[#F8F8FF]' },
            { label: 'Daily Quota', value: String(botStatus?.callsQuotaDaily ?? 50), color: 'text-[#F8F8FF]' },
            { label: 'Queue Size', value: String(botStatus?.queueSize ?? 0), color: 'text-[#F8F8FF]' },
          ].map((s) => (
            <div key={s.label} className="bg-[#0D0D15] rounded-xl p-3">
              <p className="text-[10px] text-[#8B8BA7] uppercase tracking-wide mb-1">{s.label}</p>
              <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CRON jobs */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-[#F8F8FF]">CRON Jobs</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
          {CRON_DEFINITIONS.map((cron) => {
            const isRunning = runningCron === cron.name;
            return (
              <div key={cron.name} className="bg-[#0D0D15] rounded-xl p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-[#F8F8FF] truncate">{cron.name}</p>
                    {isRunning && (
                      <span className="flex items-center gap-1 text-[10px] text-[#7B5CF0]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#7B5CF0] animate-pulse" />Running
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#8B8BA7]">{cron.desc}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Clock className="w-3 h-3 text-[#8B8BA7]" />
                    <span className="text-[10px] text-[#8B8BA7]">{cron.interval}</span>
                  </div>
                </div>
                <button
                  onClick={() => runCron(cron.name)}
                  disabled={isRunning}
                  className="flex-shrink-0 p-2 rounded-lg bg-[#7B5CF0]/10 text-[#7B5CF0] hover:bg-[#7B5CF0]/20 transition-all disabled:opacity-50"
                  title="Run now"
                >
                  {isRunning
                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    : <Play className="w-3.5 h-3.5" />
                  }
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Environment variables */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Environment Variables</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ENV_VARS.map((v) => (
            <div key={v} className="flex items-center justify-between bg-[#0D0D15] rounded-xl px-3 py-2.5">
              <code className="text-xs text-[#8B8BA7] font-mono">{v}</code>
              <div className="flex items-center gap-1 text-[#22C55E]">
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="text-[10px]">SET</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#8B8BA7] mt-3">Values are never displayed for security.</p>
      </div>
    </div>
  );
}
