import { useEffect, useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'framer-motion';
import { Phone, ArrowUpRight, ChevronRight, BarChart3 } from 'lucide-react';
import QwillioLogo from '../QwillioLogo';

/*
 * HeroPhone3D — ultra-real iPhone shell, pointer-reactive 3D, playing a looping
 * product film entirely in iOS: lock screen with real Qwillio notifications,
 * app-open zoom, then an animated tour of the REAL client dashboard pages
 * (Overview / Appels / Analytics — Signal Dark monochrome register).
 */

/* ── Scripted call feed ─────────────────────────────────────────────────────── */
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

/* Monochrome trend series — same shape as OverviewBlocks buildDemoSeries */
const TREND = [62, 58, 65, 71, 68, 74, 70, 78, 82, 80, 86, 92];
const TW = 100, TH = 34;
const trendPts = TREND.map((v, i) => ({
  x: (i / (TREND.length - 1)) * TW,
  y: TH - ((v - 50) / 50) * (TH - 6) - 3,
}));
const trendPath = trendPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
const trendArea = `${trendPath} L${TW} ${TH} L0 ${TH} Z`;

/* Hourly distribution bars for Analytics */
const HOURS = [3, 5, 9, 14, 18, 22, 19, 24, 21, 15, 9, 5];

const EASE = [0.16, 1, 0.3, 1] as const;
const RING_MS = 2300;

/* Scene timeline — a looping product film */
type Scene = 'home' | 'overview' | 'calls' | 'analytics';
const ORDER: Scene[] = ['home', 'overview', 'calls', 'analytics'];
const SCENE_MS: Record<Scene, number> = { home: 5600, overview: 10000, calls: 7200, analytics: 7000 };

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

/* ── Qwillio app icon — the real logo on an app tile ────────────────────────── */
function AppIcon({ size = 18 }: { size?: number }) {
  return (
    <span
      className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-[27%] bg-white"
      style={{ width: size, height: size, boxShadow: '0 1px 3px rgba(0,0,0,0.35)' }}
      aria-hidden="true"
    >
      <QwillioLogo size={size * 0.72} />
    </span>
  );
}

/* ── Scene: iOS lock screen + Centre de notifications (matches the reference
      recording: glassy oversized clock, bold notification cards, torch/camera) ── */
function SceneHome({ isFr }: { isFr: boolean }) {
  const now = new Date();
  const dateLine = isFr
    ? now.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '.')
    : now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const notifs = isFr
    ? [
        { title: 'Nouveau lead qualifié', body: 'Marc · Rivera HVAC', time: 'il y a 2 min' },
        { title: 'Rendez-vous confirmé', body: 'Sarah · Bright Dental', time: '11:26 AM' },
        { title: 'Appel transféré', body: 'Urgence vers Sophie', time: 'hier 11:53 PM' },
        { title: 'Rappel programmé', body: 'Larsson Law — mardi', time: 'hier 7:09 PM' },
      ]
    : [
        { title: 'New qualified lead', body: 'Marc · Rivera HVAC', time: '2 min ago' },
        { title: 'Appointment confirmed', body: 'Sarah · Bright Dental', time: '11:26 AM' },
        { title: 'Call transferred', body: 'Urgent case to Sophie', time: 'yest. 11:53 PM' },
        { title: 'Callback scheduled', body: 'Larsson Law — Tuesday', time: 'yest. 7:09 PM' },
      ];

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Brand aurora wallpaper */}
      <div className="absolute inset-0" style={{ background: 'oklch(9% 0.012 265)' }} />
      <motion.div
        aria-hidden="true"
        className="absolute -left-16 bottom-[-25%] h-[65%] w-[130%] rounded-full blur-2xl"
        style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.45) 0%, transparent 65%)' }}
        animate={{ x: [0, 24, 0], y: [0, -16, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute -right-20 top-[10%] h-[45%] w-[110%] rounded-full blur-2xl"
        style={{ background: 'radial-gradient(ellipse, rgba(168,85,247,0.32) 0%, transparent 65%)' }}
        animate={{ x: [0, -26, 0], y: [0, 20, 0] }}
        transition={{ duration: 8.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Carrier — top-left like the real lock screen */}
      <span className="absolute left-5 top-[13px] text-[8px] font-semibold text-white/90">Proximus</span>

      {/* Date + oversized liquid-glass clock */}
      <div className="absolute inset-x-0 top-[34px] flex flex-col items-center">
        <p className="text-[10px] font-semibold text-white/85">{dateLine}</p>
        <p
          className="mt-0 select-none text-[56px] font-bold leading-[1.05] tracking-[-0.02em]"
          style={{
            fontVariantNumeric: 'tabular-nums',
            color: 'rgba(255,255,255,0.42)',
            textShadow: '0 1px 0 rgba(255,255,255,0.45), 0 -1px 1px rgba(0,0,0,0.28), 0 10px 22px rgba(0,0,0,0.30)',
          }}
        >
          6:28
        </p>
      </div>

      {/* Centre de notifications */}
      <div className="absolute inset-x-3 top-[142px]">
        <motion.div
          className="mb-2 flex items-center justify-between px-1"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.55 }}
        >
          <p className="text-[13px] font-bold tracking-tight text-white">
            {isFr ? 'Centre de notifications' : 'Notification Center'}
          </p>
          <span
            className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-semibold text-white/85"
            style={{ background: 'rgba(120,120,128,0.44)', backdropFilter: 'blur(8px)' }}
            aria-hidden="true"
          >
            ✕
          </span>
        </motion.div>

        <ul className="space-y-[7px]">
          {notifs.map((n, i) => (
            <motion.li
              key={n.title}
              initial={{ opacity: 0, y: 30, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 27, delay: 0.75 + i * 0.55 }}
              className="flex items-center gap-2.5 rounded-[15px] px-2.5 py-[9px]"
              style={{ background: 'rgba(85,85,95,0.52)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <AppIcon size={26} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10px] font-bold leading-tight text-white">{n.title}</span>
                <span className="block truncate text-[9px] leading-snug text-white/85">{n.body}</span>
              </span>
              <span className="flex-shrink-0 self-start pt-[1px] text-[7.5px] text-white/70">{n.time}</span>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Flashlight / camera — lock screen corners */}
      <div className="absolute bottom-6 left-6 flex h-9 w-9 items-center justify-center rounded-full" style={{ background: 'rgba(120,120,128,0.40)', backdropFilter: 'blur(10px)' }} aria-hidden="true">
        <span className="block h-3.5 w-2 rounded-[2px] border-[1.5px] border-white/90" />
      </div>
      <div className="absolute bottom-6 right-6 flex h-9 w-9 items-center justify-center rounded-full" style={{ background: 'rgba(120,120,128,0.40)', backdropFilter: 'blur(10px)' }} aria-hidden="true">
        <span className="relative block h-2.5 w-3.5 rounded-[2px] border-[1.5px] border-white/90">
          <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90" />
        </span>
      </div>
    </div>
  );
}

/* ── App chrome — real logo + page title, shared by dashboard scenes ────────── */
function AppBar({ title, isFr }: { title: string; isFr: boolean }) {
  return (
    <div className="flex items-center gap-1.5 pb-2">
      <QwillioLogo size={13} />
      <span className="text-[8px] font-semibold tracking-tight text-white/90">Qwillio</span>
      <span className="text-[7px] text-white/30">/ {title}</span>
      <span
        className="ml-auto flex h-[15px] w-[15px] items-center justify-center rounded-full text-[6px] font-bold text-white"
        style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
      >
        SC
      </span>
      <span className="sr-only">{isFr ? 'Navigation' : 'Navigation'}</span>
    </div>
  );
}

/* ── Scene: ClientOverview miniature (Signal Dark) ──────────────────────────── */
function SceneOverview({ isFr, tick, callsMonth, leadsMonth, sentiment }: {
  isFr: boolean;
  tick: number;
  callsMonth: number;
  leadsMonth: number;
  sentiment: number;
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

  const quotaTotal = 600;
  const quotaPct = Math.min(100, Math.round((callsMonth / quotaTotal) * 100));

  const rows = Array.from({ length: 4 }, (_, i) => {
    const idx = ((tick - i) % pool.length + pool.length) % pool.length;
    const t = new Date(now.getTime() - i * 7 * 60000 - 60000);
    return {
      ...pool[idx],
      instanceId: `${pool[idx].id}-${tick - i}`,
      time: t.toLocaleTimeString(isFr ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  });

  return (
    <div className="flex h-full flex-col px-4 pt-10 pb-3">
      <AppBar title={isFr ? 'Vue d\'ensemble' : 'Overview'} isFr={isFr} />

      <div className="pb-2">
        <p className="text-[12px] font-semibold tracking-tight text-white/90">{greeting}</p>
        <p className="mt-0.5 text-[7.5px] text-white/50">
          {dateLine}
          <span className="mx-1 text-white/20">·</span>
          <span className="text-emerald-400">{isFr ? 'Service actif' : 'Service active'}</span>
        </p>
      </div>

      {/* KPI split row */}
      <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-y border-white/[0.06] py-2">
        <div className="pr-2.5">
          <p className="text-[7px]" style={{ color: PRO.textSec }}>{isFr ? 'Taux de conversion' : 'Conversion rate'}</p>
          <p className="mt-1 text-[13px] font-semibold leading-none tabular-nums text-white">
            <PopNumber value={convRate} format={(n) => `${n}%`} />
          </p>
        </div>
        <div className="px-2.5">
          <p className="text-[7px]" style={{ color: PRO.textSec }}>{isFr ? 'Appels traités' : 'Calls handled'}</p>
          <div className="mt-1 flex items-baseline gap-1">
            <p className="text-[13px] font-semibold leading-none tabular-nums text-white">
              <PopNumber value={callsMonth} />
            </p>
            <span className="inline-flex items-center text-[6.5px] font-medium" style={{ color: PRO.ok }}>
              <ArrowUpRight size={7} aria-hidden="true" />18%
            </span>
          </div>
        </div>
        <div className="pl-2.5">
          <p className="text-[7px]" style={{ color: PRO.textSec }}>{isFr ? 'Score sentiment' : 'Sentiment score'}</p>
          <p className="mt-1 text-[13px] font-semibold leading-none tabular-nums text-white">
            <PopNumber value={sentiment} format={(n) => `${n}%`} />
          </p>
        </div>
      </div>

      {/* Hero trend */}
      <div className="border-b border-white/[0.06] py-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[17px] font-semibold leading-none tracking-tight tabular-nums text-white">
              <PopNumber value={callsMonth} format={(n) => n.toLocaleString(isFr ? 'fr-FR' : 'en-US')} />
            </p>
            <p className="mt-1 text-[7px]" style={{ color: PRO.textSec }}>
              {isFr ? 'Appels traités ce mois' : 'Calls handled this month'}
            </p>
          </div>
          <span className="inline-flex items-center gap-0.5 text-[7px] font-medium" style={{ color: PRO.ok }}>
            <ArrowUpRight size={8} aria-hidden="true" />
            12% <span className="font-normal" style={{ color: PRO.textTer }}>{isFr ? 'sur 24 h' : 'over 24h'}</span>
          </span>
        </div>
        <svg viewBox={`0 0 ${TW} ${TH}`} className="mt-1 block h-10 w-full" preserveAspectRatio="none" aria-hidden="true">
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
            transition={{ duration: 0.9, delay: 0.5, ease: 'easeOut' }}
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
            transition={{ duration: 1.2, delay: 0.3, ease: EASE }}
          />
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

      {/* Quota segment bar */}
      <div className="border-b border-white/[0.06] py-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[7px] font-semibold uppercase tracking-[0.08em]" style={{ color: PRO.textSec }}>
            {isFr ? 'Utilisation du quota' : 'Quota usage'}
          </p>
          <span className="text-[6.5px] font-medium" style={{ color: PRO.textTer }}>
            {isFr ? `sur ${quotaTotal} appels inclus` : `of ${quotaTotal} calls included`}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <motion.div
            className="h-[4px] rounded-full"
            animate={{ width: `${quotaPct}%` }}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ background: PRO.line }}
          />
          <div className="h-[4px] flex-1 rounded-full" style={{ background: 'oklch(32% 0.01 265)' }} />
        </div>
      </div>

      {/* Activité récente */}
      <div className="min-h-0 flex-1 pt-1.5">
        <div className="mb-0.5 flex items-center justify-between">
          <p className="text-[7px] font-semibold uppercase tracking-[0.08em] text-white/40">
            {isFr ? 'Activité récente' : 'Recent activity'}
          </p>
          <span className="flex items-center gap-0.5 text-[6.5px] font-medium text-white/40">
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
                className="flex items-center gap-2 border-b border-white/[0.04] py-[4.5px] last:border-b-0"
              >
                <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-white/[0.05]" aria-hidden="true">
                  <Phone size={7} className="text-white/40" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[8px] font-medium leading-tight text-white/90">{row.name}</span>
                  <span className="block text-[6.5px] leading-tight text-white/30">{row.time} · {row.dur}s</span>
                </span>
                <span className={`flex-shrink-0 rounded-full px-1.5 py-[1.5px] text-[5.5px] font-medium uppercase tracking-wide ${OUTCOME_PILL[row.outcome]}`}>
                  {outcomeLabel[row.outcome]}
                </span>
                <ChevronRight size={7} className="flex-shrink-0 text-white/20" aria-hidden="true" />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      {/* Leads tally */}
      <div className="border-t border-white/[0.06] pt-1.5">
        <p className="text-[6.5px] uppercase tracking-[0.08em]" style={{ color: PRO.textTer }}>
          {isFr ? 'Leads qualifiés ce mois' : 'Leads qualified this month'}
        </p>
        <div className="mt-0.5 flex items-end justify-between">
          <p className="text-[13px] font-semibold leading-none tabular-nums text-white">
            <PopNumber value={leadsMonth} />
          </p>
          <span className="text-[7px] font-medium tabular-nums" style={{ color: PRO.textSec }}>{convRate}%</span>
        </div>
        <div className="mt-1 flex items-end gap-[2px]" style={{ height: 13 }} aria-hidden="true">
          {Array.from({ length: 40 }, (_, i) => (
            <motion.span
              key={i}
              className="flex-1 rounded-full"
              animate={{ background: i < Math.round((Math.min(100, convRate) / 100) * 40) ? PRO.line : PRO.tickOff }}
              transition={{ duration: 0.4 }}
              style={{ height: i % 4 === 0 ? '100%' : '64%' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Scene: ClientCalls miniature — a live call lands and resolves ──────────── */
function SceneCalls({ isFr, callsMonth }: { isFr: boolean; callsMonth: number }) {
  const pool = isFr ? POOL_FR : POOL_EN;
  const outcomeLabel = isFr ? OUTCOME_FR : OUTCOME_EN;
  const [liveState, setLiveState] = useState<'none' | 'live' | 'done'>('none');

  useEffect(() => {
    const t1 = setTimeout(() => setLiveState('live'), 1400);
    const t2 = setTimeout(() => setLiveState('done'), 1400 + RING_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const base = new Date();
  const list = [...pool, pool[0], pool[1]].map((c, i) => ({
    ...c,
    key: `${c.id}-${i}`,
    time: new Date(base.getTime() - (i + 1) * 9 * 60000).toLocaleTimeString(isFr ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
  }));

  return (
    <div className="flex h-full flex-col px-4 pt-10 pb-3">
      <AppBar title={isFr ? 'Appels' : 'Calls'} isFr={isFr} />

      <div className="pb-2">
        <p className="text-[12px] font-semibold tracking-tight text-white/90">{isFr ? 'Appels' : 'Calls'}</p>
        <p className="mt-0.5 text-[7.5px] text-white/50">
          <PopNumber value={callsMonth} /> {isFr ? 'appels au total' : 'calls in total'}
        </p>
      </div>

      {/* KPI split — like ClientCalls */}
      <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-y border-white/[0.06] py-2">
        {[
          { label: isFr ? 'Aujourd\'hui' : 'Today', value: '31' },
          { label: isFr ? 'Durée moy.' : 'Avg. duration', value: '1m 42s' },
          { label: isFr ? 'Décrochés' : 'Answered', value: '98%' },
        ].map((k, i) => (
          <div key={k.label} className={i === 0 ? 'pr-2.5' : i === 1 ? 'px-2.5' : 'pl-2.5'}>
            <p className="text-[7px]" style={{ color: PRO.textSec }}>{k.label}</p>
            <p className="mt-1 text-[13px] font-semibold leading-none tabular-nums text-white">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Call list — live call lands on top, then resolves to Lead */}
      <ul className="mt-1.5 min-h-0 flex-1">
        <AnimatePresence initial={false}>
          {liveState !== 'none' && (
            <motion.li
              key="live"
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="flex items-center gap-2 border-b border-white/[0.04] py-[5px]"
            >
              <span className="relative flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/10" aria-hidden="true">
                <Phone size={7} className="text-emerald-400" />
                {liveState === 'live' && (
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{ border: '1px solid rgba(52,211,153,0.5)', animation: 'statusPulse 1.1s ease-in-out infinite' }}
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[8px] font-medium leading-tight text-white/90">
                  {isFr ? 'Inconnu · 07 44 21 90 12' : 'Unknown · +1 555 0176'}
                </span>
                <span className="block text-[6.5px] leading-tight text-white/30">
                  {liveState === 'live' ? (isFr ? 'L\'IA est en ligne…' : 'AI on the line…') : (isFr ? 'À l\'instant · 41s' : 'Just now · 41s')}
                </span>
              </span>
              {liveState === 'live' ? (
                <span className="flex-shrink-0 rounded-full bg-amber-400/10 px-1.5 py-[1.5px] text-[5.5px] font-semibold uppercase tracking-wide text-amber-400">
                  {isFr ? 'En cours' : 'Live'}
                </span>
              ) : (
                <motion.span
                  initial={{ scale: 1.35 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                  className="flex-shrink-0 rounded-full bg-emerald-400/10 px-1.5 py-[1.5px] text-[5.5px] font-medium uppercase tracking-wide text-emerald-400"
                >
                  Lead
                </motion.span>
              )}
              <ChevronRight size={7} className="flex-shrink-0 text-white/20" aria-hidden="true" />
            </motion.li>
          )}
        </AnimatePresence>
        {list.map((row, i) => (
          <motion.li
            key={row.key}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.15 + i * 0.08 }}
            className="flex items-center gap-2 border-b border-white/[0.04] py-[5px] last:border-b-0"
          >
            <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-white/[0.05]" aria-hidden="true">
              <Phone size={7} className="text-white/40" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[8px] font-medium leading-tight text-white/90">{row.name}</span>
              <span className="block text-[6.5px] leading-tight text-white/30">{row.time} · {row.dur}s</span>
            </span>
            <span className={`flex-shrink-0 rounded-full px-1.5 py-[1.5px] text-[5.5px] font-medium uppercase tracking-wide ${OUTCOME_PILL[row.outcome]}`}>
              {outcomeLabel[row.outcome]}
            </span>
            <ChevronRight size={7} className="flex-shrink-0 text-white/20" aria-hidden="true" />
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

/* ── Scene: ClientAnalytics miniature — charts + sentiment donut ────────────── */
function SceneAnalytics({ isFr, callsMonth, sentiment }: { isFr: boolean; callsMonth: number; sentiment: number }) {
  const C = 2 * Math.PI * 14; // donut circumference (r=14)
  const segs = [
    { label: isFr ? 'Positif' : 'Positive', pct: sentiment, color: 'oklch(72% 0.18 145)' },
    { label: isFr ? 'Neutre' : 'Neutral', pct: 100 - sentiment - 4, color: 'rgba(255,255,255,0.28)' },
    { label: isFr ? 'Négatif' : 'Negative', pct: 4, color: 'oklch(65% 0.22 25)' },
  ];
  let acc = 0;

  return (
    <div className="flex h-full flex-col px-4 pt-10 pb-3">
      <AppBar title="Analytics" isFr={isFr} />

      <div className="pb-2">
        <p className="flex items-center gap-1 text-[12px] font-semibold tracking-tight text-white/90">
          <BarChart3 size={10} className="text-white/50" aria-hidden="true" /> Analytics
        </p>
        <p className="mt-0.5 text-[7.5px] text-white/50">{isFr ? '30 derniers jours' : 'Last 30 days'}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-y border-white/[0.06] py-2">
        {[
          { label: isFr ? 'Appels' : 'Calls', value: String(callsMonth) },
          { label: isFr ? 'Leads' : 'Leads', value: '32%' },
          { label: isFr ? 'Réponse' : 'Response', value: '<1s' },
        ].map((k, i) => (
          <div key={k.label} className={i === 0 ? 'pr-2.5' : i === 1 ? 'px-2.5' : 'pl-2.5'}>
            <p className="text-[7px]" style={{ color: PRO.textSec }}>{k.label}</p>
            <p className="mt-1 text-[13px] font-semibold leading-none tabular-nums text-white">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Volume area chart */}
      <div className="border-b border-white/[0.06] py-2">
        <p className="text-[7px] font-semibold uppercase tracking-[0.08em] text-white/40">
          {isFr ? 'Volume d\'appels' : 'Call volume'}
        </p>
        <svg viewBox={`0 0 ${TW} ${TH}`} className="mt-1 block h-10 w-full" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="hp3d-ana-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PRO.line} stopOpacity="0.22" />
              <stop offset="60%" stopColor={PRO.line} stopOpacity="0.06" />
              <stop offset="100%" stopColor={PRO.line} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={trendArea} fill="url(#hp3d-ana-fill)" />
          <motion.path
            d={trendPath}
            fill="none"
            stroke={PRO.line}
            strokeWidth="1.1"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, delay: 0.25, ease: EASE }}
          />
        </svg>
      </div>

      {/* Sentiment donut + legend */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-3 border-b border-white/[0.06] py-2">
        <svg viewBox="0 0 36 36" className="h-[58px] w-[58px] -rotate-90" aria-hidden="true">
          {segs.map((s) => {
            const dash = (s.pct / 100) * C;
            const off = -(acc / 100) * C;
            acc += s.pct;
            return (
              <motion.circle
                key={s.label}
                cx="18" cy="18" r="14"
                fill="none"
                stroke={s.color}
                strokeWidth="3.4"
                strokeDasharray={`${dash} ${C - dash}`}
                initial={{ strokeDashoffset: off + dash }}
                animate={{ strokeDashoffset: off }}
                transition={{ duration: 0.9, delay: 0.4, ease: EASE }}
              />
            );
          })}
        </svg>
        <div className="space-y-1">
          {segs.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
              <span className="flex-1 text-[7.5px] text-white/80">{s.label}</span>
              <span className="text-[7.5px] font-semibold tabular-nums text-white/70">{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hourly bars */}
      <div className="min-h-0 flex-1 pt-2">
        <p className="text-[7px] font-semibold uppercase tracking-[0.08em] text-white/40">
          {isFr ? 'Répartition par heure' : 'By hour of day'}
        </p>
        <div className="mt-1.5 flex h-[52px] items-end gap-[3px]" aria-hidden="true">
          {HOURS.map((h, i) => (
            <motion.span
              key={i}
              className="flex-1 rounded-t-[2px]"
              style={{ background: h >= 22 ? PRO.line : 'oklch(34% 0.01 265)' }}
              initial={{ height: 0 }}
              animate={{ height: `${(h / 24) * 100}%` }}
              transition={{ duration: 0.5, delay: 0.5 + i * 0.05, ease: EASE }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[6px] text-white/25" aria-hidden="true">
          <span>8h</span><span>12h</span><span>16h</span><span>20h</span>
        </div>

        {/* Conversion funnel — like the real Analytics page */}
        <div className="mt-2.5 border-t border-white/[0.06] pt-2">
          <p className="text-[7px] font-semibold uppercase tracking-[0.08em] text-white/40">
            {isFr ? 'Funnel de conversion' : 'Conversion funnel'}
          </p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {[
              { stage: isFr ? 'Appels reçus' : 'Calls received', v: String(callsMonth), pct: 100 },
              { stage: isFr ? 'Leads qualifiés' : 'Qualified leads', v: '132', pct: 32 },
              { stage: isFr ? 'RDV pris' : 'Booked', v: '87', pct: 21 },
            ].map((f, i) => (
              <motion.div
                key={f.stage}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.9 + i * 0.12, ease: EASE }}
              >
                <p className="text-[11px] font-semibold leading-none tabular-nums text-white">{f.v}</p>
                <p className="mt-0.5 text-[6px] leading-tight text-white/40">{f.stage}</p>
                <div className="mt-1 h-[3px] overflow-hidden rounded-full" style={{ background: 'oklch(28% 0.01 265)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: PRO.line }}
                    initial={{ width: 0 }}
                    animate={{ width: `${f.pct}%` }}
                    transition={{ duration: 0.7, delay: 1.1 + i * 0.12, ease: EASE }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Ultra-real iPhone shell + reactive 3D stage ────────────────────────────── */
export default function HeroPhone3D({ isFr }: { isFr: boolean }) {
  const reduced = useReducedMotion();
  const pool = isFr ? POOL_FR : POOL_EN;

  const [scene, setScene] = useState<Scene>(reduced ? 'overview' : 'home');
  const [tick, setTick] = useState(0);
  const [ringing, setRinging] = useState(false);
  const [callsMonth, setCallsMonth] = useState(412);
  const [leadsMonth, setLeadsMonth] = useState(132);
  const [sentiment, setSentiment] = useState(87);
  const tickRef = useRef(0);

  const incomingName = pool[(tickRef.current + 1) % pool.length].name;

  /* Scene timeline — loops like a product film */
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => {
      setScene((s) => ORDER[(ORDER.indexOf(s) + 1) % ORDER.length]);
    }, SCENE_MS[scene]);
    return () => clearTimeout(t);
  }, [scene, reduced]);

  /* Overview scene: two incoming calls ring the Dynamic Island and resolve */
  useEffect(() => {
    if (reduced || scene !== 'overview') return;
    const resolve = () => {
      setRinging(false);
      tickRef.current += 1;
      const evt = pool[tickRef.current % pool.length];
      setTick(tickRef.current);
      setCallsMonth((n) => n + 1);
      if (evt.outcome === 'lead' || evt.outcome === 'booked') setLeadsMonth((n) => n + 1);
      setSentiment((s) => Math.max(82, Math.min(94, s + (tickRef.current % 3 === 0 ? 1 : tickRef.current % 3 === 1 ? -1 : 0))));
    };
    const timers = [
      setTimeout(() => setRinging(true), 1800),
      setTimeout(resolve, 1800 + RING_MS),
      setTimeout(() => setRinging(true), 6400),
      setTimeout(resolve, 6400 + RING_MS),
    ];
    return () => { timers.forEach(clearTimeout); setRinging(false); };
  }, [scene, reduced, pool]);

  /* Calls scene: the live call also rings the island */
  useEffect(() => {
    if (reduced || scene !== 'calls') return;
    const t1 = setTimeout(() => setRinging(true), 1400);
    const t2 = setTimeout(() => {
      setRinging(false);
      setCallsMonth((n) => n + 1);
      setLeadsMonth((n) => n + 1);
    }, 1400 + RING_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); setRinging(false); };
  }, [scene, reduced]);

  /* Cursor-reactive tilt — tracks the pointer across the WHOLE page, gently.
     The device itself stays put (no idle float): static transforms let the
     browser re-rasterize the 3D layer at full resolution, keeping text crisp. */
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const spring = { stiffness: 110, damping: 20, mass: 0.6 };
  const smx = useSpring(mx, spring);
  const smy = useSpring(my, spring);
  // Symmetric rotation on every axis, pivoting on the device's own center:
  // the phone "looks at" the cursor wherever it goes on the page.
  const rotateY = useTransform(smx, [-0.5, 0.5], [-20, 20]);
  const rotateX = useTransform(smy, [-0.5, 0.5], [14, -14]);
  const rotateZ = useTransform(smx, [-0.5, 0.5], [-2.5, 2.5]);
  const glareX = useTransform(smx, [-0.5, 0.5], ['32%', '72%']);
  const glareY = useTransform(smy, [-0.5, 0.5], ['20%', '52%']);
  const glareBg = useTransform([glareX, glareY], ([x, y]) =>
    `radial-gradient(120% 60% at ${x} ${y}, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.045) 32%, transparent 60%)`
  );
  const shadowScale = useTransform(smx, [-0.5, 0.5], [1.04, 0.96]);

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: MouseEvent) => {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [reduced, mx, my]);

  const appScene = scene !== 'home';

  return (
    <div
      className="relative flex items-center justify-center py-6 lg:py-0"
      style={{ perspective: 1500 }}
      role="img"
      aria-label={isFr
        ? 'iPhone affichant iOS avec notifications Qwillio, puis la visite animée du dashboard client : vue d\'ensemble, appels, analytics'
        : 'iPhone showing iOS with Qwillio notifications, then an animated tour of the client dashboard: overview, calls, analytics'}
    >
      {/* Ambient brand glow behind the device */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, rgba(168,85,247,0.12) 45%, transparent 70%)' }}
      />

      <div aria-hidden="true">
        {/* Static stage — no idle float: the device is immobile, only the tilt follows the cursor */}
        <div>
          {/* Reactive 3D body */}
          <motion.div
            className="relative"
            style={{
              rotateX: reduced ? 0 : rotateX,
              rotateY: reduced ? 0 : rotateY,
              rotateZ: reduced ? 0 : rotateZ,
              transformStyle: 'preserve-3d',
              transformOrigin: 'center center',
              willChange: 'transform',
            }}
          >
            {/* Real device depth — stacked titanium slices form the visible side wall */}
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className="absolute inset-0 rounded-[52px]"
                style={{
                  transform: `translateZ(${-1.6 * (i + 1)}px)`,
                  background: i === 8
                    ? 'linear-gradient(155deg, #2e2e33 0%, #141417 55%, #303035 100%)'
                    : `linear-gradient(180deg, #7a7a80 0%, #3f3f45 12%, #2a2a2f 50%, #3f3f45 88%, #6d6d73 100%)`,
                  boxShadow: i === 8 ? 'inset 0 0 22px rgba(0,0,0,0.55)' : undefined,
                }}
              />
            ))}

            {/* Side buttons — sit on the metal edge, mid-depth, so they read in 3D */}
            <span className="absolute -left-[3.5px] top-[112px] h-[28px] w-[5px] rounded-l-[3px]" style={{ transform: 'translateZ(-7px)', background: 'linear-gradient(90deg, #8a8a90, #3a3a40 45%, #232327)' }} />
            <span className="absolute -left-[3.5px] top-[158px] h-[48px] w-[5px] rounded-l-[3px]" style={{ transform: 'translateZ(-7px)', background: 'linear-gradient(90deg, #8a8a90, #3a3a40 45%, #232327)' }} />
            <span className="absolute -left-[3.5px] top-[216px] h-[48px] w-[5px] rounded-l-[3px]" style={{ transform: 'translateZ(-7px)', background: 'linear-gradient(90deg, #8a8a90, #3a3a40 45%, #232327)' }} />
            <span className="absolute -right-[3.5px] top-[176px] h-[74px] w-[5px] rounded-r-[3px]" style={{ transform: 'translateZ(-7px)', background: 'linear-gradient(270deg, #8a8a90, #3a3a40 45%, #232327)' }} />

            {/* Titanium frame — front face */}
            <div
              className="relative w-[290px] rounded-[52px] p-[3px] sm:w-[320px]"
              style={{
                background: 'linear-gradient(155deg, #6b6b70 0%, #2c2c30 18%, #1a1a1d 45%, #3b3b40 78%, #757579 100%)',
                boxShadow: [
                  'inset 0 1px 1px rgba(255,255,255,0.28)',
                  'inset 0 -1px 1px rgba(0,0,0,0.55)',
                  '0 30px 60px -18px rgba(20,16,50,0.45)',
                  '0 70px 110px -30px rgba(99,102,241,0.28)',
                ].join(', '),
                backfaceVisibility: 'hidden',
              }}
            >
              {/* Antenna lines */}
              <span className="absolute left-[22%] top-0 h-[3px] w-[3px] rounded-full bg-black/50" />
              <span className="absolute right-[22%] top-0 h-[3px] w-[3px] rounded-full bg-black/50" />
              <span className="absolute bottom-0 left-[22%] h-[3px] w-[3px] rounded-full bg-black/50" />
              <span className="absolute bottom-0 right-[22%] h-[3px] w-[3px] rounded-full bg-black/50" />

              {/* Black bezel */}
              <div className="rounded-[49px] bg-[#050506] p-[9px]">
                {/* Screen */}
                <div className="relative aspect-[390/812] overflow-hidden rounded-[41px]" style={{ background: PRO.bg }}>
                  {/* Scenes — the looping product film */}
                  <AnimatePresence mode="wait">
                    {scene === 'home' ? (
                      <motion.div
                        key="home"
                        className="absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, y: -170, scale: 1.04 }}
                        transition={{ duration: 0.42, ease: EASE }}
                      >
                        <SceneHome isFr={isFr} />
                      </motion.div>
                    ) : (
                      <motion.div
                        key={scene}
                        className="absolute inset-0"
                        initial={scene === 'overview'
                          ? { opacity: 0, scale: 1.32, filter: 'blur(14px)' }
                          : { opacity: 0, x: 30, filter: 'blur(0px)' }}
                        animate={{ opacity: 1, scale: 1, x: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, x: -26 }}
                        transition={scene === 'overview'
                          ? { type: 'spring', stiffness: 190, damping: 24 }
                          : { duration: 0.4, ease: EASE }}
                        style={{ overflow: 'hidden' }}
                      >
                        {scene === 'overview' && (
                          <SceneOverview isFr={isFr} tick={tick} callsMonth={callsMonth} leadsMonth={leadsMonth} sentiment={sentiment} />
                        )}
                        {scene === 'calls' && <SceneCalls isFr={isFr} callsMonth={callsMonth} />}
                        {scene === 'analytics' && <SceneAnalytics isFr={isFr} callsMonth={callsMonth} sentiment={sentiment} />}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Status bar — above scenes */}
                  <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 pt-3.5 text-white">
                    <span className={`text-[11px] font-semibold tracking-tight tabular-nums ${scene === 'home' ? 'opacity-0' : ''}`}>9:41</span>
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

                  {/* Screen dims while a call rings — like real iOS */}
                  <motion.div
                    className="pointer-events-none absolute inset-0 z-10 bg-black"
                    animate={{ opacity: ringing ? 0.28 : 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    aria-hidden="true"
                  />

                  {/* Dynamic Island — expands on incoming call */}
                  <motion.div
                    className="absolute left-1/2 top-[9px] z-20 flex -translate-x-1/2 items-center overflow-hidden bg-black"
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
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: 'radial-gradient(circle at 35% 35%, #1e2a4a 0%, #0a0d18 60%)' }}
                            aria-hidden="true"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Glass glare — tracks the tilt */}
                  <motion.div className="pointer-events-none absolute inset-0 z-30" style={{ background: glareBg }} />
                  <div
                    className="pointer-events-none absolute inset-0 z-30 rounded-[41px]"
                    style={{ boxShadow: 'inset 0 0 14px rgba(255,255,255,0.045), inset 0 1px 0 rgba(255,255,255,0.07)' }}
                  />

                  {/* Home indicator */}
                  <span className={`absolute bottom-[7px] left-1/2 z-30 h-[4px] w-[100px] -translate-x-1/2 rounded-full ${appScene ? 'bg-white/80' : 'bg-white/60'}`} />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Floor shadow */}
          <motion.div
            className="mx-auto mt-9 h-6 w-[210px] rounded-full blur-xl"
            style={{ background: 'rgba(24,20,55,0.38)', scaleX: reduced ? 1 : shadowScale }}
          />
        </div>
      </div>
    </div>
  );
}
