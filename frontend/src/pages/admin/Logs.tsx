import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../services/api';
import {
  RefreshCw, Trash2, Search, AlertCircle, Info, AlertTriangle, Bug,
  Wifi, WifiOff, ChevronDown, ChevronLeft, ChevronRight, Filter,
  Copy, Check, Download, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import { PageHeader, Card, IconBtn, Pill } from '../../components/pro/ProBlocks';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  service?: string;
  stack?: string;
}

type PillColor = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';
type Level = 'all' | LogEntry['level'];

// ─── Level metadata ───────────────────────────────────────────────────────────

const LEVEL_META: Record<LogEntry['level'], { pill: PillColor; icon: React.ElementType; abbr: string; border: string }> = {
  error: { pill: 'bad',     icon: AlertCircle,   abbr: 'E', border: pro.bad },
  warn:  { pill: 'warn',    icon: AlertTriangle, abbr: 'W', border: pro.warn },
  info:  { pill: 'info',    icon: Info,          abbr: 'I', border: 'transparent' },
  debug: { pill: 'neutral', icon: Bug,           abbr: 'D', border: pro.textTer },
};

const LEVELS: Level[] = ['all', 'error', 'warn', 'info', 'debug'];

const LEVEL_COLORS: Record<string, string> = {
  all:   pro.text,
  error: pro.bad,
  warn:  pro.warn,
  info:  pro.info,
  debug: pro.textTer,
};

const LIMIT = 100;

// ─── Component ────────────────────────────────────────────────────────────────

export default function Logs() {
  const [logs, setLogs]               = useState<LogEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [connected, setConnected]     = useState(true);
  const [levelFilter, setLevelFilter] = useState<Level>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [search, setSearch]           = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expanded, setExpanded]       = useState<number | null>(null);
  const [clearing, setClearing]       = useState(false);
  const [copiedId, setCopiedId]       = useState<string | null>(null);
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toasts, add: toast, remove } = useToast();

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchLogs = useCallback(async (p = page) => {
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), page: String(p) });
      if (levelFilter !== 'all') params.set('level', levelFilter);
      if (serviceFilter !== 'all') params.set('service', serviceFilter);
      const { data } = await api.get(`/bot/logs?${params}`);
      setConnected(true);
      setLogs(data.logs ?? []);
      if (data.total != null) setTotalPages(Math.max(1, Math.ceil(data.total / LIMIT)));
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [levelFilter, serviceFilter, page]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
    setLoading(true);
    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelFilter, serviceFilter]);

  useEffect(() => {
    fetchLogs(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Auto-refresh every 5s
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(() => fetchLogs(page), 5000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchLogs, page]);

  // Auto-scroll on new logs
  useEffect(() => {
    if (autoRefresh && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoRefresh]);

  // ── Derived ───────────────────────────────────────────────────────────────────

  // Extract unique services for filter chips
  const services = ['all', ...Array.from(new Set(logs.map(l => l.service).filter(Boolean) as string[]))];

  // Client-side search filter
  const visible = search
    ? logs.filter(l => l.message.toLowerCase().includes(search.toLowerCase()))
    : logs;

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount  = logs.filter(l => l.level === 'warn').length;

  // ── Actions ───────────────────────────────────────────────────────────────────

  const copyText = (text: string, id: string) => {
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
  };

  const clearAllLogs = async () => {
    setClearing(true);
    try {
      await api.delete('/admin/logs');
      setLogs([]);
      setPage(1);
      toast('Logs effacés', 'success');
    } catch {
      toast('Erreur suppression logs', 'error');
    } finally {
      setClearing(false);
    }
  };

  const downloadLogs = () => {
    const text = logs
      .map(l => `[${l.timestamp}] ${l.level.toUpperCase()}${l.service ? ` [${l.service}]` : ''} ${l.message}${l.stack ? '\n' + l.stack : ''}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `qwillio-logs-${new Date().toISOString().slice(0, 19)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyAll = () => {
    const text = logs
      .map(l => `[${l.timestamp}] ${l.level.toUpperCase()} ${l.message}${l.stack ? '\nStack: ' + l.stack : ''}`)
      .join('\n');
    copyText(text, 'all');
  };

  const fmtTs = (ts: string) => {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Logs système"
        subtitle="Flux d'événements en temps réel"
        right={
          <>
            <IconBtn title="Tout copier" onClick={copyAll}>
              {copiedId === 'all'
                ? <Check className="w-4 h-4" style={{ color: pro.ok }} />
                : <Copy className="w-4 h-4" />}
            </IconBtn>
            <IconBtn title="Télécharger" onClick={downloadLogs}>
              <Download className="w-4 h-4" />
            </IconBtn>
            <IconBtn title="Vider les logs" onClick={clearAllLogs}>
              <Trash2 className={`w-4 h-4 ${clearing ? 'opacity-40' : ''}`} />
            </IconBtn>
            <IconBtn title="Rafraîchir" onClick={() => fetchLogs(page)}>
              <RefreshCw className="w-4 h-4" />
            </IconBtn>
          </>
        }
      />

      {/* Status chips */}
      <div className="flex flex-wrap items-center gap-2">
        {connected
          ? <Pill color="ok"><span className="inline-flex items-center gap-1"><Wifi className="w-3 h-3" />LIVE</span></Pill>
          : <Pill color="bad"><span className="inline-flex items-center gap-1"><WifiOff className="w-3 h-3" />OFFLINE</span></Pill>}
        {errorCount > 0 && <Pill color="bad">{errorCount} ERREUR{errorCount > 1 ? 'S' : ''}</Pill>}
        {warnCount  > 0 && <Pill color="warn">{warnCount} AVERTISSEMENT{warnCount > 1 ? 'S' : ''}</Pill>}
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <Card>
        {/* Search row */}
        <div className="flex items-center gap-2.5 px-4 h-11">
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: pro.textTer }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher dans les logs…"
            className="flex-1 bg-transparent text-[13px] outline-none"
            style={{ color: pro.text }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-[11px]" style={{ color: pro.textSec }}>
              Effacer
            </button>
          )}
        </div>

        {/* Level + service chips + auto-refresh */}
        <div
          className="flex flex-wrap items-center gap-3 px-3 pb-3 pt-3"
          style={{ borderTop: `1px solid ${pro.border}` }}
        >
          {/* Level chips */}
          <div className="flex items-center gap-1 p-1 rounded-xl"
               style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
            {LEVELS.map(lvl => {
              const active = levelFilter === lvl;
              return (
                <button
                  key={lvl}
                  onClick={() => setLevelFilter(lvl)}
                  className="px-3 h-7 rounded-lg text-[10.5px] font-semibold uppercase tracking-wider transition-colors"
                  style={active
                    ? { background: 'rgba(255,255,255,0.06)', color: LEVEL_COLORS[lvl] }
                    : { color: pro.textTer }}
                >
                  {lvl}
                </button>
              );
            })}
          </div>

          {/* Service chips */}
          {services.length > 1 && (
            <div className="flex items-center gap-1 p-1 rounded-xl"
                 style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
              {services.map(svc => {
                const active = serviceFilter === svc;
                return (
                  <button
                    key={svc}
                    onClick={() => setServiceFilter(svc)}
                    className="px-3 h-7 rounded-lg text-[10.5px] font-medium transition-colors"
                    style={active
                      ? { background: 'rgba(255,255,255,0.06)', color: pro.text }
                      : { color: pro.textTer }}
                  >
                    {svc}
                  </button>
                );
              })}
            </div>
          )}

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-[12px] transition-colors ml-auto"
            style={autoRefresh
              ? { background: 'rgba(255,255,255,0.06)', border: `1px solid ${pro.borderHi}`, color: pro.text }
              : { background: pro.panel, border: `1px solid ${pro.border}`, color: pro.textSec }}
          >
            {autoRefresh
              ? <ToggleRight className="w-4 h-4" style={{ color: pro.ok }} />
              : <ToggleLeft  className="w-4 h-4" />}
            Auto-refresh
          </button>
        </div>
      </Card>

      {/* ── Log table ────────────────────────────────────────────────────────── */}
      <Card>
        <div className="max-h-[calc(100vh-340px)] overflow-y-auto font-mono text-[11.5px]">
          {loading ? (
            <div className="p-10 text-center" style={{ color: pro.textSec }}>
              <div className="w-6 h-6 rounded-full border-2 animate-spin mx-auto mb-3"
                   style={{ borderColor: pro.border, borderTopColor: pro.text }} />
              Chargement des logs…
            </div>
          ) : visible.length === 0 ? (
            <div className="p-12 text-center" style={{ color: pro.textTer }}>
              <Filter className="w-6 h-6 mx-auto mb-3 opacity-60" />
              <p className="text-[13px]" style={{ color: pro.textSec }}>
                Aucun log{search ? ` pour "${search}"` : ''}
              </p>
              <p className="text-[11px] mt-1">Les logs apparaissent ici dès que le système s'active</p>
            </div>
          ) : (
            <>
              {visible.map((log, i) => {
                const meta       = LEVEL_META[log.level] ?? LEVEL_META.info;
                const Icon       = meta.icon;
                const isExpanded = expanded === log.id;
                const rowCopyId  = `row-${log.id}`;
                const stackCopyId = `stack-${log.id}`;
                const logText    = `[${log.timestamp}] ${log.level.toUpperCase()} ${log.message}${log.stack ? '\n' + log.stack : ''}`;
                return (
                  <div
                    key={log.id}
                    className="group/row transition-colors hover:bg-white/[0.02]"
                    style={{
                      borderTop:  i > 0 ? `1px solid ${pro.border}` : undefined,
                      borderLeft: `2px solid ${meta.border}`,
                    }}
                  >
                    <div className="flex items-start gap-2.5 px-4 py-2">
                      {/* Level icon */}
                      <span className="mt-0.5 flex-shrink-0" style={{ color: LEVEL_COLORS[log.level] }}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>

                      {/* Timestamp */}
                      <span
                        className="text-[10.5px] flex-shrink-0 mt-0.5 w-[80px] tabular-nums select-all"
                        style={{ color: pro.textTer }}
                      >
                        {fmtTs(log.timestamp)}
                      </span>

                      {/* Level pill (compact) */}
                      <div className="flex-shrink-0 mt-0.5 w-12">
                        <Pill color={meta.pill}>{meta.abbr}</Pill>
                      </div>

                      {/* Service pill */}
                      {log.service && (
                        <div className="flex-shrink-0 mt-0.5">
                          <Pill color="neutral">{log.service}</Pill>
                        </div>
                      )}

                      {/* Message */}
                      <button
                        onClick={() => setExpanded(isExpanded ? null : log.id)}
                        className={`flex-1 min-w-0 text-left leading-relaxed break-all ${isExpanded ? '' : 'line-clamp-2'}`}
                        style={{
                          color: log.level === 'error' ? pro.bad
                            : log.level === 'warn'    ? pro.warn
                            : pro.text,
                        }}
                      >
                        {log.message}
                      </button>

                      {/* Row actions (hover) */}
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <button
                          onClick={() => copyText(logText, rowCopyId)}
                          title="Copier"
                          className="p-1 rounded hover:bg-white/[0.06] transition-colors"
                          style={{ color: pro.textSec }}
                        >
                          {copiedId === rowCopyId
                            ? <Check className="w-3 h-3" style={{ color: pro.ok }} />
                            : <Copy  className="w-3 h-3" />}
                        </button>
                        {log.stack && (
                          <button
                            onClick={() => setExpanded(isExpanded ? null : log.id)}
                            className="p-1 rounded hover:bg-white/[0.06] transition-colors"
                            style={{ color: pro.textSec }}
                          >
                            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stack trace expansion */}
                    {isExpanded && log.stack && (
                      <div className="px-14 pb-3">
                        <div className="relative group/stack">
                          <pre
                            className="text-[10.5px] rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all select-all"
                            style={{ color: pro.textSec, background: 'rgba(0,0,0,0.35)', border: `1px solid ${pro.border}` }}
                          >
                            {log.stack}
                          </pre>
                          <button
                            onClick={() => copyText(log.stack!, stackCopyId)}
                            title="Copier le stack trace"
                            className="absolute top-2 right-2 p-1.5 rounded-lg transition-colors opacity-0 group-hover/stack:opacity-100 hover:bg-white/[0.08]"
                            style={{ background: 'rgba(255,255,255,0.04)', color: pro.textSec }}
                          >
                            {copiedId === stackCopyId
                              ? <Check className="w-3 h-3" style={{ color: pro.ok }} />
                              : <Copy  className="w-3 h-3" />}
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

        {/* Table footer */}
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ borderTop: `1px solid ${pro.border}` }}
        >
          <span className="text-[11px] tabular-nums" style={{ color: pro.textTer }}>
            {visible.length} entrée{visible.length !== 1 ? 's' : ''} affichée{visible.length !== 1 ? 's' : ''}
            {search ? ` (filtrées sur "${search}")` : ''}
          </span>
          <span className="flex items-center gap-1.5 text-[11px]" style={{ color: pro.textSec }}>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: connected ? pro.ok : pro.bad, animation: autoRefresh ? 'pulse 2s infinite' : 'none' }}
            />
            {autoRefresh ? 'Auto 5s' : 'Pause'}
          </span>
        </div>
      </Card>

      {/* ── Pagination ────────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors disabled:opacity-30"
            style={{ color: pro.textSec }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[12px] tabular-nums" style={{ color: pro.textSec }}>
            Page <span style={{ color: pro.text, fontWeight: 600 }}>{page}</span> / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors disabled:opacity-30"
            style={{ color: pro.textSec }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
