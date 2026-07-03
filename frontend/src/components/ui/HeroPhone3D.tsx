import { useEffect, useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'framer-motion';
import { Phone, ArrowUpRight, ChevronRight } from 'lucide-react';

/*
 * HeroPhone3D — ultra-real iPhone 17 Pro Max shell, reactive 3D, playing a live
 * replica of the REAL client dashboard (ClientOverview + OverviewBlocks, Signal
 * Dark monochrome register) animated by a stream of incoming-call events, the
 * way a very active account looks.
 */

/* ── Scripted call feed — the events the account receives on loop ───────────── */
interface CallEvt { id: string; name: string; outcome: 'lead' | 'transfer' | 'booked' | 'callback'; dur: number }

const POOL_FR: CallEvt[] = [
  { id: 'a', name: 'Sarah · Bright Dental',    outcome: 'booked',   dur: 52 },
  { id: 'b', name: 'Marc · Rivera HVAC',        outcome: 'lead',     dur: 74 },
  { id: 'c', name: 'Inconnu · 06 12 34 56 78', outcome: 'transfer', dur: 31 },
  { id: 'd', name: 'Larsson Law',               outcome: 'callback', dur: 45 },
  { id: 'e', name: 'Plomberie Express',         outcome: 'transfer', dur: 28 },
  { id: 'f', name: 'Cabinet Morel',             outcome: 'booked',   dur: 63 },
  { id: 'g', name: 'Mme Nguyen · Optique',      outcome: 'lead',     dur: 58 },
];
const POOL_EN: CallEvt[] = [
  { id: 'a', name: 'Sarah · Bright Dental',    outcome: 'booked',   dur: 52 },
  { id: 'b', name: 'Marc · Rivera HVAC',        outcome: 'lead',     dur: 74 },
  { id: 'c', name: 'Unknown · +1 555 0102',     outcome: 'transfer', dur: 31 },
  { id: 'd', name: 'Larsson Law',               outcome: 'callback', dur: 45 },
  { id: 'e', name: 'Plumbing Express',          outcome: 'transfer', dur: 28 },
  { id: 'f', name: 'Morel & Associates',        outcome: 'booked',   dur: 63 },
  { id: 'g', name: 'Nguyen Optical',            outcome: 'lead',     dur: 58 },
];

/* Real outcome pills — outcomeLabel/outcomePill from ClientOverview */
const OUTCOME_FR: Record<CallEvt['outcome'], string> = { lead: 'Lead', transfer: 'Transféré', booked: 'RDV pris', callback: 'Rappel' };
const OUTCOME_EN: Record<CallEvt['outcome'], string> = { lead: 'Lead', transfer: 'Transferred', booked: 'Booked', callback: 'Callback' };
const OUTCOME_PILL: Record<CallEvt['outcome'], string> = {
  lead:     'bg-emerald-400/10 text-emerald-400',
  transfer: 'bg-white/[0.08] text-white/60',
  booked:   'bg-emerald-400/10 text-emerald-400',
  callback: 'bg-white/[0.05] text-white/40',
};

/* Signal Dark tokens (pro-theme) */
const PRO = {
  bg: '#0a0a0a',
  text: 'oklch(95% 0 0)',
  textSec: 'oklch(65% 0 0)',
  textTer: 'oklch(42% 0 0)',
  ok: 'oklch(72% 0.18 145)',
  tickOff: 'oklch(28% 0.01 265)',
  line: 'oklch(90% 0 0)',
};

/* Monochrome hero-trend series — same shape as OverviewBlocks buildDemoSeries */
const TREND = [62, 58, 65, 71, 68, 74, 70, 78, 82, 80, 86, 92];
const TW = 100, TH = 34;
const trendPts = TREND.map((v, i) => ({
  x: (i / (TREND.length - 1)) * TW,
  y: TH - ((v - 50) / 50) * (TH - 6) - 3,
}));
const trendPath = trendPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
const trendArea = `${trendPath} L${TW} ${TH} L0 ${TH} Z`;

const EASE = [0.16, 1, 0.3, 1] as const;
const CYCLE_MS = 5200;  // one incoming call per cycle
const RING_MS  = 2400;  // how long the Dynamic Island stays expanded
const INTRO_MS = 4600;  // brand intro before the live dashboard takes over

/* ── Animated counter — pops on change ──────────────────────────────────────── */
function PopNumber({ value, format }: { value: number; format?: (n: number) => string }) {
  return (
    <span className="relative inline-flex overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="tabular-nums"
        >
          {format ? format(value) : value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ── Brand intro — plays on the screen like a presentation video ────────────── */
function ScreenIntro({ isFr }: { isFr: boolean }) {
  return (
    <div className="absolute inset-0 z-[5] overflow-hidden" style={{ background: 'oklch(9% 0.012 265)' }}>
      {/* Animated aurora — always-on motion layer beneath the footage */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(140% 90% at 50% 110%, rgba(99,102,241,0.35) 0%, rgba(168,85,247,0.18) 40%, transparent 75%)' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute -left-16 bottom-[-30%] h-[70%] w-[130%] rounded-full blur-2xl"
        style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.5) 0%, transparent 65%)' }}
        animate={{ x: [0, 26, 0], y: [0, -18, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute -right-20 bottom-[-15%] h-[55%] w-[120%] rounded-full blur-2xl"
        style={{ background: 'radial-gradient(ellipse, rgba(168,85,247,0.42) 0%, transparent 65%)' }}
        animate={{ x: [0, -30, 0], y: [0, -24, 0], scale: [1.1, 0.95, 1.1] }}
        transition={{ duration: 8.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Generated brand footage (drop the mp4 in public/media/ — hides itself if absent) */}
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-80"
        src="/media/qwillio-intro.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = 'none'; }}
      />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(5,5,10,0.55) 0%, rgba(5,5,10,0.1) 45%, rgba(5,5,10,0.6) 100%)' }} />

      {/* Wordmark + tagline */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          className="mb-3 flex items-end gap-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          aria-hidden="true"
        >
          {[8, 14, 20, 12, 7].map((h, i) => (
            <span
              key={i}
              className="wave-bar w-[3px] rounded-full"
              style={{
                height: h,
                background: i % 2 === 0 ? '#818cf8' : '#c084fc',
                animationDuration: `${0.7 + i * 0.13}s`,
              }}
            />
          ))}
        </motion.div>
        <motion.p
          className="text-[22px] font-semibold tracking-[-0.02em] text-white"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35, ease: EASE }}
        >
          Qwillio
        </motion.p>
        <motion.p
          className="mt-1.5 max-w-[180px] text-[10.5px] leading-snug text-white/65"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55, ease: EASE }}
        >
          {isFr ? 'L\'IA qui répond à chaque appel.' : 'The AI that answers every call.'}
        </motion.p>
        <motion.p
          className="absolute bottom-8 text-[8.5px] font-medium uppercase tracking-[0.2em] text-white/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1] }}
          transition={{ duration: 1.2, delay: 1.4 }}
        >
          {isFr ? 'Démo en direct' : 'Live demo'}
        </motion.p>
      </div>
    </div>
  );
}

/* ── Faithful mini ClientOverview — Signal Dark monochrome register ─────────── */
function ScreenDashboard({ isFr, ringing, tick, callsMonth, leadsMonth, sentiment, incomingName }: {
  isFr: boolean;
  ringing: boolean;
  tick: number;
  callsMonth: number;
  leadsMonth: number;
  sentiment: number;
  incomingName: string;
}) {
  const pool = isFr ? POOL_FR : POOL_EN;
  const outcomeLabel = isFr ? OUTCOME_FR : OUTCOME_EN;
  const convRate = Math.round((leadsMonth / callsMonth) * 100);

  const now = new Date();
  const hour = now.getHours();
  const greeting = isFr
    ? (hour < 12 ? 'Bonjour, Sarah' : hour < 18 ? 'Bon après-midi, Sarah' : 'Bonsoir, Sarah')
    : (hour < 12 ? 'Morning, Sarah' : hour < 18 ? 'Afternoon, Sarah' : 'Evening, Sarah');
  const dateLine = now.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  /* Quota usage — mirrors the real SegmentBar block */
  const quotaTotal = 600;
  const quotaPct = Math.min(100, Math.round((callsMonth / quotaTotal) * 100));

  /* Rows: newest first, timestamps walking back from "now" */
  const rows = Array.from({ length: 5 }, (_, i) => {
    const idx = ((tick - i) % pool.length + pool.length) % pool.length;
    const t = new Date(now.getTime() - i * 7 * 60000 - 60000);
    return {
      ...pool[idx],
      instanceId: `${pool[idx].id}-${tick - i}`,
      time: t.toLocaleTimeString(isFr ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  });

  /* Tally meter — barcode bars, lit share = conversion rate */
  const N_TALLY = 40;
  const lit = Math.round((Math.min(100, convRate) / 100) * N_TALLY);

  return (
    <div className="relative flex h-full flex-col overflow-hidden" style={{ background: PRO.bg }}>
      {/* Status bar */}
      <div className="flex items-center justify-between px-6 pt-3.5 pb-1 text-white">
        <span className="text-[11px] font-semibold tracking-tight tabular-nums">9:41</span>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <div className="flex items-end gap-[1.5px]">
            {[3, 5, 7, 9].map((h) => (
              <span key={h} className="w-[2.5px] rounded-[1px] bg-white" style={{ height: h }} />
            ))}
          </div>
          <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
            <path d="M6.5 9.5 L2 5 A6.4 6.4 0 0 1 11 5 Z" fill="white" />
          </svg>
          <div className="relative h-[10px] w-[19px] rounded-[3px] border border-white/40">
            <span className="absolute inset-[1.5px] right-[4px] rounded-[1.5px] bg-white" />
            <span className="absolute -right-[3px] top-[2.5px] h-[4px] w-[1.5px] rounded-r-[1px] bg-white/40" />
          </div>
        </div>
      </div>

      {/* Dashboard body — frameless, hairline-divided like ClientOverview */}
      <div className="flex flex-1 flex-col px-4 pt-4 pb-3">
        {/* Header */}
        <div className="pb-2.5">
          <p className="text-[13px] font-semibold tracking-tight text-white/90">{greeting}</p>
          <p className="mt-0.5 text-[8px] text-white/50">
            {dateLine}
            <span className="mx-1 text-white/20">·</span>
            <span className="text-emerald-400">{isFr ? 'Service actif' : 'Service active'}</span>
          </p>
        </div>

        {/* KPI split row — borderless figures divided by hairlines */}
        <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-y border-white/[0.06] py-2.5">
          <div className="pr-2.5">
            <p className="text-[7.5px]" style={{ color: PRO.textSec }}>{isFr ? 'Taux de conversion' : 'Conversion rate'}</p>
            <p className="mt-1 text-[14px] font-semibold leading-none tabular-nums text-white">
              <PopNumber value={convRate} format={(n) => `${n}%`} />
            </p>
          </div>
          <div className="px-2.5">
            <p className="text-[7.5px]" style={{ color: PRO.textSec }}>{isFr ? 'Appels traités' : 'Calls handled'}</p>
            <div className="mt-1 flex items-baseline gap-1">
              <p className="text-[14px] font-semibold leading-none tabular-nums text-white">
                <PopNumber value={callsMonth} />
              </p>
              <span className="inline-flex items-center text-[7px] font-medium" style={{ color: PRO.ok }}>
                <ArrowUpRight size={7} aria-hidden="true" />18%
              </span>
            </div>
          </div>
          <div className="pl-2.5">
            <p className="text-[7.5px]" style={{ color: PRO.textSec }}>{isFr ? 'Score sentiment' : 'Sentiment score'}</p>
            <p className="mt-1 text-[14px] font-semibold leading-none tabular-nums text-white">
              <PopNumber value={sentiment} format={(n) => `${n}%`} />
            </p>
          </div>
        </div>

        {/* Hero trend panel — big figure + monochrome area chart */}
        <div className="border-b border-white/[0.06] py-2.5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[19px] font-semibold leading-none tracking-tight tabular-nums text-white">
                <PopNumber value={callsMonth} format={(n) => n.toLocaleString(isFr ? 'fr-FR' : 'en-US')} />
              </p>
              <p className="mt-1 text-[7.5px]" style={{ color: PRO.textSec }}>
                {isFr ? 'Appels traités ce mois' : 'Calls handled this month'}
              </p>
            </div>
            <span className="inline-flex items-center gap-0.5 text-[7.5px] font-medium" style={{ color: PRO.ok }}>
              <ArrowUpRight size={8} aria-hidden="true" />
              12% <span className="font-normal" style={{ color: PRO.textTer }}>{isFr ? 'sur 24 h' : 'over 24h'}</span>
            </span>
          </div>
          <svg viewBox={`0 0 ${TW} ${TH}`} className="mt-1.5 block h-11 w-full" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="hp3d-trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PRO.line} stopOpacity="0.22" />
                <stop offset="60%" stopColor={PRO.line} stopOpacity="0.06" />
                <stop offset="100%" stopColor={PRO.line} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1="0" x2={TW} y1={TH * f} y2={TH * f} stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
            ))}
            <motion.path
              d={trendArea}
              fill="url(#hp3d-trend-fill)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.1, delay: 0.7, ease: 'easeOut' }}
            />
            <motion.path
              d={trendPath}
              fill="none"
              stroke={PRO.line}
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, delay: 0.4, ease: EASE }}
            />
            {/* Live endpoint — pulses with each handled call */}
            <motion.circle
              cx={trendPts[trendPts.length - 1].x}
              cy={trendPts[trendPts.length - 1].y}
              r="1.8"
              fill={PRO.line}
              key={`dot-${tick}`}
              initial={{ scale: 1.9, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: EASE }}
              style={{ transformOrigin: `${trendPts[trendPts.length - 1].x}px ${trendPts[trendPts.length - 1].y}px` }}
            />
          </svg>
        </div>

        {/* Segment bar — quota usage, fills as calls land */}
        <div className="border-b border-white/[0.06] py-2">
          <div className="flex items-center justify-between">
            <p className="text-[7.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: PRO.textSec }}>
              {isFr ? 'Utilisation du quota' : 'Quota usage'}
            </p>
            <span className="text-[7px] font-medium" style={{ color: PRO.textTer }}>
              {isFr ? `sur ${quotaTotal} appels inclus` : `of ${quotaTotal} calls included`}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1">
            <motion.div
              className="h-[5px] rounded-full"
              animate={{ width: `${quotaPct}%` }}
              transition={{ duration: 0.6, ease: EASE }}
              style={{ background: PRO.line }}
            />
            <div className="h-[5px] flex-1 rounded-full" style={{ background: 'oklch(32% 0.01 265)' }} />
          </div>
        </div>

        {/* Activité récente — frameless rows split by hairlines */}
        <div className="min-h-0 flex-1 pt-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[7.5px] font-semibold uppercase tracking-[0.08em] text-white/40">
              {isFr ? 'Activité récente' : 'Recent activity'}
            </p>
            <span className="flex items-center gap-0.5 text-[7px] font-medium text-white/40">
              {isFr ? 'Tout voir' : 'View all'} <ChevronRight size={7} aria-hidden="true" />
            </span>
          </div>
          <ul>
            <AnimatePresence initial={false} mode="popLayout">
              {rows.map((row) => (
                <motion.li
                  key={row.instanceId}
                  layout
                  initial={{ opacity: 0, y: -14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.4, ease: EASE, layout: { duration: 0.4, ease: EASE } }}
                  className="flex items-center gap-2 border-b border-white/[0.04] py-[5px] last:border-b-0"
                >
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.05]" aria-hidden="true">
                    <Phone size={8} className="text-white/40" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[8.5px] font-medium leading-tight text-white/90">{row.name}</span>
                    <span className="block text-[7px] leading-tight text-white/30">{row.time} · {row.dur}s</span>
                  </span>
                  <span className={`flex-shrink-0 rounded-full px-1.5 py-[2px] text-[6px] font-medium uppercase tracking-wide ${OUTCOME_PILL[row.outcome]}`}>
                    {outcomeLabel[row.outcome]}
                  </span>
                  <ChevronRight size={8} className="flex-shrink-0 text-white/20" aria-hidden="true" />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>

        {/* Tally meter — leads qualified, barcode bars fill as leads land */}
        <div className="border-t border-white/[0.06] pt-2">
          <p className="text-[7px] uppercase tracking-[0.08em]" style={{ color: PRO.textTer }}>
            {isFr ? 'Leads qualifiés ce mois' : 'Leads qualified this month'}
          </p>
          <div className="mt-0.5 flex items-end justify-between">
            <p className="text-[14px] font-semibold leading-none tabular-nums text-white">
              <PopNumber value={leadsMonth} />
            </p>
            <span className="text-[7.5px] font-medium tabular-nums" style={{ color: PRO.textSec }}>{convRate}%</span>
          </div>
          <div className="mt-1.5 flex items-end gap-[2px]" style={{ height: 16 }} aria-hidden="true">
            {Array.from({ length: N_TALLY }, (_, i) => (
              <motion.span
                key={i}
                className="flex-1 rounded-full"
                animate={{ background: i < lit ? PRO.line : PRO.tickOff }}
                transition={{ duration: 0.4 }}
                style={{ height: i % 4 === 0 ? '100%' : '64%' }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Screen dims slightly while a call rings — like real iOS */}
      <motion.div
        className="pointer-events-none absolute inset-0 bg-black"
        animate={{ opacity: ringing ? 0.28 : 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        aria-hidden="true"
      />

      {/* Dynamic Island — expands on incoming call */}
      <motion.div
        className="absolute left-1/2 top-[9px] z-10 flex -translate-x-1/2 items-center overflow-hidden bg-black"
        animate={ringing
          ? { width: 196, height: 52, borderRadius: 26 }
          : { width: 86,  height: 24, borderRadius: 13 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.6)' }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {ringing ? (
            <motion.div
              key="call"
              className="flex w-full items-center gap-2 px-3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              <motion.span
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: 'rgba(110,231,160,0.18)' }}
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Phone size={11} style={{ color: '#6ee7a0' }} aria-hidden="true" />
              </motion.span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[9px] font-semibold leading-tight text-white">{incomingName}</span>
                <span className="block text-[7.5px] leading-tight" style={{ color: '#6ee7a0' }}>
                  {isFr ? 'L\'IA décroche…' : 'AI answering…'}
                </span>
              </span>
              <span className="flex flex-shrink-0 items-end gap-[2px]" aria-hidden="true">
                {[7, 11, 8, 12].map((h, i) => (
                  <span
                    key={i}
                    className="wave-bar w-[2.5px] rounded-full"
                    style={{ height: h, background: '#6ee7a0', animationDuration: `${0.5 + i * 0.12}s` }}
                  />
                ))}
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              className="flex w-full items-center justify-end pr-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {/* Front camera lens */}
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: 'radial-gradient(circle at 35% 35%, #1e2a4a 0%, #0a0d18 60%)' }}
                aria-hidden="true"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* ── Ultra-real iPhone shell + reactive 3D stage ────────────────────────────── */
export default function HeroPhone3D({ isFr }: { isFr: boolean }) {
  const reduced = useReducedMotion();
  const pool = isFr ? POOL_FR : POOL_EN;

  const [tick, setTick] = useState(0);
  const [ringing, setRinging] = useState(false);
  const [callsMonth, setCallsMonth] = useState(412);
  const [leadsMonth, setLeadsMonth] = useState(132);
  const [sentiment, setSentiment] = useState(87);
  const [introDone, setIntroDone] = useState(!!reduced);
  const tickRef = useRef(0);

  const incomingName = pool[(tickRef.current + 1) % pool.length].name;

  useEffect(() => {
    if (reduced) return;
    const id = setTimeout(() => setIntroDone(true), INTRO_MS);
    return () => clearTimeout(id);
  }, [reduced]);

  useEffect(() => {
    if (reduced || !introDone) return;
    let ringTimer: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      setRinging(true);
      ringTimer = setTimeout(() => {
        setRinging(false);
        tickRef.current += 1;
        const evt = pool[tickRef.current % pool.length];
        setTick(tickRef.current);
        setCallsMonth((n) => n + 1);
        if (evt.outcome === 'lead' || evt.outcome === 'booked') setLeadsMonth((n) => n + 1);
        setSentiment((s) => Math.max(82, Math.min(94, s + (tickRef.current % 3 === 0 ? 1 : tickRef.current % 3 === 1 ? -1 : 0))));
      }, RING_MS);
    }, CYCLE_MS);
    return () => { clearInterval(id); clearTimeout(ringTimer); };
  }, [reduced, introDone, pool]);

  /* Pointer-reactive tilt */
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const spring = { stiffness: 140, damping: 18, mass: 0.5 };
  const smx = useSpring(mx, spring);
  const smy = useSpring(my, spring);
  // Resting pose is baked into the ranges: slight editorial 3/4 turn at center
  const rotateY = useTransform(smx, [-0.5, 0.5], [-24, 2]);
  const rotateX = useTransform(smy, [-0.5, 0.5], [11, -5]);
  const glareX = useTransform(smx, [-0.5, 0.5], ['30%', '75%']);
  const glareY = useTransform(smy, [-0.5, 0.5], ['18%', '55%']);
  const glareBg = useTransform([glareX, glareY], ([x, y]) =>
    `radial-gradient(120% 60% at ${x} ${y}, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.045) 32%, transparent 60%)`
  );
  const shadowScale = useTransform(smx, [-0.5, 0.5], [1.06, 0.94]);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <div
      className="relative flex items-center justify-center py-6 lg:py-0"
      style={{ perspective: 1400 }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      role="img"
      aria-label={isFr
        ? 'Dashboard client Qwillio en direct sur iPhone : l\'IA décroche les appels, les leads et rendez-vous s\'ajoutent en temps réel'
        : 'Live Qwillio client dashboard on an iPhone: the AI answers calls while leads and bookings land in real time'}
    >
      {/* Ambient brand glow behind the device */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, rgba(168,85,247,0.12) 45%, transparent 70%)' }}
      />

      <div aria-hidden="true">
        {/* Idle float */}
        <motion.div
          animate={reduced ? undefined : { y: [0, -11, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Reactive 3D body */}
          <motion.div
            className="relative"
            style={{ rotateX: reduced ? 0 : rotateX, rotateY: reduced ? 0 : rotateY, transformStyle: 'preserve-3d' }}
          >
            {/* Titanium frame */}
            <div
              className="relative w-[264px] rounded-[52px] p-[3px] sm:w-[288px]"
              style={{
                background: 'linear-gradient(155deg, #6b6b70 0%, #2c2c30 18%, #1a1a1d 45%, #3b3b40 78%, #757579 100%)',
                boxShadow: [
                  'inset 0 1px 1px rgba(255,255,255,0.28)',
                  'inset 0 -1px 1px rgba(0,0,0,0.55)',
                  '0 30px 60px -18px rgba(20,16,50,0.45)',
                  '0 70px 110px -30px rgba(99,102,241,0.28)',
                ].join(', '),
              }}
            >
              {/* Antenna lines */}
              <span className="absolute left-[22%] top-0 h-[3px] w-[3px] rounded-full bg-black/50" />
              <span className="absolute right-[22%] top-0 h-[3px] w-[3px] rounded-full bg-black/50" />
              <span className="absolute bottom-0 left-[22%] h-[3px] w-[3px] rounded-full bg-black/50" />
              <span className="absolute bottom-0 right-[22%] h-[3px] w-[3px] rounded-full bg-black/50" />

              {/* Side buttons */}
              <span
                className="absolute -left-[2.5px] top-[104px] h-[26px] w-[3px] rounded-l-[2px]"
                style={{ background: 'linear-gradient(90deg, #57575c, #26262a)' }}
              />
              <span
                className="absolute -left-[2.5px] top-[148px] h-[44px] w-[3px] rounded-l-[2px]"
                style={{ background: 'linear-gradient(90deg, #57575c, #26262a)' }}
              />
              <span
                className="absolute -left-[2.5px] top-[202px] h-[44px] w-[3px] rounded-l-[2px]"
                style={{ background: 'linear-gradient(90deg, #57575c, #26262a)' }}
              />
              <span
                className="absolute -right-[2.5px] top-[164px] h-[68px] w-[3px] rounded-r-[2px]"
                style={{ background: 'linear-gradient(270deg, #57575c, #26262a)' }}
              />

              {/* Black bezel */}
              <div className="rounded-[49px] bg-[#050506] p-[9px]">
                {/* Screen */}
                <div className="relative aspect-[390/812] overflow-hidden rounded-[41px] bg-[#0a0a0a]">
                  <ScreenDashboard
                    isFr={isFr}
                    ringing={ringing}
                    tick={tick}
                    callsMonth={callsMonth}
                    leadsMonth={leadsMonth}
                    sentiment={sentiment}
                    incomingName={incomingName}
                  />

                  {/* Presentation intro — fades into the live dashboard */}
                  <AnimatePresence>
                    {!introDone && (
                      <motion.div
                        className="absolute inset-0 z-[5]"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 1.04 }}
                        transition={{ duration: 0.8, ease: EASE }}
                      >
                        <ScreenIntro isFr={isFr} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Glass glare — tracks the tilt */}
                  <motion.div
                    className="pointer-events-none absolute inset-0 z-20"
                    style={{ background: glareBg }}
                  />
                  {/* Static edge sheen on the glass */}
                  <div
                    className="pointer-events-none absolute inset-0 z-20 rounded-[41px]"
                    style={{ boxShadow: 'inset 0 0 14px rgba(255,255,255,0.045), inset 0 1px 0 rgba(255,255,255,0.07)' }}
                  />

                  {/* Home indicator */}
                  <span className="absolute bottom-[7px] left-1/2 z-20 h-[4px] w-[100px] -translate-x-1/2 rounded-full bg-white/80" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Floor shadow */}
          <motion.div
            className="mx-auto mt-9 h-6 w-[190px] rounded-full blur-xl"
            style={{ background: 'rgba(24,20,55,0.35)', scaleX: reduced ? 1 : shadowScale }}
          />
        </motion.div>
      </div>
    </div>
  );
}
