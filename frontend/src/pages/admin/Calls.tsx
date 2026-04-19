import React, { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { Search, RefreshCw, FileText, Phone, Clock, Play, Pause, Download, ChevronDown, ChevronUp, X } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import SlideSheet from '../../components/ui/SlideSheet';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { t, glass, inputStyle } from '../../styles/admin-theme';

const OUTCOMES = ['','interested','voicemail','no_answer','rejected','converted','callback','not_interested','technical_issue'];

function fmtDuration(s?: number) {
  if (!s) return '—';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function scoreColor(s: number) {
  return s >= 7 ? t.success : s >= 4 ? t.warning : t.danger;
}

function fmtDateTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 0) return `Aujourd'hui · ${timeStr}`;
  if (diffDays === 1) return `Hier · ${timeStr}`;
  if (diffDays < 7) {
    const day = d.toLocaleDateString('fr-FR', { weekday: 'short' });
    return `${day.charAt(0).toUpperCase() + day.slice(1)} · ${timeStr}`;
  }
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ` · ${timeStr}`;
}

function downloadCSV(rows: any[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Inline audio player ──────────────────────────────────────────────────────
function AudioPlayer({ src, autoPlay = false }: { src: string; autoPlay?: boolean }) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(autoPlay);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (autoPlay && audioRef.current) {
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  }, [autoPlay]);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = ratio * duration;
  };

  return (
    <div className="flex items-center gap-3 w-full">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => { const a = audioRef.current; if (!a) return; setCurrent(a.currentTime); setProgress(a.currentTime / (a.duration || 1) * 100); }}
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration); }}
        onEnded={() => setPlaying(false)}
      />
      <button onClick={toggle} className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all"
        style={{ background: `${t.brand}20`, color: t.brand }}>
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="relative h-1.5 rounded-full cursor-pointer" style={{ background: 'rgba(255,255,255,0.08)' }} onClick={seek}>
          <div className="absolute left-0 top-0 h-full rounded-full transition-all" style={{ width: `${progress}%`, background: t.brand }} />
        </div>
        <div className="flex justify-between">
          <span className="text-[10px]" style={{ color: t.textSec }}>{fmtDuration(Math.floor(current))}</span>
          <span className="text-[10px]" style={{ color: t.textSec }}>{fmtDuration(Math.floor(duration))}</span>
        </div>
      </div>
    </div>
  );
}

// ── Mobile call card ─────────────────────────────────────────────────────────
function CallCard({ c, onSelect }: { c: any; onSelect: (c: any) => void }) {
  const [expanded, setExpanded] = useState(false);
  const score = c.interestScore ?? c.interestLevel;
  const hasRecording = !!c.recordingUrl;
  const hasTranscript = !!c.transcript || !!c.summary;

  return (
    <div className="rounded-2xl overflow-hidden transition-all" style={{ background: t.elevated, border: `1px solid ${t.border}` }}>
      {/* Main row */}
      <div className="p-3.5" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: t.text }}>
              {c.prospect?.businessName ?? c.businessName ?? '—'}
            </p>
            {c.phoneNumber && (
              <p className="text-[11px] mt-0.5 font-mono" style={{ color: t.textSec }}>{c.phoneNumber}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {score != null && (
              <span className="text-sm font-bold" style={{ color: scoreColor(score) }}>{score}<span className="text-[10px] font-normal" style={{ color: t.textSec }}>/10</span></span>
            )}
            <Badge label={c.outcome ?? 'unknown'} dot size="xs" />
          </div>
        </div>

        {/* Date + duration row — always visible on mobile */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 flex-shrink-0" style={{ color: t.textSec }} />
            <span className="text-[11px] font-medium" style={{ color: t.textSec }}>
              {fmtDateTime(c.createdAt ?? c.startedAt)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {(c.duration ?? c.durationSeconds) > 0 && (
              <span className="text-[11px]" style={{ color: t.textSec }}>
                {fmtDuration(c.duration ?? c.durationSeconds)}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              {hasRecording && <Play className="w-3 h-3" style={{ color: t.brand }} />}
              {hasTranscript && <FileText className="w-3 h-3" style={{ color: t.textTer }} />}
            </div>
            {(hasRecording || hasTranscript) && (
              <span style={{ color: t.textSec }}>
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded: audio player + summary preview */}
      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t" style={{ borderColor: t.border }}>
          {hasRecording && (
            <div className="pt-3">
              <AudioPlayer src={c.recordingUrl} />
            </div>
          )}
          {c.summary && (
            <div className="rounded-xl p-2.5" style={{ background: t.inset }}>
              <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: t.textTer }}>Résumé IA</p>
              <p className="text-[11px] leading-relaxed line-clamp-3" style={{ color: t.textSec }}>{c.summary}</p>
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(c); }}
            className="w-full py-2 rounded-xl text-[11px] font-medium transition-all"
            style={{ background: `${t.brand}15`, color: t.brand, border: `1px solid ${t.brand}30` }}>
            Voir le détail complet
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AdminCalls() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState('');
  const [minScore, setMinScore] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const { toasts, add: toast, remove } = useToast();
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), ...(search && { search }), ...(outcome && { outcome }), ...(minScore && { minScore }) });
      const { data: res } = await api.get(`/dashboard/calls?${params}`);
      setData(Array.isArray(res.calls) ? res.calls : (Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : [])));
      setTotal(res.total ?? res.pagination?.total ?? (Array.isArray(res) ? res.length : 0));
    } catch { toast('Erreur chargement', 'error'); }
    finally { setLoading(false); }
  }, [page, search, outcome, minScore]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, outcome, minScore]);

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} remove={remove} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: t.text }}>Appels</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>{total} appel{total > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCSV(data.map(c => ({
              'Business': c.prospect?.businessName ?? c.businessName ?? '',
              'Phone': c.phoneNumber ?? '',
              'Outcome': c.outcome ?? '',
              'Score': c.interestScore ?? c.interestLevel ?? '',
              'Duration': fmtDuration(c.duration ?? c.durationSeconds),
              'Date': fmtDateTime(c.createdAt ?? c.startedAt),
            })), 'calls-export.csv')}
            className="p-2 rounded-xl transition-all" style={{ background: t.elevated, color: t.textSec }}
            title="Export CSV">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={load} className="p-2 rounded-xl transition-all" style={{ background: t.elevated, color: t.textSec }}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: t.textSec }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
            style={inputStyle} className="w-full pl-8 pr-3 py-2 placeholder-[#48484A] focus:outline-none focus:border-white/[0.18]" />
        </div>
        <select value={outcome} onChange={e => setOutcome(e.target.value)} style={inputStyle} className="px-3 py-2 focus:outline-none">
          <option value="">Résultat</option>
          {OUTCOMES.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={minScore} onChange={e => setMinScore(e.target.value)} style={inputStyle} className="px-3 py-2 focus:outline-none">
          <option value="">Score</option>
          {[3, 5, 7, 8, 9].map(s => <option key={s} value={String(s)}>≥{s}</option>)}
        </select>
      </div>

      {/* Mobile: card list */}
      <div className="md:hidden space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-3.5 animate-pulse" style={{ background: t.elevated, height: 88 }} />
          ))
        ) : data.length === 0 ? (
          <div className="rounded-2xl py-12" style={glass}>
            <EmptyState icon={<Phone className="w-7 h-7" />} title="Aucun appel" />
          </div>
        ) : (
          data.map((c: any) => <CallCard key={c.id} c={c} onSelect={setSelected} />)
        )}
        <div className="pt-1"><Pagination page={page} total={total} limit={LIMIT} onChange={setPage} /></div>
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-hidden" style={glass}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${t.border}` }}>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Entreprise</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Date & heure</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Résultat</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Score</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Durée</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Lecture</th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b border-white/[0.04]">
                {[1, 2, 3, 4, 5, 6].map(j => (
                  <td key={j} className="px-3 py-3"><div className="h-3 bg-white/[0.06] rounded animate-pulse w-20" /></td>
                ))}
              </tr>
            )) : data.length === 0 ? (
              <tr><td colSpan={6}><EmptyState icon={<Phone className="w-7 h-7" />} title="Aucun appel" /></td></tr>
            ) : data.map((c: any) => (
              <tr key={c.id} onClick={() => setSelected(c)}
                className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer">
                <td className="px-3 py-3">
                  <p className="text-xs font-medium" style={{ color: t.text }}>{c.prospect?.businessName ?? c.businessName ?? '—'}</p>
                  {c.phoneNumber && <p className="text-[10px] font-mono mt-0.5" style={{ color: t.textTer }}>{c.phoneNumber}</p>}
                </td>
                <td className="px-3 py-3">
                  <span className="text-xs" style={{ color: t.text }}>{fmtDateTime(c.createdAt ?? c.startedAt)}</span>
                </td>
                <td className="px-3 py-3"><Badge label={c.outcome ?? 'unknown'} dot size="xs" /></td>
                <td className="px-3 py-3">
                  {(c.interestScore ?? c.interestLevel) != null
                    ? <span className="text-xs font-bold" style={{ color: scoreColor(c.interestScore ?? c.interestLevel) }}>{c.interestScore ?? c.interestLevel}/10</span>
                    : <span style={{ color: t.textSec }}>—</span>}
                </td>
                <td className="px-3 py-3">
                  <span className="flex items-center gap-1 text-xs" style={{ color: t.textSec }}>
                    <Clock className="w-3 h-3" />{fmtDuration(c.duration ?? c.durationSeconds)}
                  </span>
                </td>
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  {c.recordingUrl
                    ? <AudioPlayer src={c.recordingUrl} />
                    : <span className="text-xs" style={{ color: t.textTer }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 pb-4"><Pagination page={page} total={total} limit={LIMIT} onChange={setPage} /></div>
      </div>

      {/* Detail sheet */}
      <SlideSheet
        open={!!selected} onClose={() => setSelected(null)}
        title={selected?.businessName ?? selected?.prospect?.businessName ?? 'Détail appel'}
        subtitle={[selected?.outcome, fmtDuration(selected?.duration ?? selected?.durationSeconds)].filter(Boolean).join(' · ')}>
        {selected && (
          <div className="space-y-4">
            {/* Date/time prominent */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: t.elevated }}>
              <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: t.brand }} />
              <span className="text-sm font-medium" style={{ color: t.text }}>{fmtDateTime(selected.createdAt ?? selected.startedAt)}</span>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl p-3 text-center" style={{ background: t.elevated }}>
                <p className="text-base font-bold" style={{ color: scoreColor((selected.interestScore ?? selected.interestLevel) ?? 0) }}>
                  {selected.interestScore ?? selected.interestLevel ?? '—'}{(selected.interestScore ?? selected.interestLevel) ? '/10' : ''}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: t.textSec }}>Score</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: t.elevated }}>
                <p className="text-base font-bold" style={{ color: t.text }}>{fmtDuration(selected.duration ?? selected.durationSeconds)}</p>
                <p className="text-[10px] mt-0.5" style={{ color: t.textSec }}>Durée</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: t.elevated }}>
                <Badge label={selected.outcome ?? 'unknown'} dot size="xs" />
                <p className="text-[10px] mt-1" style={{ color: t.textSec }}>Résultat</p>
              </div>
            </div>

            {/* Phone */}
            {selected.phoneNumber && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: t.elevated }}>
                <Phone className="w-3.5 h-3.5" style={{ color: t.textSec }} />
                <span className="text-sm font-mono" style={{ color: t.text }}>{selected.phoneNumber}</span>
              </div>
            )}

            {/* Audio player */}
            {selected.recordingUrl && (
              <div>
                <p className="text-xs mb-2 font-medium" style={{ color: t.textSec }}>Enregistrement</p>
                <div className="rounded-xl p-3" style={{ background: t.elevated }}>
                  <AudioPlayer src={selected.recordingUrl} />
                </div>
              </div>
            )}

            {/* Summary */}
            {selected.summary && (
              <div>
                <p className="text-xs mb-2 font-medium" style={{ color: t.textSec }}>Résumé IA</p>
                <p className="text-xs leading-relaxed rounded-xl p-3" style={{ color: t.text, background: t.elevated }}>{selected.summary}</p>
              </div>
            )}

            {/* Transcript */}
            {selected.transcript && (
              <div>
                <p className="text-xs mb-2 font-medium" style={{ color: t.textSec }}>Transcription</p>
                <p className="text-xs leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl p-3" style={{ color: t.text, background: t.elevated }}>{selected.transcript}</p>
              </div>
            )}
          </div>
        )}
      </SlideSheet>
    </div>
  );
}
