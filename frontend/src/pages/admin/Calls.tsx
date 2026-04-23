import React, { useEffect, useState, useCallback, useMemo } from 'react';
import api from '../../services/api';
import {
  Search, RefreshCw, FileText, Phone, Clock, Play, Pause, Download,
} from 'lucide-react';
import QwillioLoader from '../../components/QwillioLoader';
import SlideSheet from '../../components/ui/SlideSheet';
import Pagination from '../../components/ui/Pagination';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, Stat, IconBtn, Pill,
} from '../../components/pro/ProBlocks';

const OUTCOMES = ['', 'interested', 'voicemail', 'no_answer', 'rejected', 'converted', 'callback', 'not_interested', 'technical_issue'];

function fmtDuration(s?: number) {
  if (!s) return '—';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function fmtDateTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `${dateStr} · ${timeStr}`;
}

type PillColor = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';
function outcomeColor(o?: string): PillColor {
  switch ((o || '').toLowerCase()) {
    case 'interested':
    case 'converted':      return 'ok';
    case 'callback':       return 'info';
    case 'voicemail':
    case 'no_answer':      return 'warn';
    case 'rejected':
    case 'not_interested':
    case 'technical_issue': return 'bad';
    default:               return 'neutral';
  }
}

function scoreColor(s: number): PillColor {
  return s >= 7 ? 'ok' : s >= 4 ? 'warn' : 'bad';
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

// Inline audio player
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

  const toggle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = ratio * duration;
  };

  return (
    <div className="flex items-center gap-2.5 w-full">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => { const a = audioRef.current; if (!a) return; setCurrent(a.currentTime); setProgress(a.currentTime / (a.duration || 1) * 100); }}
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration); }}
        onEnded={() => setPlaying(false)}
      />
      <button onClick={toggle} className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
        style={{ background: 'rgba(255,255,255,0.06)', color: pro.text }}>
        {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="relative h-1 rounded-full cursor-pointer"
             style={{ background: 'rgba(255,255,255,0.06)' }} onClick={seek}>
          <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${progress}%`, background: pro.text }} />
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] tabular-nums" style={{ color: pro.textTer }}>{fmtDuration(Math.floor(current))}</span>
          <span className="text-[10px] tabular-nums" style={{ color: pro.textTer }}>{fmtDuration(Math.floor(duration))}</span>
        </div>
      </div>
    </div>
  );
}

// Select — minimal styled
function ProSelect({
  value, onChange, children,
}: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-9 px-3 text-[12.5px] rounded-xl outline-none cursor-pointer"
      style={{ background: pro.panel, border: `1px solid ${pro.border}`, color: pro.text }}
    >
      {children}
    </select>
  );
}

export default function AdminCalls() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState('');
  const [minScore, setMinScore] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const { toasts, add: toast, remove } = useToast();
  const LIMIT = 25;

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), ...(search && { search }), ...(outcome && { outcome }), ...(minScore && { minScore }) });
      const { data: res } = await api.get(`/dashboard/calls?${params}`);
      setData(Array.isArray(res.calls) ? res.calls : (Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : [])));
      setTotal(res.total ?? res.pagination?.total ?? (Array.isArray(res) ? res.length : 0));
    } catch { toast('Erreur chargement', 'error'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [page, search, outcome, minScore]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, outcome, minScore]);

  const stats = useMemo(() => {
    const today = new Date();
    const todayCount = data.filter((c: any) => {
      const d = new Date(c.createdAt ?? c.startedAt);
      return d.toDateString() === today.toDateString();
    }).length;
    const durations = data
      .map((c: any) => Number(c.duration ?? c.durationSeconds ?? 0))
      .filter((n) => Number.isFinite(n) && n > 0);
    const avgDur = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const successful = data.filter((c: any) =>
      ['interested', 'converted', 'callback'].includes((c.outcome || '').toLowerCase())
    ).length;
    const successRate = data.length ? Math.round((successful / data.length) * 100) : 0;
    return { todayCount, avgDur, successRate };
  }, [data]);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <QwillioLoader size={120} fullscreen={false} />
    </div>
  );

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Appels"
        subtitle={`${total} appel${total > 1 ? 's' : ''}`}
        right={
          <>
            <IconBtn
              title="Export CSV"
              onClick={() => downloadCSV(data.map((c: any) => ({
                'Business': c.prospect?.businessName ?? c.businessName ?? '',
                'Phone': c.phoneNumber ?? '',
                'Outcome': c.outcome ?? '',
                'Score': c.interestScore ?? c.interestLevel ?? '',
                'Duration': fmtDuration(c.duration ?? c.durationSeconds),
                'Date': fmtDateTime(c.createdAt ?? c.startedAt),
              })), 'calls-export.csv')}
            >
              <Download className="w-4 h-4" />
            </IconBtn>
            <IconBtn onClick={load} title="Rafraîchir">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </IconBtn>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total" value={total} hint="Tous les appels" />
        <Stat label="Aujourd'hui" value={stats.todayCount} hint="Sur cette page" />
        <Stat label="Durée moyenne" value={fmtDuration(Math.floor(stats.avgDur))} hint="Par appel" />
        <Stat label="Taux réussite" value={`${stats.successRate}%`} hint="Intéressés / convertis" />
      </div>

      {/* Search + filters */}
      <Card>
        <div className="flex items-center gap-2.5 px-4 h-11">
          <Search className="w-4 h-4" style={{ color: pro.textTer }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par entreprise ou téléphone…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder-[#6B6B75]"
            style={{ color: pro.text }}
          />
          {search && <button onClick={() => setSearch('')} className="text-[11px]" style={{ color: pro.textSec }}>Effacer</button>}
        </div>
        <div className="flex flex-wrap gap-2 px-3 pb-3" style={{ borderTop: `1px solid ${pro.border}`, paddingTop: 12 }}>
          <ProSelect value={outcome} onChange={setOutcome}>
            <option value="">Tous les résultats</option>
            {OUTCOMES.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
          </ProSelect>
          <ProSelect value={minScore} onChange={setMinScore}>
            <option value="">Score minimum</option>
            {[3, 5, 7, 8, 9].map(s => <option key={s} value={String(s)}>≥ {s}</option>)}
          </ProSelect>
          {(outcome || minScore) && (
            <button
              onClick={() => { setOutcome(''); setMinScore(''); }}
              className="h-9 px-3 text-[12px] rounded-xl"
              style={{ background: pro.panel, border: `1px solid ${pro.border}`, color: pro.textSec }}
            >
              Réinitialiser
            </button>
          )}
        </div>
      </Card>

      {/* List */}
      <Card>
        {data.length === 0 ? (
          <div className="p-12 text-center" style={{ color: pro.textTer }}>
            <Phone className="w-6 h-6 mx-auto mb-3 opacity-60" />
            <p className="text-[13px]">Aucun appel</p>
          </div>
        ) : (
          data.map((c: any, i: number) => {
            const name = c.prospect?.businessName ?? c.businessName ?? c.phoneNumber ?? '—';
            const score = c.interestScore ?? c.interestLevel;
            const hasRecording = !!c.recordingUrl;
            const hasTranscript = !!c.transcript || !!c.summary;
            return (
              <div
                key={c.id ?? i}
                onClick={() => setSelected(c)}
                className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.02] cursor-pointer"
                style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-semibold"
                     style={{ background: 'rgba(255,255,255,0.05)', color: pro.text }}>
                  {(name?.charAt(0) || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>{name}</p>
                  {c.phoneNumber && (
                    <p className="text-[11.5px] truncate font-mono" style={{ color: pro.textTer }}>{c.phoneNumber}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1" style={{ color: pro.textTer }}>
                    <Clock size={11} />
                    <span className="text-[11px]">{fmtDateTime(c.createdAt ?? c.startedAt)}</span>
                    <span className="text-[11px] ml-2 tabular-nums">· {fmtDuration(c.duration ?? c.durationSeconds)}</span>
                    {hasTranscript && <FileText size={11} className="ml-2" />}
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                  {hasRecording && (
                    <div className="w-44" onClick={e => e.stopPropagation()}>
                      <AudioPlayer src={c.recordingUrl} />
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                  <Pill color={outcomeColor(c.outcome)}>{c.outcome ?? 'UNKNOWN'}</Pill>
                  {score != null && (
                    <span className="text-[11px] tabular-nums" style={{ color: pro.textTer }}>
                      <Pill color={scoreColor(score)}>{score}/10</Pill>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div className="px-4 pb-3">
          <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
        </div>
      </Card>

      {/* Detail sheet */}
      <SlideSheet
        open={!!selected} onClose={() => setSelected(null)}
        title={selected?.businessName ?? selected?.prospect?.businessName ?? 'Détail appel'}
        subtitle={[selected?.outcome, fmtDuration(selected?.duration ?? selected?.durationSeconds)].filter(Boolean).join(' · ')}
      >
        {selected && (
          <div className="space-y-4">
            {/* Date/time */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                 style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
              <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: pro.textSec }} />
              <span className="text-[13px] font-medium" style={{ color: pro.text }}>
                {fmtDateTime(selected.createdAt ?? selected.startedAt)}
              </span>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl p-3 text-center"
                   style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                <p className="text-[18px] font-semibold tabular-nums" style={{ color: pro.text }}>
                  {(selected.interestScore ?? selected.interestLevel) != null
                    ? `${selected.interestScore ?? selected.interestLevel}/10`
                    : '—'}
                </p>
                <p className="text-[10px] mt-0.5 uppercase tracking-wider" style={{ color: pro.textTer }}>Score</p>
              </div>
              <div className="rounded-xl p-3 text-center"
                   style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                <p className="text-[18px] font-semibold tabular-nums" style={{ color: pro.text }}>
                  {fmtDuration(selected.duration ?? selected.durationSeconds)}
                </p>
                <p className="text-[10px] mt-0.5 uppercase tracking-wider" style={{ color: pro.textTer }}>Durée</p>
              </div>
              <div className="rounded-xl p-3 text-center"
                   style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                <div className="flex items-center justify-center" style={{ minHeight: 24 }}>
                  <Pill color={outcomeColor(selected.outcome)}>{selected.outcome ?? 'UNKNOWN'}</Pill>
                </div>
                <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: pro.textTer }}>Résultat</p>
              </div>
            </div>

            {/* Phone */}
            {selected.phoneNumber && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                   style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                <Phone className="w-3.5 h-3.5" style={{ color: pro.textSec }} />
                <span className="text-[13px] font-mono" style={{ color: pro.text }}>{selected.phoneNumber}</span>
              </div>
            )}

            {/* Audio */}
            {selected.recordingUrl && (
              <div>
                <p className="text-[11px] mb-2 font-semibold uppercase tracking-wider" style={{ color: pro.textSec }}>Enregistrement</p>
                <div className="rounded-xl p-3"
                     style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
                  <AudioPlayer src={selected.recordingUrl} />
                </div>
              </div>
            )}

            {/* Summary */}
            {selected.summary && (
              <div>
                <p className="text-[11px] mb-2 font-semibold uppercase tracking-wider" style={{ color: pro.textSec }}>Résumé IA</p>
                <p className="text-[12.5px] leading-relaxed rounded-xl p-3"
                   style={{ color: pro.text, background: pro.panel, border: `1px solid ${pro.border}` }}>
                  {selected.summary}
                </p>
              </div>
            )}

            {/* Transcript */}
            {selected.transcript && (
              <div>
                <p className="text-[11px] mb-2 font-semibold uppercase tracking-wider" style={{ color: pro.textSec }}>Transcription</p>
                <p className="text-[12px] leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl p-3"
                   style={{ color: pro.text, background: pro.panel, border: `1px solid ${pro.border}` }}>
                  {selected.transcript}
                </p>
              </div>
            )}
          </div>
        )}
      </SlideSheet>
    </div>
  );
}
