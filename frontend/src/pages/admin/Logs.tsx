import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../services/api';
import {
  RefreshCw, Trash2, Search, AlertCircle, Info, AlertTriangle, Bug,
  Wifi, WifiOff, ChevronDown, Filter, Download, Copy, Check,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  service?: string;
  stack?: string;
}

const LEVEL_CONFIG = {
  error: { bg: 'bg-[#EF4444]/10', border: 'border-[#EF4444]/20', text: 'text-[#EF4444]', badge: 'ERROR', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  warn:  { bg: 'bg-[#F59E0B]/10', border: 'border-[#F59E0B]/20', text: 'text-[#F59E0B]', badge: 'WARN',  icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  info:  { bg: 'bg-white/[0.02]', border: 'border-white/[0.04]', text: 'text-[#8B8BA7]', badge: 'INFO',  icon: <Info className="w-3.5 h-3.5" /> },
  debug: { bg: 'bg-white/[0.01]', border: 'border-transparent',  text: 'text-[#8B8BA7]/60', badge: 'DEBUG', icon: <Bug className="w-3.5 h-3.5" /> },
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
      // fallback for older browsers
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
        // Full reload
        setLogs(data.logs ?? []);
      } else {
        // Append new entries
        const newEntries: LogEntry[] = data.logs ?? [];
        if (newEntries.length > 0) {
          setLogs(prev => {
            const combined = [...prev, ...newEntries];
            return combined.slice(-500); // keep max 500 in UI
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

  // Initial full load
  useEffect(() => {
    setLoading(true);
    fetchLogs(undefined);
  }, [levelFilter, search]);

  // Polling for new logs every 3s
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      fetchLogs(lastId);
    }, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchLogs, lastId]);

  // Auto-scroll to bottom when new logs arrive
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

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} remove={remove} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">Logs système</h1>
          <div className="flex items-center gap-3 mt-0.5">
            {connected
              ? <span className="flex items-center gap-1 text-xs text-[#22C55E]"><Wifi className="w-3 h-3" />Live · auto 3s</span>
              : <span className="flex items-center gap-1 text-xs text-[#EF4444]"><WifiOff className="w-3 h-3" />Déconnecté</span>}
            {errorCount > 0 && <span className="text-xs font-medium text-[#EF4444] bg-[#EF4444]/10 px-2 py-0.5 rounded-full">{errorCount} erreur{errorCount > 1 ? 's' : ''}</span>}
            {warnCount > 0 && <span className="text-xs font-medium text-[#F59E0B] bg-[#F59E0B]/10 px-2 py-0.5 rounded-full">{warnCount} avertissement{warnCount > 1 ? 's' : ''}</span>}
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
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7] hover:text-[#F8F8FF] text-xs transition-all">
            {copiedId === 'all' ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{copiedId === 'all' ? 'Copié !' : 'Tout copier'}</span>
          </button>
          <button onClick={downloadLogs} title="Télécharger"
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7] transition-all">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={clearAllLogs} disabled={clearing}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-[#EF4444]/10 text-[#8B8BA7] hover:text-[#EF4444] transition-all disabled:opacity-50">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => fetchLogs(undefined)}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7] transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B8BA7]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher dans les logs..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#12121A] border border-white/[0.06] text-xs text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7B5CF0]/50" />
        </div>

        {/* Level filter */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#12121A] border border-white/[0.06]">
          {(['all', 'error', 'warn', 'info', 'debug'] as const).map(lvl => (
            <button key={lvl} onClick={() => setLevelFilter(lvl)}
              className={`px-3 py-1 rounded-lg text-[10px] font-medium uppercase tracking-wide transition-all ${
                levelFilter === lvl
                  ? lvl === 'error' ? 'bg-[#EF4444]/20 text-[#EF4444]'
                  : lvl === 'warn' ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                  : lvl === 'info' ? 'bg-[#7B5CF0]/20 text-[#7B5CF0]'
                  : lvl === 'debug' ? 'bg-white/[0.08] text-[#8B8BA7]'
                  : 'bg-white/[0.08] text-[#F8F8FF]'
                  : 'text-[#8B8BA7] hover:text-[#F8F8FF]'
              }`}>
              {lvl}
            </button>
          ))}
        </div>

        {/* Auto-scroll toggle */}
        <button onClick={() => setAutoScroll(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border transition-all ${
            autoScroll ? 'bg-[#7B5CF0]/10 border-[#7B5CF0]/30 text-[#7B5CF0]' : 'bg-white/[0.04] border-white/[0.06] text-[#8B8BA7]'
          }`}>
          <ChevronDown className={`w-3 h-3 transition-transform ${autoScroll ? 'rotate-180' : ''}`} />
          Auto-scroll
        </button>
      </div>

      {/* Log entries */}
      <div
        ref={containerRef}
        className="rounded-2xl bg-[#12121A] border border-white/[0.06] overflow-hidden"
      >
        <div className="max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-hide font-mono text-xs">
          {loading ? (
            <div className="p-8 text-center text-[#8B8BA7]">
              <div className="w-6 h-6 rounded-full border-2 border-[#7B5CF0] border-t-transparent animate-spin mx-auto mb-3" />
              Chargement des logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-[#8B8BA7]">
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
                    className={`group/row border-b last:border-b-0 ${cfg.border} ${cfg.bg} transition-colors`}>
                    <div className="flex items-start gap-2 px-3 py-2 hover:bg-white/[0.03] transition-colors">
                      {/* Level icon */}
                      <span className={`mt-0.5 flex-shrink-0 ${cfg.text}`}>{cfg.icon}</span>

                      {/* Timestamp */}
                      <span className="text-[10px] text-[#8B8BA7] flex-shrink-0 mt-0.5 w-[120px] tabular-nums select-all">
                        {new Date(log.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        <span className="text-[#8B8BA7]/50 ml-1">.{new Date(log.timestamp).getMilliseconds().toString().padStart(3, '0')}</span>
                      </span>

                      {/* Level badge */}
                      <span className={`text-[9px] font-bold uppercase tracking-widest w-10 flex-shrink-0 mt-0.5 ${cfg.text}`}>
                        {cfg.badge}
                      </span>

                      {/* Message — clickable to expand */}
                      <button
                        onClick={() => setExpanded(isExpanded ? null : log.id)}
                        className={`flex-1 min-w-0 text-left leading-relaxed break-all ${
                          log.level === 'error' ? 'text-[#EF4444]'
                          : log.level === 'warn' ? 'text-[#F59E0B]'
                          : 'text-[#F8F8FF]'
                        } ${isExpanded ? '' : 'line-clamp-2'}`}>
                        {log.message}
                      </button>

                      {/* Actions (copy + expand) */}
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <button
                          onClick={() => copyText(logText, rowCopyId)}
                          title="Copier ce log"
                          className="p-1 rounded hover:bg-white/[0.08] text-[#8B8BA7] hover:text-[#F8F8FF] transition-colors">
                          {copiedId === rowCopyId ? <Check className="w-3 h-3 text-[#22C55E]" /> : <Copy className="w-3 h-3" />}
                        </button>
                        {log.stack && (
                          <button onClick={() => setExpanded(isExpanded ? null : log.id)} className="p-1 rounded hover:bg-white/[0.08] text-[#8B8BA7] transition-colors">
                            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stack trace */}
                    {isExpanded && log.stack && (
                      <div className="px-14 pb-3">
                        <div className="relative group/stack">
                          <pre className="text-[10px] text-[#8B8BA7] bg-black/30 rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all select-all">
                            {log.stack}
                          </pre>
                          <button
                            onClick={() => copyText(log.stack!, stackCopyId)}
                            title="Copier le stack trace"
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[#8B8BA7] hover:text-[#F8F8FF] transition-all opacity-0 group-hover/stack:opacity-100">
                            {copiedId === stackCopyId ? <Check className="w-3 h-3 text-[#22C55E]" /> : <Copy className="w-3 h-3" />}
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
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] bg-black/20">
          <span className="text-[10px] text-[#8B8BA7]">{logs.length} entrée{logs.length > 1 ? 's' : ''} affichée{logs.length > 1 ? 's' : ''}</span>
          <span className="flex items-center gap-1 text-[10px] text-[#22C55E]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
            Polling 3s
          </span>
        </div>
      </div>
    </div>
  );
}
