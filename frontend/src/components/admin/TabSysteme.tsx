import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import { Card as ProCard, SectionHead as ProSectionHead } from '../pro/ProBlocks';

interface ServiceHealth { [key: string]: boolean | string }
interface SysStats { uptime?: number; nodeVersion?: string; env?: string; prospects?: number; clients?: number; calls?: number }

const CRON_ROWS = [
  { label: 'Scraping Apify',        schedule: 'Chaque 4h' },
  { label: 'Appels outbound',       schedule: 'Chaque 2min' },
  { label: 'Follow-ups',            schedule: 'Chaque 5min' },
  { label: 'Rescoring prospects',   schedule: 'Chaque 30min' },
  { label: 'Validation téléphones', schedule: 'Chaque 10min' },
  { label: 'A/B Testing',           schedule: 'Mardi 4h' },
  { label: 'Script Learning',       schedule: 'Dimanche 1h' },
  { label: 'Évolution agents IA',   schedule: 'Dimanche 3h' },
  { label: 'Détection anomalies',   schedule: 'Horaire :30' },
];

const SERVICE_DEFS = [
  { key: 'vapi',     label: 'VAPI',      hint: 'Voice AI' },
  { key: 'openai',   label: 'OpenAI',    hint: 'GPT-4 Turbo' },
  { key: 'twilio',   label: 'Twilio',    hint: 'SMS & validation' },
  { key: 'stripe',   label: 'Stripe',    hint: 'Paiements' },
  { key: 'resend',   label: 'Resend',    hint: 'Emails' },
  { key: 'database', label: 'Database',  hint: 'PostgreSQL / Neon' },
  { key: 'discord',  label: 'Discord',   hint: 'Alertes' },
  { key: 'apify',    label: 'Apify',     hint: 'Scraping Maps' },
];

function fmtUptime2(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}j ${h}h`;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function TabSysteme({ active }: { active: boolean }) {
  const [health, setHealth]   = useState<ServiceHealth | null>(null);
  const [sys, setSys]         = useState<SysStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    if (!active || loaded) return;
    setLoading(true);
    Promise.allSettled([
      api.get('/bot/health').catch(() => ({ data: {} })),
      api.get('/admin/system').catch(() => ({ data: null })),
    ]).then(([h, s]) => {
      if (h.status === 'fulfilled') setHealth(h.value.data as ServiceHealth);
      if (s.status === 'fulfilled') setSys(s.value.data as SysStats);
      setLoaded(true);
    }).finally(() => setLoading(false));
  }, [active, loaded]);

  const reload = () => { setLoaded(false); };

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0,1,2,3].map(i => (
          <div key={i} className="animate-pulse rounded-2xl h-20" style={{ background: pro.panel, border: `1px solid ${pro.border}` }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <ProSectionHead title="Services & santé" />
        <button type="button" onClick={reload} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors" style={{ color: pro.textSec }}>
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SERVICE_DEFS.map(s => {
          const val = health?.[s.key] ?? false;
          const isOpt = val === 'optional';
          const ok = isOpt || !!val;
          const color = isOpt ? pro.warn : ok ? pro.ok : pro.bad;
          return (
            <ProCard key={s.key}>
              <div className="p-3 flex items-center gap-2">
                {ok
                  ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color }} />
                  : <XCircle      className="w-4 h-4 flex-shrink-0" style={{ color }} />}
                <div>
                  <p className="text-xs font-semibold" style={{ color: pro.text }}>{s.label}</p>
                  <p className="text-[10px]" style={{ color: pro.textSec }}>{s.hint}{isOpt ? ' (opt.)' : ''}</p>
                </div>
              </div>
            </ProCard>
          );
        })}
      </div>

      {sys && (
        <>
          <ProSectionHead title="Système" />
          <ProCard>
            <div className="p-4 grid grid-cols-2 lg:grid-cols-3 gap-x-6">
              {[
                { l: 'Uptime',      v: sys.uptime ? fmtUptime2(sys.uptime) : '—', c: pro.ok },
                { l: 'Node.js',     v: sys.nodeVersion ?? '—' },
                { l: 'Environnement', v: sys.env ?? '—' },
                { l: 'Prospects',   v: String(sys.prospects ?? '—') },
                { l: 'Clients',     v: String(sys.clients ?? '—') },
                { l: 'Appels',      v: String(sys.calls ?? '—') },
              ].map(({ l, v, c }) => (
                <div key={l} className="flex justify-between py-2 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <span className="text-[11px]" style={{ color: pro.textSec }}>{l}</span>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: c ?? pro.text }}>{v}</span>
                </div>
              ))}
            </div>
          </ProCard>
        </>
      )}

      <ProSectionHead title="Cron Jobs" />
      <ProCard>
        <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as CSSProperties}>
          {CRON_ROWS.map(r => (
            <div key={r.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[12px]" style={{ color: pro.textSec }}>{r.label}</span>
              <span className="text-[11px] font-mono" style={{ color: pro.text }}>{r.schedule}</span>
            </div>
          ))}
        </div>
      </ProCard>
    </div>
  );
}
