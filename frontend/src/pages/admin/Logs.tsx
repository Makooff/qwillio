import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../services/api';
import {
  RefreshCw, Trash2, Search, AlertCircle, Info, AlertTriangle, Bug,
  Wifi, WifiOff, ChevronDown, Filter, Download, Copy, Check,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, IconBtn, Pill,
} from '../../components/pro/ProBlocks';

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  service?: string;
  stack?: string;
}

type PillColor = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';

const LEVEL_META: Record<LogEntry['level'], { color: string; pill: PillColor; icon: any; label: string }> = {
  error: { color: pro.bad,  pill: 'bad',     icon: AlertCircle,    label: 'ERROR' },
  warn:  { color: pro.warn, pill: 'warn',    icon: AlertTriangle,  label: 'WARN'  },
  info:  { color: pro.info, pill: 'info',    icon: Info,           label: 'INFO'  },
  debug: { color: pro.textTer, pill: 'neutral', icon: Bug,          label: 'DEBUG' },
};

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastId, setLastId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toasts, add: toast, remove } = useToast();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const copyText = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }, []);

  const fetchLogs = useCallback(async (since?: number) => {
    try {
      const params = new URLSearchParams();
      if (since != null) params.set('since', String(since));
      if (levelFilter !== 'all') params.set('level', levelFilter);
      if (search) params.set('search', search);
      const { data } = await api.get(`/admin/logs?${params}`);
      setConnected(true);
      if (since == null) {
        setLogs(data.logs ?? []);
      } else {
        const newEntries: LogEntry[] = data.logs ?? [];
        if (newEntries.length > 0) {
          setLogs(prev => {
            const combined = [...prev, ...newEntries];
            return combined.slice(-500);
          });
        }
      }
      setLastId(data.lastId ?? 0);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [levelFilter, search]);

  useEffect(() => {
    setLoading(true);
    fetchLogs(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelFilter, search]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      fetchLogs(lastId);
    }, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchLogs, lastId]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const clearAllLogs = async () => {
    setClearing(true);
    try {
      await api.delete('/admin/logs');
      setLogs([]);
      setLastId(0);
      toast('Logs effacés', 'success');
    } catch {
      toast('Erreur suppression logs', 'error');
    } finally {
      setClearing(false);
    }
  };

  const downloadLogs = () => {
    const text = logs.map(l =>
      `[${l.timestamp}] ${l.level.toUpperCase()} ${l.message}${l.stack ? '\n' + l.stack : ''}`
    ).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qwillio-logs-${new Date().toISOString().slice(0, 19)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  const LEVELS: Array<'all' | LogEntry['level']> = ['all', 'error', 'warn', 'info', 'debug'];

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Logs système"
        subtitle={
          connected
            ? `Live · auto 3s · ${logs.length} entrée${logs.length > 1 ? 's' : ''}`
            : 'Déconnecté — tentative de reconnexion…'
        }
        right={
          <>
            <IconBtn
              title="Tout copier"
              onClick={() => {
                const all = logs.map(l =>
                  `[${l.timestamp}] ${l.level.toUpperCase()} ${l.message}${l.stack ? '\nStack: ' + l.stack : ''}`
                ).join('\n');
                copyText(all, 'all');
              }}
            >
              {copiedId === 'all' ? <Check className="w-4 h-4" style={{ color: pro.ok }} /> : <Copy className="w-4 h-4" />}
            </IconBtn>
            <IconBtn title="Télécharger" onClick={downloadLogs}>
              <Download className="w-4 h-4" />
            </IconBtn>
            <IconBtn title="Effacer" onClick={clearAllLogs}>
              <Trash2 className={`w-4 h-4 ${clearing ? 'opacity-50' : ''}`} />
            </IconBtn>
            <IconBtn title="Rafraîchir" onClick={() => fetchLogs(undefined)}>
              <RefreshCw className="w-4 h-4" />
            </IconBtn>
          </>
        }
      />

      {/* Status chips row */}
      <div className="flex flex-wrap items-center gap-2">
        {connected ? (
          <Pill color="ok"><span className="inline-flex items-center gap-1"><Wifi className="w-3 h-3" />LIVE</span></Pill>
        ) : (
          <Pill color="bad"><span className="inline-flex items-center gap-1"><WifiOff className="w-3 h-3" />OFFLINE</span></Pill>
        )}
        {errorCount > 0 && <Pill color="bad">{errorCount} ERREUR{errorCount > 1 ? 'S' : ''}</Pill>}
        {warnCount > 0 && <Pill color="warn">{warnCount} AVERTISSEMENT{warnCount > 1 ? 'S' : ''}</Pill>}
      </div>

      {/* Search + level filter */}
      <Card>
        <div className="flex items-center gap-2.5 px-4 h-11">
          <Search className="w-4 h-4" style={{ color: pro.textTer }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher dans les logs…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder-[#6B6B75]"
            style={{ color: pro.text }}
          />
          {search && <button onClick={() => setSearch('')} className="text-[11px]" style={{ color: pro.textSec }}>Effacer</button>}
        </div>
        <div className="flex flex-wrap items-center gap-2 px-3 pb-3" style={{ borderTop: `1px solid ${pro.border}`, paddingTop: 12 }}>
          <div className="flex items-center gap-1 p-1 rounded-xl"
               style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
            {LEVELS.map(lvl => {
              const active = levelFilter === lvl;
              const color = lvl === 'all' ? pro.text
                : lvl === 'error' ? pro.bad
                : lvl === 'warn'  ? pro.warn
                : lvl === 'info'  ? pro.info
                : pro.textTer;
              return (
                <button
                  key={lvl}
                  onClick={() => setLevelFilter(lvl)}
                  className="px-3 h-7 rounded-lg text-[10.5px] font-semibold uppercase tracking-wider transition-colors"
                  style={active
                    ? { background: 'rgba(255,255,255,0.06)', color }
                    : { color: pro.textSec }}
                >
                  {lvl}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setAutoScroll(v => !v)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-[12px] transition-colors"
            style={autoScroll
              ? { background: 'rgba(255,255,255,0.06)', border: `1px solid ${pro.borderHi}`, color: pro.text }
              : { background: pro.panel, border: `1px solid ${pro.border}`, color: pro.textSec }}
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${autoScroll ? 'rotate-180' : ''}`} />
            Auto-scroll
          </button>
        </div>
      </Card>

      {/* Log list */}
      <Card>
        <div ref={containerRef} className="overflow-hidden">
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto font-mono text-[11.5px]">
            {loading ? (
              <div className="p-10 text-center" style={{ color: pro.textSec }}>
                <div className="w-6 h-6 rounded-full border-2 animate-spin mx-auto mb-3"
                     style={{ borderColor: pro.border, borderTopColor: pro.text }} />
                Chargement des logs…
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center" style={{ color: pro.textTer }}>
                <Filter className="w-6 h-6 mx-auto mb-3 opacity-60" />
                <p className="text-[13px]" style={{ color: pro.textSec }}>
                  Aucun log{search ? ` pour "${search}"` : ''}
                </p>
                <p className="text-[11px] mt-1">Les logs apparaissent ici dès que le système s'active</p>
              </div>
            ) : (
              <>
                {logs.map((log, i) => {
                  const meta = LEVEL_META[log.level] ?? LEVEL_META.info;
                  const Icon = meta.icon;
                  const isExpanded = expanded === log.id;
                  const rowCopyId = `row-${log.id}`;
                  const stackCopyId = `stack-${log.id}`;
                  const logText = `[${log.timestamp}] ${log.level.toUpperCase()} ${log.message}${log.stack ? '\n' + log.stack : ''}`;
                  const ts = new Date(log.timestamp);
                  return (
                    <div key={log.id}
                         className="group/row transition-colors hover:bg-white/[0.02]"
                         style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}>
                      <div className="flex items-start gap-2.5 px-4 py-2">
                        <span className="mt-0.5 flex-shrink-0" style={{ color: meta.color }}>
                          <Icon className="w-3.5 h-3.5" />
                        </span>

                        <span className="text-[11px] flex-shrink-0 mt-0.5 w-[110px] tabular-nums select-all"
                              style={{ color: pro.textTer }}>
                          {ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          <span className="ml-1" style={{ opacity: 0.6 }}>
                            .{ts.getMilliseconds().toString().padStart(3, '0')}
                          </span>
                        </span>

                        <div className="flex-shrink-0 mt-0.5 w-14">
                          <Pill color={meta.pill}>{meta.label}</Pill>
                        </div>

                        <button
                          onClick={() => setExpanded(isExpanded ? null : log.id)}
                          className={`flex-1 min-w-0 text-left leading-relaxed break-all ${isExpanded ? '' : 'line-clamp-2'}`}
                          style={{
                            color: log.level === 'error' ? pro.bad
                              : log.level === 'warn'    ? pro.warn
                              : pro.text,
                          }}>
                          {log.message}
                        </button>

                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button
                            onClick={() => copyText(logText, rowCopyId)}
                            title="Copier ce log"
                            className="p-1 rounded hover:bg-white/[0.06] transition-colors"
                            style={{ color: pro.textSec }}>
                            {copiedId === rowCopyId
                              ? <Check className="w-3 h-3" style={{ color: pro.ok }} />
                              : <Copy className="w-3 h-3" />}
                          </button>
                          {log.stack && (
                            <button
                              onClick={() => setExpanded(isExpanded ? null : log.id)}
                              className="p-1 rounded hover:bg-white/[0.06] transition-colors"
                              style={{ color: pro.textSec }}>
                              <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && log.stack && (
                        <div className="px-14 pb-3">
                          <div className="relative group/stack">
                            <pre className="text-[10.5px] rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all select-all"
                                 style={{ color: pro.textSec, background: 'rgba(0,0,0,0.35)', border: `1px solid ${pro.border}` }}>
                              {log.stack}
                            </pre>
                            <button
                              onClick={() => copyText(log.stack!, stackCopyId)}
                              title="Copier le stack trace"
                              className="absolute top-2 right-2 p-1.5 rounded-lg transition-colors opacity-0 group-hover/stack:opacity-100 hover:bg-white/[0.08]"
                              style={{ background: 'rgba(255,255,255,0.04)', color: pro.textSec }}>
                              {copiedId === stackCopyId
                                ? <Check className="w-3 h-3" style={{ color: pro.ok }} />
                                : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2"
               style={{ borderTop: `1px solid ${pro.border}` }}>
            <span className="text-[11px] tabular-nums" style={{ color: pro.textTer }}>
              {logs.length} entrée{logs.length > 1 ? 's' : ''} affichée{logs.length > 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: pro.textSec }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: connected ? pro.ok : pro.bad }} />
              Polling 3s
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
