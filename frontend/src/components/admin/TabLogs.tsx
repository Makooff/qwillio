import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import { Card as ProCard, SectionHead as ProSectionHead, Pill } from '../pro/ProBlocks';

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  service?: string;
}

type LogLevel = 'all' | LogEntry['level'];

const LOG_LEVEL_COLOR: Record<string, string> = {
  error: pro.bad,
  warn:  pro.warn,
  info:  pro.info,
  debug: pro.textTer,
};

type PillColor = 'ok' | 'warn' | 'bad' | 'info' | 'accent' | 'neutral';

const LOG_PILL: Record<string, PillColor> = {
  error: 'bad',
  warn:  'warn',
  info:  'info',
  debug: 'neutral',
};

export default function TabLogs({ active }: { active: boolean }) {
  const [logs, setLogs]         = useState<LogEntry[]>([]);
  const [loading, setLoading]   = useState(false);
  const [loaded, setLoaded]     = useState(false);
  const [levelFilter, setLevel] = useState<LogLevel>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/logs?limit=50');
      const d: unknown = res.data;
      setLogs(Array.isArray(d) ? d as LogEntry[] : (d as { logs: LogEntry[] }).logs ?? []);
      setLoaded(true);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!active) return;
    if (!loaded) load();
    const id = setInterval(load, 5_000);
    return () => clearInterval(id);
  }, [active, loaded, load]);

  const filtered = levelFilter === 'all' ? logs : logs.filter(l => l.level === levelFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ProSectionHead title={`Logs (${filtered.length})`} />
        <button type="button" onClick={load} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors ml-2" style={{ color: pro.textSec }}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <div className="flex gap-1 ml-auto">
          {(['all', 'error', 'warn', 'info', 'debug'] as LogLevel[]).map(l => (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(l)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
              style={levelFilter === l
                ? { background: 'rgba(255,255,255,0.08)', color: l === 'all' ? pro.text : LOG_LEVEL_COLOR[l] }
                : { color: pro.textSec }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading && !loaded ? (
        <div className="animate-pulse rounded-2xl h-40" style={{ background: pro.panel, border: `1px solid ${pro.border}` }} />
      ) : (
        <ProCard>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-[12px]" style={{ color: pro.textSec }}>Aucun log</div>
          ) : (
            <div className="divide-y font-mono text-[11px]" style={{ '--tw-divide-opacity': 1 } as CSSProperties}>
              {filtered.map((log, i) => (
                <div key={log.id ?? i} className="flex items-start gap-3 px-4 py-2.5">
                  <Pill color={LOG_PILL[log.level] ?? 'neutral'}>{log.level.toUpperCase()}</Pill>
                  <span className="flex-shrink-0 tabular-nums" style={{ color: pro.textTer }}>
                    {new Date(log.timestamp).toLocaleTimeString('fr-FR')}
                  </span>
                  {log.service && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'rgba(255,255,255,0.04)', color: pro.textSec }}>
                      {log.service}
                    </span>
                  )}
                  <span className="flex-1 min-w-0 break-all" style={{ color: LOG_LEVEL_COLOR[log.level] ?? pro.text }}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ProCard>
      )}
    </div>
  );
}
