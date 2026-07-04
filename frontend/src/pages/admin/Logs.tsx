import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../services/api';
import {
  RefreshCw, Trash2, Search, AlertCircle, Info, AlertTriangle, Bug,
  Wifi, WifiOff, ChevronDown, Filter, Download, Copy, Check,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { t, glass, inputStyle } from '../../styles/admin-theme';

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  service?: string;
  stack?: string;
}

const LEVEL_CONFIG = {
  error: { bg: `rgba(248,113,113,0.08)`, border: `rgba(248,113,113,0.15)`, color: t.danger, badge: 'ERROR', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  warn:  { bg: `rgba(251,191,36,0.08)`, border: `rgba(251,191,36,0.15)`, color: t.warning, badge: 'WARN',  icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  info:  { bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.04)', color: t.textSec, badge: 'INFO',  icon: <Info className="w-3.5 h-3.5" /> },
  debug: { bg: 'rgba(255,255,255,0.01)', border: 'transparent', color: t.textTer, badge: 'DEBUG', icon: <Bug className="w-3.5 h-3.5" /> },
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

  const levelFilterColors: Record<string, { bg: string; color: string }> = {
    all:   { bg: 'rgba(255,255,255,0.08)', color: t.text },
    error: { bg: 'rgba(248,113,113,0.15)', color: t.danger },
    warn:  { bg: 'rgba(251,191,36,0.15)', color: t.warning },
    info:  { bg: 'rgba(255,255,255,0.08)', color: t.textSec },
    debug: { bg: 'rgba(255,255,255,0.08)', color: t.textTer },
  };

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} remove={remove} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: t.text }}>Logs système</h1>
          <div className="flex items-center gap-3 mt-0.5">
            {connected
              ? <span className="flex items-center gap-1 text-xs" style={{ color: t.live }}><Wifi className="w-3 h-3" />Live · auto 3s</span>
              : <span className="flex items-center gap-1 text-xs" style={{ color: t.danger }}><WifiOff className="w-3 h-3" />Déconnecté</span>}
            {errorCount > 0 && <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: t.danger, background: 'rgba(248,113,113,0.1)' }}>{errorCount} erreur{errorCount > 1 ? 's' : ''}</span>}
            {warnCount > 0 && <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: t.warning, background: 'rgba(251,191,36,0.1)' }}>{warnCount} avertissement{warnCount > 1 ? 's' : ''}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const all = logs.map(l =>
                `[${l.timestamp}] ${l.level.toUpperCase()} ${l.message}${l.stack ? '\nStack: ' + l.stack : ''}`
              ).join('\n');
              copyText(all, 'all');
            }}
            title="Copier tous les logs"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-all hover:bg-white/[0.08]"
            style={{ background: t.elevated, color: t.textSec }}>
            {copiedId === 'all' ? <Check className="w-3.5 h-3.5" style={{ color: t.success }} /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{copiedId === 'all' ? 'Copié !' : 'Tout copier'}</span>
          </button>
          <button onClick={downloadLogs} title="Télécharger"
            className="p-2 rounded-xl hover:bg-white/[0.08] transition-all" style={{ background: t.elevated, color: t.textSec }}>
            <Download className="w-4 h-4" />
          </button>
          <button onClick={clearAllLogs} disabled={clearing}
            className="p-2 rounded-xl hover:bg-white/[0.08] transition-all disabled:opacity-50" style={{ background: t.elevated, color: t.textSec }}>
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => fetchLogs(undefined)}
            className="p-2 rounded-xl hover:bg-white/[0.08] transition-all" style={{ background: t.elevated, color: t.textSec }}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: t.textSec }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher dans les logs..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs focus:outline-none"
            style={{ ...inputStyle, borderRadius: '12px' }} />
        </div>

        {/* Level filter */}
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: t.panel, border: `1px solid ${t.border}` }}>
          {(['all', 'error', 'warn', 'info', 'debug'] as const).map(lvl => {
            const active = levelFilter === lvl;
            const colors = levelFilterColors[lvl];
            return (
              <button key={lvl} onClick={() => setLevelFilter(lvl)}
                className="px-3 py-1 rounded-lg text-[10px] font-medium uppercase tracking-wide transition-all"
                style={active
                  ? { background: colors.bg, color: colors.color }
                  : { color: t.textSec }}>
                {lvl}
              </button>
            );
          })}
        </div>

        {/* Auto-scroll toggle */}
        <button onClick={() => setAutoScroll(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-all"
          style={autoScroll
            ? { background: 'rgba(255,255,255,0.06)', border: `1px solid ${t.borderHi}`, color: t.text }
            : { background: t.elevated, border: `1px solid ${t.border}`, color: t.textSec }}>
          <ChevronDown className={`w-3 h-3 transition-transform ${autoScroll ? 'rotate-180' : ''}`} />
          Auto-scroll
        </button>
      </div>

      {/* Log entries */}
      <div ref={containerRef} style={glass} className="overflow-hidden">
        <div className="max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-hide font-mono text-xs">
          {loading ? (
            <div className="p-8 text-center" style={{ color: t.textSec }}>
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3" style={{ borderColor: t.textSec, borderTopColor: 'transparent' }} />
              Chargement des logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center" style={{ color: t.textSec }}>
              <Filter className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Aucun log{search ? ` pour "${search}"` : ''}</p>
              <p className="text-[10px] mt-1 opacity-60">Les logs apparaissent ici dès que le système s'active</p>
            </div>
          ) : (
            <>
              {logs.map((log) => {
                const cfg = LEVEL_CONFIG[log.level] ?? LEVEL_CONFIG.info;
                const isExpanded = expanded === log.id;
                const rowCopyId = `row-${log.id}`;
                const stackCopyId = `stack-${log.id}`;
                const logText = `[${log.timestamp}] ${log.level.toUpperCase()} ${log.message}${log.stack ? '\n' + log.stack : ''}`;
                return (
                  <div key={log.id}
                    className="group/row transition-colors"
                    style={{ borderBottom: `1px solid ${cfg.border}`, background: cfg.bg }}>
                    <div className="flex items-start gap-2 px-3 py-2 hover:bg-white/[0.03] transition-colors">
                      <span className="mt-0.5 flex-shrink-0" style={{ color: cfg.color }}>{cfg.icon}</span>

                      <span className="text-[10px] flex-shrink-0 mt-0.5 w-[120px] tabular-nums select-all" style={{ color: t.textSec }}>
                        {new Date(log.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        <span style={{ color: t.textMuted }} className="ml-1">.{new Date(log.timestamp).getMilliseconds().toString().padStart(3, '0')}</span>
                      </span>

                      <span className="text-[9px] font-bold uppercase tracking-widest w-10 flex-shrink-0 mt-0.5" style={{ color: cfg.color }}>
                        {cfg.badge}
                      </span>

                      <button
                        onClick={() => setExpanded(isExpanded ? null : log.id)}
                        className={`flex-1 min-w-0 text-left leading-relaxed break-all ${isExpanded ? '' : 'line-clamp-2'}`}
                        style={{ color: log.level === 'error' ? t.danger : log.level === 'warn' ? t.warning : t.text }}>
                        {log.message}
                      </button>

                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <button
                          onClick={() => copyText(logText, rowCopyId)}
                          title="Copier ce log"
                          className="p-1 rounded hover:bg-white/[0.08] transition-colors" style={{ color: t.textSec }}>
                          {copiedId === rowCopyId ? <Check className="w-3 h-3" style={{ color: t.success }} /> : <Copy className="w-3 h-3" />}
                        </button>
                        {log.stack && (
                          <button onClick={() => setExpanded(isExpanded ? null : log.id)} className="p-1 rounded hover:bg-white/[0.08] transition-colors" style={{ color: t.textSec }}>
                            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && log.stack && (
                      <div className="px-14 pb-3">
                        <div className="relative group/stack">
                          <pre className="text-[10px] rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all select-all"
                            style={{ color: t.textSec, background: 'rgba(0,0,0,0.3)' }}>
                            {log.stack}
                          </pre>
                          <button
                            onClick={() => copyText(log.stack!, stackCopyId)}
                            title="Copier le stack trace"
                            className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-white/[0.12] transition-all opacity-0 group-hover/stack:opacity-100"
                            style={{ background: 'rgba(255,255,255,0.06)', color: t.textSec }}>
                            {copiedId === stackCopyId ? <Check className="w-3 h-3" style={{ color: t.success }} /> : <Copy className="w-3 h-3" />}
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

        {/* Footer status bar */}
        <div className="flex items-center justify-between px-4 py-2" style={{ borderTop: `1px solid ${t.border}`, background: 'rgba(0,0,0,0.2)' }}>
          <span className="text-[10px]" style={{ color: t.textSec }}>{logs.length} entrée{logs.length > 1 ? 's' : ''} affichée{logs.length > 1 ? 's' : ''}</span>
          <span className="flex items-center gap-1 text-[10px]" style={{ color: t.live }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: t.live }} />
            Polling 3s
          </span>
        </div>
      </div>
    </div>
  );
}
