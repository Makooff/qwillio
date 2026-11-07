/**
 * Les écrans du portail client, redessinés pour la caméra.
 *
 * Les valeurs (fonds, bordures, rayons, tailles) sont celles relevées sur le
 * portail lui-même (pages/client/*, styles calculés), les icônes passent par la
 * façade du portail et la grille de l'agenda par son propre calcul. Les
 * coordonnées sont celles d'un écran de 1600×900, que le film agrandit.
 */
import React from 'react';
import { Img, staticFile } from 'remotion';
import {
  BookOpen, Bot, Calendar, CheckCircle, ChevronLeft, ChevronRight, Clock, Download, Filter, HelpCircle,
  LayoutDashboard, List, LogOut, Phone, Search, Settings, Shield, Users, X, Sparkles,
} from '../../../frontend/src/components/icons';
import { monthGrid } from '../../../frontend/src/utils/month-grid';
import { C, EASE_DRAWER, EASE_EXPO, p, rise } from '../lib';

/** Les instants que la page Rendez-vous anime, fixés par la pub qui l'affiche. */
export const T = { callAnswered: -1, lines: [] as Array<{ who: string; at: number; end: number; text: string }>, clickCalls: 99, rowIn: 99, drawerIn: 99, summaryStart: 99, summaryEnd: 99, bookingChip: 99, overviewIn: 99, badgeBump: 0, upcomingIn: 0 };

export const W = 1600;
export const H = 900;
export type Page = 'calls' | 'bookings' | 'overview';

const ff: React.CSSProperties = { fontFamily: 'Outfit, sans-serif' };

/* ------------------------------------------------------------------ barre latérale */

const NAV: Array<{ id: Page | 'leads' | 'ai'; label: string; Icon: typeof Phone; y: number }> = [
  { id: 'overview', label: 'Vue d’ensemble', Icon: LayoutDashboard, y: 112 },
  { id: 'calls', label: 'Appels', Icon: Phone, y: 154 },
  { id: 'leads', label: 'Leads', Icon: Users, y: 196 },
  { id: 'bookings', label: 'Rendez-vous', Icon: Calendar, y: 238 },
  { id: 'ai', label: 'Réceptionniste IA', Icon: Bot, y: 280 },
];
export const navY = (id: Page) => NAV.find((n) => n.id === id)!.y + 20;

export function Sidebar({ active }: { active: Page }) {
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 220, height: H, background: C.sidebar, ...ff }}>
      <div style={{ position: 'absolute', left: 20, top: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Img src={staticFile('qwillio-logo-512.svg')} style={{ width: 34, height: 34, margin: -3 }} />
        <span style={{ color: C.text, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>Qwillio</span>
      </div>
      <div style={{ position: 'absolute', left: 16, right: 16, top: 68, height: 1, background: C.line }} />
      <div style={{ position: 'absolute', left: 28, top: 91, fontSize: 10, letterSpacing: '0.16em', color: C.text4, fontWeight: 600 }}>MENU</div>
      {NAV.map(({ id, label, Icon, y }) => {
        const on = id === active;
        return (
          <div key={id} style={{ position: 'absolute', left: 16, top: y, width: 188, height: 40, borderRadius: 10, background: on ? C.activeNav : 'transparent', display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 12 }}>
            {on && <div style={{ position: 'absolute', left: 0, top: 11, width: 2, height: 18, borderRadius: 2, background: C.indigo }} />}
            <Icon size={18} color={on ? C.indigo : C.text3} />
            <span style={{ fontSize: 14, color: on ? C.text : C.text2, fontWeight: on ? 500 : 400 }}>{label}</span>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 16, top: 322, width: 188, height: 40, display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 12 }}>
        <Settings size={18} color={C.text3} /><span style={{ fontSize: 14, color: C.text2 }}>Paramètres</span>
        <ChevronRight size={14} color={C.text4} style={{ marginLeft: 'auto', marginRight: 12 }} />
      </div>
      {[['Aide', HelpCircle, 756], ['Documentation', BookOpen, 793], ['Confidentialité', Shield, 830]].map(([l, I, y]) => {
        const Ic = I as typeof Phone;
        return (
          <div key={l as string} style={{ position: 'absolute', left: 28, top: y as number, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Ic size={16} color={C.text3} /><span style={{ fontSize: 13, color: C.text2 }}>{l as string}</span>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 16, right: 16, top: 870, height: 1, background: C.line }} />
    </div>
  );
}

/* ------------------------------------------------------------------ éléments communs */

function PageHead({ title, sub }: { title: string; sub: React.ReactNode }) {
  return (
    <>
      <div style={{ position: 'absolute', left: 32, top: 34, fontSize: 22, fontWeight: 600, color: C.text, letterSpacing: '-0.01em' }}>{title}</div>
      <div style={{ position: 'absolute', left: 32, top: 70, fontSize: 12.5, color: C.text3 }}>{sub}</div>
    </>
  );
}

const pill = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  position: 'absolute', height: 40, borderRadius: 9999, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.line}`,
  display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: C.text2, ...extra,
});

const chip = (color: string, bg: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 9999, fontSize: 11.5, fontWeight: 500,
  color, background: bg, border: `1px solid ${color}40`,
});

/* ------------------------------------------------------------------ page Appels */

const CALLS = [
  { name: 'Sophie Lambert', num: '+32 472 00 01 37', dur: '1m 03s', s: 'Neutre', at: '03/11/2026 18:39', lead: false },
  { name: 'Karim Benali', num: '+32 472 00 02 74', dur: '1m 26s', s: 'Positif', at: '03/11/2026 17:36', lead: false },
  { name: 'Julie Dubois', num: '+32 472 00 04 11', dur: '1m 49s', s: 'Positif', at: '03/11/2026 16:33', lead: true },
  { name: 'Marc Peeters', num: '+32 472 00 05 48', dur: '2m 12s', s: 'Négatif', at: '03/11/2026 15:30', lead: false },
  { name: 'Emma Janssens', num: '+32 472 00 06 85', dur: '2m 35s', s: 'Positif', at: '03/11/2026 14:27', lead: false },
  { name: 'Thomas Leroy', num: '+32 472 00 08 22', dur: '2m 58s', s: 'Neutre', at: '03/11/2026 13:24', lead: true },
  { name: 'Inès Haddad', num: '+32 472 00 09 59', dur: '3m 21s', s: 'Positif', at: '03/11/2026 12:21', lead: false },
  { name: 'Lucas Maes', num: '+32 472 00 10 96', dur: '0m 48s', s: 'Positif', at: '03/11/2026 11:02', lead: false },
];
export const NEW_CALL = { name: 'Laurent Martin', num: '+32 471 52 18 90', dur: '0m 52s', s: 'Positif', at: '03/11/2026 19:42', lead: true };

const sentimentChip = (s: string) =>
  s === 'Positif' ? chip(C.green, 'rgba(52,211,153,0.08)') : s === 'Négatif' ? chip(C.red, 'rgba(248,113,113,0.08)') : chip(C.amber, 'rgba(245,181,68,0.08)');

function CallRow({ c, y, style }: { c: typeof NEW_CALL; y: number; style?: React.CSSProperties }) {
  return (
    <div style={{ position: 'absolute', left: 32, right: 32, top: y, height: 65, borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', ...style }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, marginLeft: 20, display: 'grid', placeItems: 'center', background: c.lead ? 'rgba(245,181,68,0.10)' : 'rgba(122,95,255,0.10)' }}>
        {c.lead ? <Users size={16} color={C.amber} /> : <Phone size={16} color={C.indigo} />}
      </div>
      <div style={{ marginLeft: 12, width: 760 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{c.name}</span>
          {c.lead && <span style={{ ...chip(C.amber, 'rgba(245,181,68,0.10)'), fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', padding: '2px 8px' }}>LEAD</span>}
        </div>
        <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>{c.num}</div>
      </div>
      <div style={{ width: 132, fontSize: 13.5, color: C.text2 }}>{c.dur}</div>
      <div style={{ width: 112 }}><span style={sentimentChip(c.s)}>{c.s}</span></div>
      <div style={{ fontSize: 12.5, color: C.text2 }}>{c.at}</div>
      <ChevronRight size={14} color={C.text4} style={{ marginLeft: 'auto', marginRight: 24 }} />
    </div>
  );
}

const Stat = ({ x, Icon, v, l }: { x: number; Icon: typeof Phone; v: string; l: string }) => (
  <div style={{ position: 'absolute', left: x, top: 112 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon size={13} color={C.text4} />
      <span style={{ fontSize: 26, fontWeight: 600, color: C.text, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
    </div>
    <div style={{ fontSize: 11, color: C.text3, marginTop: 4, marginLeft: 21 }}>{l}</div>
  </div>
);

/** Durée de l'appel en direct, telle que LiveCalls l'affiche. */
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function CallsPage({ t }: { t: number }) {
  const live = t < T.clickCalls; // après le retour, l'appel est terminé et rangé dans la liste
  const total = t >= T.rowIn ? 129 : 128;
  const answered = t >= T.callAnswered;
  const listTop = live ? 455 : 272;
  const rowK = p(t, T.rowIn, 0.6, EASE_EXPO);
  return (
    <div style={{ position: 'absolute', inset: 0, ...ff }}>
      <PageHead title="Appels" sub={`${total} appels au total`} />
      <div style={{ position: 'absolute', right: 32, top: 34, ...pill({ position: 'absolute', right: 32, left: 'auto', padding: '0 18px', color: '#B9A8FF', background: 'rgba(122,95,255,0.10)', border: '1px solid rgba(122,95,255,0.25)', fontWeight: 500 }) }}>
        <Download size={15} color="#B9A8FF" />Exporter CSV
      </div>
      <Stat x={32} Icon={Phone} v={String(total)} l="Total appels" />
      <Stat x={425} Icon={Clock} v="1m 14s" l="Durée moy." />
      <Stat x={858} Icon={CheckCircle} v="71%" l="Taux positif" />
      <Stat x={1254} Icon={Users} v={t >= T.rowIn ? '24' : '23'} l="Leads ce mois" />
      {[401, 834, 1230].map((x) => <div key={x} style={{ position: 'absolute', left: x, top: 112, width: 1, height: 52, background: C.line }} />)}
      <div style={{ position: 'absolute', left: 32, right: 32, top: 190, height: 1, background: C.line }} />
      <div style={pill({ left: 32, top: 214, width: 1212, paddingLeft: 14 })}><Search size={16} color={C.text3} /><span style={{ color: C.text4 }}>Rechercher par nom, téléphone, résumé…</span></div>
      <div style={pill({ left: 1258, top: 214, width: 88, justifyContent: 'center', color: C.text, fontWeight: 500 })}><Filter size={14} color={C.text} />Filtres</div>

      {live && (
        <div style={{ position: 'absolute', left: 32, right: 32, top: 272, height: 150, borderRadius: 16, border: `1px solid ${C.lineStrong}`, background: 'rgba(255,255,255,0.04)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ position: 'relative', width: 10, height: 10 }}>
              {answered && <span style={{ position: 'absolute', inset: -((t * 1.2) % 1) * 8, borderRadius: 9999, background: '#fff', opacity: 0.4 * (1 - ((t * 1.2) % 1)) }} />}
              <span style={{ position: 'absolute', inset: 0, borderRadius: 9999, background: answered ? '#fff' : C.text4 }} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#F2F2F2' }}>{answered ? 'En cours' : 'Appel entrant'}</span>
            <span style={{ fontSize: 13, color: C.text2, fontVariantNumeric: 'tabular-nums' }}>{NEW_CALL.num}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: C.text3, fontVariantNumeric: 'tabular-nums' }}>{answered ? mmss((t - T.callAnswered) * 3.1) : ''}</span>
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {answered && T.lines.every((l) => t < l.at) && <div style={{ fontSize: 12, color: C.text3, fontStyle: 'italic' }}>La conversation commence…</div>}
            {T.lines.filter((l) => t >= l.at).map((l, i) => {
              const k = Math.min(1, (t - l.at) / (l.end - l.at));
              const shown = l.text.slice(0, Math.round(l.text.length * k));
              return (
                <div key={i} style={{ fontSize: 12, lineHeight: 1.6, ...rise(t, l.at, 0.35, 6) }}>
                  <span style={{ color: l.who === 'user' ? C.text3 : '#E8E8EC' }}>{l.who === 'user' ? 'Appelant' : 'IA'}</span>
                  <span style={{ color: C.text2 }}> — {shown}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', left: 52, top: listTop + 8, display: 'flex', fontSize: 12, color: C.text2, width: 1500 }}>
        <span style={{ width: 812 }}>Appelant</span><span style={{ width: 132 }}>Durée</span><span style={{ width: 112 }}>Sentiment</span><span>Date</span>
      </div>
      <div style={{ position: 'absolute', left: 32, right: 32, top: listTop + 40, height: 1, background: C.line }} />
      {!live && <CallRow c={NEW_CALL} y={listTop + 41} style={{ opacity: rowK, transform: `translateY(${(1 - rowK) * -16}px)`, background: `rgba(122,95,255,${0.10 * (1 - p(t, T.rowIn + 1.2, 1.2))})` }} />}
      {CALLS.map((c, i) => (
        <CallRow key={c.name} c={c} y={listTop + 41 + (i + (!live ? rowK : 0)) * 65} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ fiche d'appel */

export const DRAWER_W = 448;
export const SUMMARY = 'Nouveau client. Demande une coupe samedi matin. Rendez-vous pris samedi 7 novembre à 9 h 30, confirmation envoyée par SMS.';

export function CallDrawer({ t }: { t: number }) {
  const k = p(t, T.drawerIn, 0.55, EASE_DRAWER);
  if (k <= 0) return null;
  const typed = SUMMARY.slice(0, Math.round(SUMMARY.length * p(t, T.summaryStart, T.summaryEnd - T.summaryStart, (x) => x)));
  const box: React.CSSProperties = { borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.line}`, padding: '12px 13px' };
  const lab: React.CSSProperties = { fontSize: 10.5, letterSpacing: '0.08em', color: C.text3, textTransform: 'uppercase' };
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${0.45 * k})` }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: DRAWER_W, background: '#121212', borderLeft: `1px solid ${C.line}`, transform: `translateX(${(1 - k) * DRAWER_W}px)`, ...ff }}>
        <div style={{ height: 64, borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', padding: '0 24px' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>Détails de l’appel</span>
          <span style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: 9999, background: 'rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center' }}><X size={15} color={C.text2} /></span>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245,181,68,0.10)', display: 'grid', placeItems: 'center' }}><Users size={22} color={C.amber} /></div>
            <div><div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{NEW_CALL.name}</div><div style={{ fontSize: 12.5, color: C.text3, marginTop: 3 }}>{NEW_CALL.num}</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
            <div style={box}><div style={lab}>Durée</div><div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginTop: 6 }}>52s</div></div>
            <div style={box}><div style={lab}>Date</div><div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginTop: 6 }}>03/11/2026 19:42</div></div>
            <div style={box}><div style={lab}>Résultat</div><div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginTop: 6 }}>Rendez-vous pris</div></div>
            <div style={box}><div style={lab}>Sentiment</div><div style={{ marginTop: 6 }}><span style={sentimentChip('Positif')}>Positif</span></div></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, alignItems: 'center' }}>
            <span style={{ ...chip(C.amber, 'rgba(245,181,68,0.10)'), fontWeight: 600 }}>Lead qualifié</span>
            {t >= T.bookingChip && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: C.green, opacity: p(t, T.bookingChip, 0.3), transform: `scale(${0.94 + 0.06 * p(t, T.bookingChip, 0.35, EASE_EXPO)})` }}>
                <CheckCircle size={14} color={C.green} />Réservation confirmée
              </span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: C.text2, marginTop: 22 }}>Score lead</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 9999, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ width: `${82 * p(t, T.drawerIn + 0.4, 0.9, EASE_EXPO)}%`, height: '100%', borderRadius: 9999, background: C.indigo }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.indigo }}>8/10</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.text2, marginTop: 24 }}><Sparkles size={13} color={C.indigo} />Résumé IA</div>
          <div style={{ ...box, marginTop: 10, padding: '16px 17px', fontSize: 14, lineHeight: 1.6, color: C.text, minHeight: 96 }}>{typed}</div>
          <div style={{ fontSize: 12.5, color: C.text2, marginTop: 22 }}>Transcript</div>
          <div style={{ ...box, marginTop: 10, padding: '14px 17px', fontSize: 13, lineHeight: 1.7, color: C.text2 }}>
            {T.lines.slice(0, 3).map((l, i) => <div key={i}>{l.who === 'user' ? 'Appelant' : 'Qwillio'} : {l.text}</div>)}
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ page Rendez-vous */

const NAMES = ['Julie Dubois', 'Thomas Leroy', 'Inès Haddad', 'Emma Janssens', 'Chloé Wouters', 'Paul Simon', 'Nadia Amrani', 'Lucas Maes', 'Karim Benali', 'Sophie Lambert'];
const SVC = ['Coupe', 'Coupe et barbe', 'Couleur', 'Brushing', 'Barbe'];
/** Combien de rendez-vous par jour de novembre (déterministe). */
const countFor = (d: number) => (new Date(2026, 10, d).getDay() === 0 ? 0 : (d * 7) % 4);

export function BookingsPage({ t }: { t: number }) {
  const bump = p(t, T.badgeBump, 0.5, EASE_EXPO);
  const cells = monthGrid(new Date(2026, 10, 1), new Date(2026, 10, 7));
  const total = 36 + (t >= T.badgeBump ? 1 : 0);
  const upK = p(t, T.upcomingIn, 0.6, EASE_EXPO);
  const glow = 1 - p(t, T.upcomingIn + 1.4, 1.4);
  const cw = 112, ch = 96, gx = 8.6, gy = 8;
  return (
    <div style={{ position: 'absolute', inset: 0, ...ff }}>
      <PageHead title="Rendez-vous" sub={`${total} réservations en novembre 2026, prises par votre réceptionniste ou déplacées par vos clients.`} />
      <div style={pill({ left: 32, top: 114, width: 442, paddingLeft: 14 })}><Search size={16} color={C.text3} /><span style={{ color: C.text4 }}>Client, sujet ou numéro</span></div>
      <div style={pill({ left: 487, top: 114, width: 214, justifyContent: 'space-between', padding: '0 16px', color: C.text, fontWeight: 500 })}><ChevronLeft size={15} color={C.text2} />Novembre 2026<ChevronRight size={15} color={C.text2} /></div>
      <div style={pill({ left: 713, top: 114, width: 95, justifyContent: 'center', color: C.text })}>Aujourd’hui</div>
      <div style={pill({ left: 820, top: 114, width: 82, padding: 4, gap: 4 })}>
        <span style={{ width: 36, height: 32, borderRadius: 9999, background: '#fff', display: 'grid', placeItems: 'center' }}><Calendar size={14} color="#111" /></span>
        <span style={{ width: 36, height: 32, display: 'grid', placeItems: 'center' }}><List size={14} color={C.text2} /></span>
      </div>
      <div style={{ position: 'absolute', left: 32, top: 180, width: 870, height: 690, borderRadius: 20, border: `1px solid ${C.line}` }}>
        {['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'].map((d, i) => (
          <div key={d} style={{ position: 'absolute', left: 16 + i * (cw + gx), top: 17, width: cw, height: 24, borderRadius: 8, background: C.cell, display: 'grid', placeItems: 'center', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{d}</div>
        ))}
        {cells.map((c, i) => {
          const x = 16 + (i % 7) * (cw + gx), y = 49 + Math.floor(i / 7) * (ch + gy);
          let n = c.inMonth ? countFor(c.day) : 0;
          const target = c.inMonth && c.day === 7;
          if (target) n = t >= T.badgeBump ? 2 : 1;
          const s = target ? 1 + 0.35 * Math.sin(Math.PI * Math.min(1, bump * 1.6)) * (bump < 1 ? 1 : 0) : 1;
          return (
            <div key={c.iso} style={{ position: 'absolute', left: x, top: y, width: cw, height: ch, borderRadius: 16, background: c.inMonth ? C.cell : 'rgba(255,255,255,0.015)', boxShadow: target && t >= T.badgeBump ? `inset 0 0 0 ${1.5 * glow}px rgba(122,95,255,${0.9 * glow})` : 'none' }}>
              <div style={{ position: 'absolute', left: 13, top: 11, fontSize: 12.5, color: c.isToday ? C.indigo : c.inMonth ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)', fontWeight: c.isToday ? 600 : 400 }}>{c.day}</div>
              {n > 0 && (
                <div style={{ position: 'absolute', left: cw / 2 - 16, top: 38, width: 32, height: 32, borderRadius: 9999, background: C.deep, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 12.5, fontWeight: 600, transform: `scale(${s})` }}>{n}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* À venir */}
      <div style={{ position: 'absolute', left: 926, top: 182, fontSize: 15, fontWeight: 600, color: C.text }}>À venir</div>
      <Upcoming t={t} upK={upK} glow={glow} />
    </div>
  );
}

function UpCard({ time, name, sub, y, style }: { time: string; name: string; sub: string; y: number; style?: React.CSSProperties }) {
  return (
    <div style={{ position: 'absolute', left: 926, top: y, width: 420, height: 67, borderRadius: 14, border: `1px solid ${C.line}`, background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', padding: '0 18px', ...style }}>
      <span style={{ width: 64, fontSize: 15, fontWeight: 600, color: '#F5F5F7', fontVariantNumeric: 'tabular-nums' }}>{time}</span>
      <div><div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{name}</div><div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>{sub}</div></div>
      <ChevronRight size={14} color={C.text4} style={{ marginLeft: 'auto' }} />
    </div>
  );
}

function Upcoming({ t, upK, glow }: { t: number; upK: number; glow: number }) {
  // Mardi 3 (aujourd'hui), jeudi 5, vendredi 6, puis samedi 7 où le nouveau rendez-vous arrive.
  // Ce soir, samedi 7 : la table de Julie arrive en tête.
  const blocks: Array<{ head: React.ReactNode; items: Array<[string, string, string]> }> = [
    { head: <>Samedi 7 novembre <span style={{ color: C.indigo, fontWeight: 500, fontSize: 11.5, marginLeft: 6 }}>Aujourd’hui</span></>, items: [['19:00', 'Thomas Leroy', 'Table pour 2 · +32 471 00 70 01'], ['21:00', 'Inès Haddad', 'Table pour 6 · +32 471 00 70 00']] },
    { head: 'Dimanche 8 novembre', items: [['12:30', 'Chloé Wouters', 'Table pour 3 · +32 471 00 80 00']] },
    { head: 'Mardi 10 novembre', items: [['20:00', 'Paul Simon', 'Table pour 2 · +32 471 01 00 00']] },
  ];
  const out: React.ReactNode[] = [];
  let y = 218;
  blocks.forEach((b, bi) => {
    out.push(<div key={'h' + bi} style={{ position: 'absolute', left: 926, top: y, fontSize: 12.5, fontWeight: 600, color: C.text }}>{b.head}</div>);
    y += 28;
    if (bi === 0) {
      // Le nouveau rendez-vous se glisse en tête de samedi.
      out.push(<UpCard key="new" time="20:30" name="Julie Martin" sub="Table pour 4 · +32 471 52 18 90" y={y}
        style={{ opacity: upK, transform: `translateY(${(1 - upK) * -14}px) scale(${0.96 + 0.04 * upK})`, background: `rgba(122,95,255,${0.04 + 0.12 * glow})`, border: `1px solid rgba(122,95,255,${0.15 + 0.5 * glow})` }} />);
      y += 77 * upK;
    }
    b.items.forEach((it, ii) => { out.push(<UpCard key={bi + '-' + ii} time={it[0]} name={it[1]} sub={it[2]} y={y} />); y += 77; });
    y += 14;
  });
  return <>{out}</>;
}

/* ------------------------------------------------------------------ page Vue d'ensemble */

const DAILY = [3, 5, 4, 6, 8, 5, 2, 4, 6, 7, 5, 9, 6, 3, 5, 7, 6, 8, 4, 6, 9, 7, 5, 6, 8, 7, 4, 6, 8, 5];

export function OverviewPage({ t }: { t: number }) {
  const draw = p(t, T.overviewIn + 0.2, 1.8, EASE_EXPO);
  const count = Math.round(129 * p(t, T.overviewIn + 0.2, 1.6, EASE_EXPO));
  const cw = 920, chh = 260, x0 = 32, y0 = 300;
  const pts = DAILY.map((v, i) => [x0 + (i / (DAILY.length - 1)) * cw, y0 + chh - (v / 10) * chh] as const);
  // Courbe de Catmull-Rom, comme Recharts « monotone » le rend à l'œil.
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
  }
  const gaugeTicks = 56;
  return (
    <div style={{ position: 'absolute', inset: 0, ...ff }}>
      <PageHead title="Bonjour, Salon" sub={<>mardi 3 novembre <span style={{ margin: '0 6px', color: C.text4 }}>·</span><span style={{ color: C.green }}>Service actif</span></>} />
      <div style={{ position: 'absolute', right: 32, top: 38, fontSize: 12.5, color: C.text3 }}>5 oct. – 3 nov. 2026 <span style={{ color: C.text4, margin: '0 6px' }}>·</span> 30 derniers jours</div>
      {[['Taux de conversion', '18%', 32], ['Appels traités', String(count), 470], ['Score sentiment', '71%', 908]].map(([l, v, x], i) => (
        <div key={l as string} style={{ position: 'absolute', left: x as number, top: 118, ...rise(t, T.overviewIn + 0.05 * i, 0.5, 12) }}>
          <div style={{ fontSize: 12.5, color: C.text2 }}>{l}</div>
          <div style={{ fontSize: 26, fontWeight: 600, color: C.text, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
        </div>
      ))}
      {[446, 884].map((x) => <div key={x} style={{ position: 'absolute', left: x, top: 116, width: 1, height: 62, background: C.line }} />)}
      <div style={{ position: 'absolute', left: 32, right: 32, top: 204, height: 1, background: C.line }} />
      <div style={{ position: 'absolute', left: 32, top: 226, fontSize: 34, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{count}</div>
      <div style={{ position: 'absolute', left: 32, top: 272, fontSize: 12.5, color: C.text2 }}>Appels traités ce mois</div>
      <svg style={{ position: 'absolute', left: 0, top: 0 }} width={1000} height={620}>
        <defs>
          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity={0.14} /><stop offset="1" stopColor="#fff" stopOpacity={0} /></linearGradient>
          <clipPath id="reveal"><rect x={0} y={0} width={x0 + cw * draw + 2} height={620} /></clipPath>
        </defs>
        <g clipPath="url(#reveal)">
          <path d={`${d} L ${x0 + cw} ${y0 + chh} L ${x0} ${y0 + chh} Z`} fill="url(#fill)" />
          <path d={d} fill="none" stroke="#fff" strokeWidth={2} />
        </g>
      </svg>
      {/* Jauge « Appels ce mois », à droite */}
      <div style={{ position: 'absolute', left: 1050, top: 240, width: 296, height: 296 }}>
        <svg width={296} height={296} viewBox="0 0 296 296">
          {Array.from({ length: gaugeTicks }).map((_, i) => {
            const a = (-225 + (i / (gaugeTicks - 1)) * 270) * (Math.PI / 180);
            const on = i / gaugeTicks < 0.62 * draw;
            return <line key={i} x1={148 + Math.cos(a) * 112} y1={148 + Math.sin(a) * 112} x2={148 + Math.cos(a) * 136} y2={148 + Math.sin(a) * 136} stroke={on ? '#fff' : 'rgba(255,255,255,0.15)'} strokeWidth={2.5} strokeLinecap="round" />;
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div><div style={{ fontSize: 11, letterSpacing: '0.12em', color: C.text4 }}>APPELS CE MOIS</div><div style={{ fontSize: 34, fontWeight: 600, color: C.text, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{count}</div></div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 1050, top: 600, width: 296, height: 40, borderRadius: 12, border: `1px solid ${C.line}`, display: 'grid', placeItems: 'center', fontSize: 13, color: C.text, fontWeight: 500 }}>Voir les appels ↗</div>
      <div style={{ position: 'absolute', left: 32, right: 32, top: 660, height: 1, background: C.line }} />
      <div style={{ position: 'absolute', left: 32, top: 690, fontSize: 11, letterSpacing: '0.14em', color: C.text2, display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={13} color={C.text2} />ANALYSE IA</div>
      <div style={{ position: 'absolute', left: 32, top: 724, width: 640, fontSize: 18, lineHeight: 1.45, color: C.text, ...rise(t, T.overviewIn + 0.9, 0.6, 10) }}>
        Sentiment positif sur <b>71%</b> des appels analysés, avec un taux de conversion de <b>18%</b> ce mois.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ curseur */

export function Cursor({ x, y, press }: { x: number; y: number; press: number }) {
  return (
    <svg width={26} height={30} viewBox="0 0 26 30" style={{ position: 'absolute', left: x - 3, top: y - 2, transform: `scale(${1 - 0.14 * press})`, transformOrigin: '3px 2px', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}>
      <path d="M3 2 L3 24 L9 18.5 L13 27.5 L17 25.8 L13 17 L21 17 Z" fill="#fff" stroke="#111" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}
