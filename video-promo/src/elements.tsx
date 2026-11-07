/**
 * Les ÉLÉMENTS du portail client, sortis de leurs pages.
 *
 * Pas de capture d'écran ni de page entière : chaque pièce (la carte d'un appel
 * en cours, la grille de l'agenda, une carte « À venir », les blocs de la fiche
 * d'appel, la courbe, la jauge) est redessinée seule, avec les valeurs relevées
 * sur le portail (fonds, bordures, rayons, tailles), les icônes de sa façade
 * et la grille calculée par son propre code. Le film les met en scène.
 */
import React from 'react';
import { CheckCircle, ChevronRight, Phone, Sparkles, Users } from '../../frontend/src/components/icons';
import { monthGrid } from '../../frontend/src/utils/month-grid';
import { C, EASE_EXPO, p, rise } from './lib';
import { T } from './timeline';

const ff: React.CSSProperties = { fontFamily: 'Outfit, sans-serif' };

export const CALLER = { name: 'Laurent Martin', num: '+32 471 52 18 90' };

const chip = (color: string, bg: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 9999, fontSize: 11.5, fontWeight: 500,
  color, background: bg, border: `1px solid ${color}40`,
});

/* ------------------------------------------------ carte « En cours » (LiveCalls) */

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function LiveCallCard({ t }: { t: number }) {
  const answered = t >= T.callAnswered;
  const ping = (t * 1.2) % 1;
  return (
    <div style={{ width: 720, borderRadius: 16, border: `1px solid ${C.lineStrong}`, background: '#141414', padding: 22, ...ff }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ position: 'relative', width: 10, height: 10 }}>
          {answered && <span style={{ position: 'absolute', inset: -ping * 8, borderRadius: 9999, background: '#fff', opacity: 0.4 * (1 - ping) }} />}
          <span style={{ position: 'absolute', inset: 0, borderRadius: 9999, background: answered ? '#fff' : C.text4 }} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#F2F2F2' }}>{answered ? 'En cours' : 'Appel entrant'}</span>
        <span style={{ fontSize: 13, color: C.text2, fontVariantNumeric: 'tabular-nums' }}>{CALLER.num}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.text3, fontVariantNumeric: 'tabular-nums' }}>{answered ? mmss((t - T.callAnswered) * 3.1) : ''}</span>
      </div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 112 }}>
        {answered && T.lines.every((l) => t < l.at) && <div style={{ fontSize: 12, color: C.text3, fontStyle: 'italic' }}>La conversation commence…</div>}
        {T.lines.filter((l) => t >= l.at).map((l, i) => {
          const k = Math.min(1, (t - l.at) / (l.end - l.at));
          return (
            <div key={i} style={{ fontSize: 12, lineHeight: 1.6, ...rise(t, l.at, 0.35, 6) }}>
              <span style={{ color: l.who === 'user' ? C.text3 : '#E8E8EC' }}>{l.who === 'user' ? 'Appelant' : 'IA'}</span>
              <span style={{ color: C.text2 }}> — {l.text.slice(0, Math.round(l.text.length * k))}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------ grille de l'agenda (ClientBookings) */

/** Combien de rendez-vous par jour de novembre (déterministe, dimanche fermé). */
const countFor = (d: number) => (new Date(2026, 10, d).getDay() === 0 ? 0 : (d * 7) % 4);
export const CELL = { w: 112, h: 96, gx: 8.6, gy: 8, top: 49, left: 16 };
/** Position, dans la grille, de la case du samedi 7. */
export const SAT7 = { x: CELL.left + 5 * (CELL.w + CELL.gx), y: CELL.top + 1 * (CELL.h + CELL.gy) };

export function MonthGrid({ t }: { t: number }) {
  const bump = p(t, T.badgeBump, 0.5, EASE_EXPO);
  const glow = 1 - p(t, T.badgeBump + 1.6, 1.4);
  const cells = monthGrid(new Date(2026, 10, 1), new Date(2026, 10, 3));
  return (
    <div style={{ position: 'relative', width: 870, height: 690, borderRadius: 20, border: `1px solid ${C.line}`, background: C.panel, ...ff }}>
      {['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'].map((d, i) => (
        <div key={d} style={{ position: 'absolute', left: CELL.left + i * (CELL.w + CELL.gx), top: 17, width: CELL.w, height: 24, borderRadius: 8, background: C.cell, display: 'grid', placeItems: 'center', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{d}</div>
      ))}
      {cells.map((c, i) => {
        const x = CELL.left + (i % 7) * (CELL.w + CELL.gx), y = CELL.top + Math.floor(i / 7) * (CELL.h + CELL.gy);
        const row = Math.floor(i / 7);
        const appear = p(t, T.gridIn + 0.1 + row * 0.05 + (i % 7) * 0.015, 0.5, EASE_EXPO);
        const target = c.inMonth && c.day === 7;
        let n = c.inMonth ? countFor(c.day) : 0;
        if (target) n = t >= T.badgeBump ? 2 : 1;
        const s = target && bump < 1 ? 1 + 0.35 * Math.sin(Math.PI * Math.min(1, bump * 1.6)) : 1;
        return (
          <div key={c.iso} style={{ position: 'absolute', left: x, top: y, width: CELL.w, height: CELL.h, borderRadius: 16, background: c.inMonth ? C.cell : 'rgba(255,255,255,0.015)', opacity: appear, transform: `translateY(${(1 - appear) * 10}px)`, boxShadow: target && t >= T.badgeBump ? `inset 0 0 0 ${1.5 * glow}px rgba(122,95,255,${0.9 * glow})` : 'none' }}>
            <div style={{ position: 'absolute', left: 13, top: 11, fontSize: 12.5, color: c.isToday ? C.indigo : c.inMonth ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)', fontWeight: c.isToday ? 600 : 400 }}>{c.day}</div>
            {n > 0 && <div style={{ position: 'absolute', left: CELL.w / 2 - 16, top: 38, width: 32, height: 32, borderRadius: 9999, background: C.deep, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 12.5, fontWeight: 600, transform: `scale(${s})` }}>{n}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------ carte « À venir » */

export function UpCard({ time, name, sub, style }: { time: string; name: string; sub: string; style?: React.CSSProperties }) {
  return (
    <div style={{ width: 420, height: 67, borderRadius: 14, border: `1px solid ${C.line}`, background: '#121212', display: 'flex', alignItems: 'center', padding: '0 18px', ...ff, ...style }}>
      <span style={{ width: 64, fontSize: 15, fontWeight: 600, color: '#F5F5F7', fontVariantNumeric: 'tabular-nums' }}>{time}</span>
      <div><div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{name}</div><div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>{sub}</div></div>
      <ChevronRight size={14} color={C.text4} style={{ marginLeft: 'auto' }} />
    </div>
  );
}

/* ------------------------------------------------ pièces de la fiche d'appel */

const box: React.CSSProperties = { borderRadius: 12, background: '#141414', border: `1px solid ${C.line}`, padding: '12px 14px' };
const lab: React.CSSProperties = { fontSize: 10.5, letterSpacing: '0.08em', color: C.text3, textTransform: 'uppercase' };

export const CallerHead = () => (
  <div style={{ display: 'flex', gap: 16, alignItems: 'center', ...ff }}>
    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245,181,68,0.10)', display: 'grid', placeItems: 'center' }}><Users size={22} color={C.amber} /></div>
    <div><div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{CALLER.name}</div><div style={{ fontSize: 12.5, color: C.text3, marginTop: 3 }}>{CALLER.num}</div></div>
  </div>
);

export const StatBox = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ ...box, width: 194, ...ff }}><div style={lab}>{label}</div><div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginTop: 6 }}>{children}</div></div>
);

export const Positive = () => <span style={chip(C.green, 'rgba(52,211,153,0.08)')}>Positif</span>;
export const LeadChip = () => <span style={{ ...chip(C.amber, 'rgba(245,181,68,0.10)'), fontWeight: 600, ...ff }}>Lead qualifié</span>;
export const BookedChip = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: C.green, padding: '4px 11px', borderRadius: 9999, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)', ...ff }}>
    <CheckCircle size={14} color={C.green} />Réservation confirmée
  </span>
);

export function ScoreBar({ k }: { k: number }) {
  return (
    <div style={{ width: 400, ...ff }}>
      <div style={{ fontSize: 12.5, color: C.text2 }}>Score lead</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 9999, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ width: `${82 * k}%`, height: '100%', borderRadius: 9999, background: C.indigo }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.indigo, fontVariantNumeric: 'tabular-nums' }}>{Math.round(8 * k)}/10</span>
      </div>
    </div>
  );
}

export const SUMMARY = 'Nouveau client. Demande une coupe samedi matin. Rendez-vous pris samedi 7 novembre à 9 h 30, confirmation envoyée par SMS.';
export function SummaryBox({ t }: { t: number }) {
  const typed = SUMMARY.slice(0, Math.round(SUMMARY.length * p(t, T.summaryStart, T.summaryEnd - T.summaryStart, (x) => x)));
  return (
    <div style={{ width: 400, ...ff }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.text2 }}><Sparkles size={13} color={C.indigo} />Résumé IA</div>
      <div style={{ ...box, marginTop: 10, padding: '16px 17px', fontSize: 14, lineHeight: 1.6, color: C.text, height: 120 }}>{typed}</div>
    </div>
  );
}

/* ------------------------------------------------ le mois (ClientOverview) */

const DAILY = [3, 5, 4, 6, 8, 5, 2, 4, 6, 7, 5, 9, 6, 3, 5, 7, 6, 8, 4, 6, 9, 7, 5, 6, 8, 7, 4, 6, 8, 5];

export function CallsChart({ k, width = 920, height = 260 }: { k: number; width?: number; height?: number }) {
  const pts = DAILY.map((v, i) => [(i / (DAILY.length - 1)) * width, height - (v / 10) * height] as const);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
  }
  return (
    <svg width={width} height={height + 4} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity={0.14} /><stop offset="1" stopColor="#fff" stopOpacity={0} /></linearGradient>
        <clipPath id="reveal"><rect x={-2} y={-10} width={width * k + 4} height={height + 20} /></clipPath>
      </defs>
      <g clipPath="url(#reveal)">
        <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill="url(#fill)" />
        <path d={d} fill="none" stroke="#fff" strokeWidth={2} />
      </g>
    </svg>
  );
}

export function Gauge({ k, value }: { k: number; value: number }) {
  const ticks = 56;
  return (
    <div style={{ position: 'relative', width: 296, height: 296, ...ff }}>
      <svg width={296} height={296}>
        {Array.from({ length: ticks }).map((_, i) => {
          const a = (-225 + (i / (ticks - 1)) * 270) * (Math.PI / 180);
          const on = i / ticks < 0.62 * k;
          return <line key={i} x1={148 + Math.cos(a) * 112} y1={148 + Math.sin(a) * 112} x2={148 + Math.cos(a) * 136} y2={148 + Math.sin(a) * 136} stroke={on ? '#fff' : 'rgba(255,255,255,0.15)'} strokeWidth={2.5} strokeLinecap="round" />;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div><div style={{ fontSize: 11, letterSpacing: '0.12em', color: C.text4 }}>APPELS CE MOIS</div><div style={{ fontSize: 34, fontWeight: 600, color: C.text, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{value}</div></div>
      </div>
    </div>
  );
}

export const Kpi = ({ label, value }: { label: string; value: string }) => (
  <div style={ff}>
    <div style={{ fontSize: 12.5, color: C.text2 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 600, color: C.text, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </div>
);

export { Phone };
