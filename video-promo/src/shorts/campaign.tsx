/**
 * La campagne « Elle prend le relais » : une mise en scène PROPRE à chaque vidéo.
 *
 * Retour du propriétaire sur la première version : « c'est la même vidéo, juste
 * les situations qui changent ». Les dix vidéos suivaient la même grammaire
 * (titre, téléphone qui sonne, rond et bulles, notification, carte). Ici, chaque
 * vidéo a son objet central, qu'on ne voit nulle part ailleurs dans la série :
 * deux téléphones côte à côte (c01), l'horloge de la soirée (c02), l'écran de
 * réglage d'iOS (c03), le ticket de commande qui s'imprime (c04), le journal des
 * appels et le compte à rebours de 30 s (c05), l'agenda de la semaine (c06), la
 * messagerie et son bip (c07), le panneau de la porte (c08), Bruxelles la nuit
 * en trois langues (c09), le clavier du téléphone qui compose le code (c10).
 *
 * Les écrans de téléphone reprennent les cotes du kit Figma « iOS 16 UI Kit »
 * (voir src/pub3/ios.tsx). Tout est piloté par le temps, comme le reste.
 */
import React from 'react';
import { EASE_IN_OUT, EASE_OUT, mix, p } from '../lib';
import { reveal, spring } from '../pub3/Pub3';
import { Device, H, InCallScreen, IncomingCall, LockScreen, Notification, W, sf } from '../pub3/ios';
import { Phone3D, useCine } from './cine';
import type { TScene } from './Short';
import type { Lang } from './types';

const INK = '#1D1D1F';
const BODY = '#777169';
const PLATE = '#EBE8E4';
const INDIGO = '#7A5FFF';
const ff: React.CSSProperties = { fontFamily: 'Outfit, sans-serif' };
const serif: React.CSSProperties = { fontFamily: 'QSerif, Georgia, serif', fontStyle: 'italic', fontWeight: 400 };
const WALL = 'ios/wallpaper-iphone14-midnight.png';
const card: React.CSSProperties = { position: 'absolute', borderRadius: 44, background: '#fff', boxShadow: `0 0 0 1px ${PLATE}, 0 50px 90px -40px rgba(60,30,120,0.35)` };
const appear = (t: number, at: number, dur = 0.45) => {
  const k = p(t, at, dur, EASE_OUT);
  return { opacity: k, transform: `translateY(${(1 - k) * 18}px)` } as React.CSSProperties;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(Math.floor(min % 60)).padStart(2, '0')}`;

function PhoneAt({ t, s, x, y, angle = 0, children }: { t: number; s: TScene; x: number; y: number; angle?: number; children: React.ReactNode }) {
  const cine = useCine();
  if (!cine) return <div style={{ position: 'absolute', left: x, top: y, width: 432, height: 904, borderRadius: 66, overflow: 'hidden' }}><Device scale={1.03}>{children}</Device></div>;
  return <Phone3D t={t} inAt={s.at + 0.05} outAt={s.out + 0.3} x={x} y={y} angle={angle} w={432} h={904}><Device scale={1.03}>{children}</Device></Phone3D>;
}


/**
 * La notification qui sort de l'écran vers la caméra, comme dans la série
 * d'origine (scène « notif » de Short.tsx) : « j'aimais bien les effets 3D ».
 */
function Pop3D({ t, at, title, desc, time = 'maintenant', y = 1000 }: { t: number; at: number; title: string; desc: string; time?: string; y?: number }) {
  if (!useCine() || t < at) return null;
  const k = 1 - Math.pow(2, -10 * Math.min(1, (t - at) / 0.9));
  return (
    <div style={{ position: 'absolute', left: 540 - 186, top: y, width: 373, transformOrigin: '50% 50%', opacity: Math.min(1, k * 1.5), transform: `translateZ(${60 + 220 * k}px) translateY(${(1 - k) * 80}px) rotateX(${(1 - k) * 25}deg) scale(${1.4 + 0.5 * k})`, borderRadius: 23, background: 'rgba(250,250,252,0.97)', boxShadow: '0 30px 60px -20px rgba(40,20,80,0.35), 0 0 0 1px rgba(0,0,0,0.04)' }}>
      <Notification kind="qwillio" title={title} desc={desc} time={time} />
    </div>
  );
}

/* ------------------------------------------------------------------ l'appel vu dans le téléphone */

/** L'écran de l'app Qwillio pendant qu'elle répond : la transcription en direct. */
function LiveCall({ t, s, who }: { t: number; s: TScene; who: string }) {
  const lines = s.tlines.filter((l) => t >= l.at - 0.3);
  const shown = lines.slice(-3);
  const sec = Math.max(0, Math.floor(t - s.at));
  return (
    <div style={{ position: 'relative', width: W, height: H, background: '#F2F2F7', overflow: 'hidden', ...sf }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 70, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 100, background: '#fff', fontSize: 13, fontWeight: 600, color: INDIGO }}>
          <span style={{ width: 8, height: 8, borderRadius: 8, background: '#30D158' }} />QWILLIO · {`0:${String(sec).padStart(2, '0')}`}
        </div>
        <div style={{ fontSize: 26, fontWeight: 600, marginTop: 14, color: '#000', letterSpacing: -0.4 }}>{who}</div>
      </div>
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 60, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shown.map((l, i) => {
          const agent = l.who === 'agent';
          const k = p(t, l.at - 0.3, 0.4, EASE_OUT);
          return (
            <div key={`${l.file}-${i}`} style={{ alignSelf: agent ? 'flex-end' : 'flex-start', maxWidth: '86%', padding: '12px 16px', borderRadius: 22, fontSize: 21, lineHeight: '27px', background: agent ? INDIGO : '#fff', color: agent ? '#fff' : '#000', opacity: k, transform: `translateY(${(1 - k) * 14}px)` }}>
              {l.words.map((w, j) => <span key={j} style={{ opacity: 0.25 + 0.75 * p(t, l.at + w.start - 0.04, 0.2) }}>{w.w} </span>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ c01 : deux téléphones, deux appels */

function Split({ t, s, o, lang }: { t: number; s: TScene; o: any; lang: Lang }) {
  const stage: string = o.stage;
  const ring = stage === 'two' ? { at: s.at + 0.6, out: s.at + 2.8 } : null;
  const right = (() => {
    if (stage === 'talk') return <LiveCall t={t} s={s} who={o.name} />;
    const banner = ring && t >= ring.at && t < ring.out ? <div style={reveal(t, ring.at)}><IncomingCall name={o.name} initials={o.initials} sub={lang === 'fr' ? 'ligne occupée' : lang === 'nl' ? 'lijn bezet' : 'line busy'} /></div> : undefined;
    const handed = stage === 'two' && t >= s.at + 2.85;
    const done = stage === 'done' && t >= s.at + 0.6;
    return (
      <LockScreen time={o.time} date={o.date} wallpaper={WALL} banner={banner}>
        {handed && <div style={reveal(t, s.at + 2.85)}><Notification kind="qwillio" title={o.took} desc={o.name} time={lang === 'fr' ? 'maintenant' : 'now'} /></div>}
        {done && <div style={reveal(t, s.at + 0.6)}><Notification kind="qwillio" title={o.doneTitle} desc={o.doneDesc} time={lang === 'fr' ? 'maintenant' : 'now'} /></div>}
      </LockScreen>
    );
  })();
  const label = (txt: string, x: number, lit: boolean) => (
    <div style={{ position: 'absolute', left: x, width: 432, top: 470, textAlign: 'center', ...ff, ...appear(t, s.at + 0.2) }}>
      <span style={{ padding: '10px 24px', borderRadius: 999, fontSize: 28, fontWeight: 600, letterSpacing: '0.04em', color: lit ? '#fff' : INK, background: lit ? INDIGO : '#fff', boxShadow: `0 0 0 1px ${PLATE}` }}>{txt}</span>
    </div>
  );
  const sec = 134 + Math.max(0, Math.floor(t - s.at));
  return (
    <>
      {label(o.you, 60, false)}
      {label('Qwillio', 588, stage !== 'one')}
      <PhoneAt t={t} s={s} x={60} y={560} angle={-3}>
        <InCallScreen name={o.busy} duration={`${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`} labels={o.keys} />
      </PhoneAt>
      <PhoneAt t={t} s={s} x={588} y={560} angle={3}>{right}</PhoneAt>
    </>
  );
}

/* ------------------------------------------------------------------ c02 : l'horloge de la soirée */

function Clock({ t, s, o }: { t: number; s: TScene; o: any }) {
  const k = p(t, s.at + 0.2, Math.max(0.5, s.out - s.at - 0.8), EASE_IN_OUT);
  const now = mix(o.from, o.to ?? o.from, k);
  const night = Math.min(1, Math.max(0, (now - 18 * 60) / 180)) * (now > 6 * 60 + 600 ? 1 : now < 9 * 60 ? 0 : 1);
  const dayK = Math.min(1, Math.max(0, (now - 6 * 60) / (18 * 60)));
  return (
    <>
      <div style={{ ...card, left: 90, right: 90, top: o.phone ? 520 : 640, height: 560, overflow: 'hidden', ...appear(t, s.at + 0.1, 0.6) }}>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(122,95,255,${0.04 + 0.1 * night}), rgba(255,255,255,0))` }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 70, textAlign: 'center', fontSize: 210, fontWeight: 300, letterSpacing: '-0.04em', color: INK, fontVariantNumeric: 'tabular-nums', ...ff }}>{hhmm(now)}</div>
        <div style={{ position: 'absolute', left: 60, right: 60, top: 360, height: 6, borderRadius: 6, background: '#F1F0EE' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${dayK * 100}%`, borderRadius: 6, background: INDIGO }} />
          <div style={{ position: 'absolute', left: `calc(${dayK * 100}% - 14px)`, top: -11, width: 28, height: 28, borderRadius: 28, background: '#fff', boxShadow: `0 0 0 3px ${INDIGO}` }} />
        </div>
        <div style={{ position: 'absolute', left: 60, right: 60, top: 392, display: 'flex', justifyContent: 'space-between', fontSize: 24, color: BODY, ...ff }}><span>6:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 50, textAlign: 'center', fontSize: 34, color: INK, ...ff, ...appear(t, s.at + 0.6) }}>{o.label}</div>
      </div>
      {o.phone === 'ring' && (
        <PhoneAt t={t} s={s} x={324} y={1000} angle={8}>
          <LockScreen time={hhmm(now)} date={o.date} wallpaper={WALL} banner={t >= s.at + 0.5 ? <div style={reveal(t, s.at + 0.5)}><IncomingCall name={o.name} initials={o.initials} /></div> : undefined} />
        </PhoneAt>
      )}
      {o.phone === 'notif' && <Pop3D t={t} at={s.at + 0.8} title={o.title} desc={o.desc} time={o.ago} y={1180} />}
    </>
  );
}

/* ------------------------------------------------------------------ c03 et c10 : le réglage dans iOS */

function SettingsScreen({ t, s, o }: { t: number; s: TScene; o: any }) {
  const rows: [string, boolean][] = o.rows;
  return (
    <div style={{ position: 'relative', width: W, height: H, background: '#F2F2F7', overflow: 'hidden', ...sf }}>
      <div style={{ position: 'absolute', left: 16, top: 66, fontSize: 17, color: '#007AFF' }}>‹ {o.back}</div>
      <div style={{ position: 'absolute', left: 16, top: 100, fontSize: 34, fontWeight: 700, letterSpacing: 0.37, color: '#000' }}>{o.title}</div>
      <div style={{ position: 'absolute', left: 32, top: 172, fontSize: 13, color: 'rgba(60,60,67,0.6)', textTransform: 'uppercase' }}>{o.section}</div>
      <div style={{ position: 'absolute', left: 16, right: 16, top: 196, borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
        {rows.map(([label, on], i) => {
          const at = s.at + 0.6 + i * 0.5;
          const sw = on ? p(t, at, 0.35, EASE_OUT) : 0;
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', minHeight: 52, padding: '0 16px', borderTop: i ? '0.5px solid rgba(60,60,67,0.29)' : 'none', ...appear(t, s.at + 0.3 + i * 0.25, 0.3) }}>
              <span style={{ flex: 1, fontSize: 17, color: '#000', letterSpacing: -0.4 }}>{label}</span>
              <span style={{ position: 'relative', width: 51, height: 31, borderRadius: 31, background: sw > 0.5 ? '#34C759' : 'rgba(120,120,128,0.16)' }}>
                <span style={{ position: 'absolute', top: 2, left: 2 + 20 * sw, width: 27, height: 27, borderRadius: 27, background: '#fff', boxShadow: '0 3px 8px rgba(0,0,0,0.15)' }} />
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 32, right: 32, top: 196 + rows.length * 52 + 10, fontSize: 13, lineHeight: '18px', color: 'rgba(60,60,67,0.6)', ...appear(t, s.at + 2.2) }}>{o.foot}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ c03 : la citation */

function Quote({ t, s, o }: { t: number; s: TScene; o: any }) {
  const k = spring(p(t, s.at + 0.1, 1.2, (x) => x));
  return (
    <>
      <div style={{ position: 'absolute', left: 70, top: 560, fontSize: 420, lineHeight: 1, color: INDIGO, opacity: 0.16 * k, transform: `translateY(${(1 - k) * 40}px)`, ...serif }}>«</div>
      <div style={{ position: 'absolute', right: 70, top: 1080, fontSize: 420, lineHeight: 1, color: INDIGO, opacity: 0.16 * k, transform: `translateY(${(1 - k) * -40}px)`, ...serif }}>»</div>
      {o.by && <div style={{ position: 'absolute', left: 0, right: 0, top: 1300, textAlign: 'center', fontSize: 32, color: BODY, ...ff, ...appear(t, s.at + 1.2) }}>{o.by}</div>}
    </>
  );
}

/* ------------------------------------------------------------------ c04 : la pile d'appels, puis le ticket */

function Pile({ t, s, o }: { t: number; s: TScene; o: any }) {
  const calls: [string, string][] = o.calls;
  const n = calls.filter((_, i) => t >= s.at + 0.4 + i * 0.9).length;
  return (
    <>
      <PhoneAt t={t} s={s} x={324} y={560} angle={Math.sin(t * 60) * (n ? 0.6 : 0)}>
        <LockScreen time={o.time} date={o.date} wallpaper={WALL}>
          {calls.map(([name, initials], i) => t >= s.at + 0.4 + i * 0.9 && (
            <div key={name} style={reveal(t, s.at + 0.4 + i * 0.9)}><IncomingCall name={name} initials={initials} /></div>
          ))}
        </LockScreen>
      </PhoneAt>
      <div style={{ position: 'absolute', right: 70, top: 520, width: 200, height: 200, borderRadius: 200, background: INK, color: '#fff', display: 'grid', placeItems: 'center', textAlign: 'center', ...ff, transform: `scale(${n ? 0.8 + 0.2 * spring(p(t, s.at + 0.4 + (n - 1) * 0.9, 0.6, (x) => x)) : 0})` }}>
        <div><div style={{ fontSize: 96, fontWeight: 600, lineHeight: 1 }}>{n}</div><div style={{ fontSize: 22, letterSpacing: '0.12em' }}>{o.unit}</div></div>
      </div>
    </>
  );
}

function Ticket({ t, s, o }: { t: number; s: TScene; o: any }) {
  const items: { at: number; txt: string }[] = (o.items as [number, string][]).map(([line, txt]) => ({ at: s.tlines[line]?.at ?? s.at + 1, txt }));
  const shown = items.filter((it) => t >= it.at + 0.4).length;
  const total = 210 + shown * 74 + (o.footAt !== undefined && t >= (s.tlines[o.footAt]?.end ?? 1e9) ? 150 : 0);
  const h = mix(120, total, 1);
  return (
    <div style={{ position: 'absolute', left: 230, width: 620, top: 470, ...appear(t, s.at + 0.1) }}>
      <div style={{ height: 34, borderRadius: 17, background: INK, boxShadow: '0 20px 40px -20px rgba(0,0,0,0.5)' }} />
      <div style={{ margin: '-14px 26px 0', height: h, overflow: 'hidden', background: '#fff', boxShadow: `0 0 0 1px ${PLATE}, 0 40px 80px -40px rgba(60,30,120,0.35)`, fontFamily: '"Courier New", monospace', color: INK, padding: '40px 40px 0', position: 'relative', clipPath: 'polygon(0 0,100% 0,100% calc(100% - 14px),95% 100%,90% calc(100% - 14px),85% 100%,80% calc(100% - 14px),75% 100%,70% calc(100% - 14px),65% 100%,60% calc(100% - 14px),55% 100%,50% calc(100% - 14px),45% 100%,40% calc(100% - 14px),35% 100%,30% calc(100% - 14px),25% 100%,20% calc(100% - 14px),15% 100%,10% calc(100% - 14px),5% 100%,0 calc(100% - 14px))' }}>
        <div style={{ textAlign: 'center', fontSize: 30, fontWeight: 700, letterSpacing: '0.08em' }}>{o.head}</div>
        <div style={{ textAlign: 'center', fontSize: 24, marginTop: 8, color: BODY }}>{o.sub}</div>
        <div style={{ borderTop: `3px dashed ${PLATE}`, margin: '26px 0' }} />
        {items.map((it, i) => t >= it.at + 0.4 && <div key={i} style={{ fontSize: 34, lineHeight: '74px', ...appear(t, it.at + 0.4, 0.25) }}>{it.txt}</div>)}
        {o.footAt !== undefined && t >= (s.tlines[o.footAt]?.end ?? 1e9) && (
          <div style={{ ...appear(t, s.tlines[o.footAt].end, 0.3) }}>
            <div style={{ borderTop: `3px dashed ${PLATE}`, margin: '20px 0' }} />
            <div style={{ fontSize: 30, fontWeight: 700 }}>{o.foot}</div>
            <div style={{ fontSize: 24, color: INDIGO, marginTop: 6 }}>{o.by}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ c05 : le journal d'appels et les 30 s */

function Recents({ t, s, o }: { t: number; s: TScene; o: any }) {
  const rows: { name: string; sub: string; time: string; missed?: boolean; q?: boolean; at?: number }[] = o.rows;
  return (
    <PhoneAt t={t} s={s} x={324} y={560} angle={-2}>
      <div style={{ position: 'relative', width: W, height: H, background: '#fff', overflow: 'hidden', ...sf }}>
        <div style={{ position: 'absolute', left: 16, top: 96, fontSize: 34, fontWeight: 700, color: '#000' }}>{o.title}</div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 150 }}>
          {rows.map((r, i) => {
            const at = s.at + (r.at ?? 0);
            if (t < at) return null;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '0.5px solid rgba(60,60,67,0.29)', background: r.q ? 'rgba(122,95,255,0.07)' : '#fff', ...appear(t, at, 0.35) }}>
                <div style={{ width: 40, height: 40, borderRadius: 40, flex: 'none', background: r.q ? INDIGO : 'linear-gradient(180deg,#A5AAB5,#858A95)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 600 }}>{r.q ? 'Q' : r.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 600, color: r.missed ? '#FF3B30' : '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                  <div style={{ fontSize: 14, color: r.q ? INDIGO : 'rgba(60,60,67,0.6)' }}>{r.sub}</div>
                </div>
                <div style={{ fontSize: 15, color: 'rgba(60,60,67,0.6)' }}>{r.time}</div>
              </div>
            );
          })}
        </div>
      </div>
    </PhoneAt>
  );
}

function Countdown({ t, s, o }: { t: number; s: TScene; o: any }) {
  const span = Math.max(1, s.out - s.at - 1.2);
  const k = p(t, s.at + 0.3, span, (x) => x);
  const left = Math.ceil(30 * (1 - k));
  const R = 230, C = 2 * Math.PI * R;
  const done = k >= 1;
  return (
    <div style={{ position: 'absolute', left: 540 - 280, top: 600, width: 560, height: 560, ...appear(t, s.at + 0.1) }}>
      <svg width={560} height={560} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={280} cy={280} r={R} fill="#fff" stroke={PLATE} strokeWidth={18} />
        <circle cx={280} cy={280} r={R} fill="none" stroke={done ? INDIGO : INK} strokeWidth={18} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * k} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', ...ff }}>
        <div>
          <div style={{ fontSize: done ? 64 : 200, fontWeight: done ? 600 : 300, lineHeight: 1, color: done ? INDIGO : INK, fontVariantNumeric: 'tabular-nums' }}>{done ? 'Qwillio' : left}</div>
          <div style={{ fontSize: 30, color: BODY, marginTop: 14 }}>{done ? o.after : o.unit}</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ c06 : l'agenda de la semaine */

function Calendar({ t, s, o }: { t: number; s: TScene; o: any }) {
  const days: string[] = o.days;
  const events: { d: number; h: number; txt: string; at: number }[] = o.events ?? [];
  const hours = [8, 9, 10, 11, 12];
  const colW = 118, rowH = 120, left = 150, top = 640;
  return (
    <div style={{ ...card, left: 50, right: 50, top: 500, height: 1100, overflow: 'hidden', ...appear(t, s.at + 0.1, 0.6) }}>
      <div style={{ position: 'absolute', left: 50, top: 40, fontSize: 34, fontWeight: 600, color: INK, ...ff }}>{o.title}</div>
      {days.map((d, i) => (
        <div key={d} style={{ position: 'absolute', left: left - 50 + i * colW, top: top - 500 - 60, width: colW, textAlign: 'center', fontSize: 24, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? INDIGO : BODY, ...ff }}>{d}</div>
      ))}
      {hours.map((h, j) => (
        <React.Fragment key={h}>
          <div style={{ position: 'absolute', left: 30, top: top - 500 + j * rowH - 12, fontSize: 22, color: BODY, ...ff }}>{h}:00</div>
          <div style={{ position: 'absolute', left: left - 50, right: 30, top: top - 500 + j * rowH, borderTop: `1px solid ${PLATE}` }} />
        </React.Fragment>
      ))}
      <div style={{ position: 'absolute', left: left - 50, width: colW, top: top - 560, bottom: 0, background: 'rgba(122,95,255,0.05)' }} />
      {events.map((e, i) => {
        const at = s.at + e.at;
        if (t < at) return null;
        const k = spring(p(t, at, 0.8, (x) => x));
        return (
          <div key={i} style={{ position: 'absolute', left: left - 50 + e.d * colW + 6, width: colW - 12, top: top - 500 + (e.h - 8) * rowH + 6, height: rowH - 12, borderRadius: 16, background: INDIGO, color: '#fff', padding: '10px 12px', fontSize: 19, lineHeight: '23px', ...ff, transform: `scale(${0.6 + 0.4 * k})`, opacity: Math.min(1, k * 2) }}>{e.txt}</div>
        );
      })}
      {o.foot && <div style={{ position: 'absolute', left: 50, right: 50, bottom: 40, fontSize: 28, color: BODY, ...ff, ...appear(t, s.at + 1.2) }}>{o.foot}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ c07 : la messagerie et son bip */

function Voicemail({ t, s, o }: { t: number; s: TScene; o: any }) {
  const beepAt = s.at + (o.beep ?? 2.6);
  const ended = o.mode === 'hangup' && t >= s.at + 1.2;
  const bars = Array.from({ length: 34 }, (_, i) => {
    const live = t < beepAt ? 0.25 + 0.75 * Math.abs(Math.sin(t * 9 + i * 0.7) * Math.sin(t * 3.1 + i)) : t < beepAt + 0.5 ? 1 : 0.06;
    return o.mode === 'hangup' ? 0.06 : live;
  });
  return (
    <PhoneAt t={t} s={s} x={324} y={560}>
      <div style={{ position: 'relative', width: W, height: H, background: '#000', overflow: 'hidden', ...sf }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 120, textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: 18, color: 'rgba(235,235,245,0.6)' }}>{ended ? o.endedLabel : o.calling}</div>
          <div style={{ fontSize: 36, marginTop: 8 }}>{o.name}</div>
        </div>
        <div style={{ position: 'absolute', left: 30, right: 30, top: 380, height: 120, display: 'flex', alignItems: 'center', gap: 4 }}>
          {bars.map((b, i) => <div key={i} style={{ flex: 1, height: `${b * 100}%`, borderRadius: 4, background: t >= beepAt && t < beepAt + 0.5 ? '#FF453A' : 'rgba(255,255,255,0.75)' }} />)}
        </div>
        {o.mode !== 'hangup' && t >= beepAt && <div style={{ position: 'absolute', left: 0, right: 0, top: 540, textAlign: 'center', fontSize: 64, fontWeight: 700, color: '#FF453A', ...reveal(t, beepAt, 0.3) }}>BIP</div>}
        {ended && <div style={{ position: 'absolute', left: '50%', top: 640, marginLeft: -39, width: 78, height: 78, borderRadius: 78, background: '#FF453A', ...reveal(t, s.at + 1.2) }} />}
      </div>
    </PhoneAt>
  );
}

/* ------------------------------------------------------------------ c08 : le panneau de la porte */

function Sign({ t, s, o }: { t: number; s: TScene; o: any }) {
  const swing = Math.sin((t - s.at) * 2.2) * 6 * Math.exp(-(t - s.at) * 0.4);
  const flip = o.flipAt !== undefined ? p(t, s.at + o.flipAt, 0.7, EASE_IN_OUT) : 0;
  const side = flip < 0.5;
  return (
    <div style={{ position: 'absolute', left: 540 - 300, top: 560, width: 600, perspective: 1600, ...appear(t, s.at + 0.1) }}>
      <svg width={600} height={160} style={{ position: 'absolute', top: -150 }}><path d="M300 0 L120 150 M300 0 L480 150" stroke={INK} strokeWidth={3} fill="none" /><circle cx={300} cy={6} r={10} fill={INK} /></svg>
      <div style={{ transformOrigin: '50% -150px', transform: `rotate(${swing}deg) rotateY(${flip * 180}deg)`, transformStyle: 'preserve-3d' }}>
        <div style={{ height: 380, borderRadius: 36, background: side ? '#fff' : INDIGO, boxShadow: `0 0 0 1px ${PLATE}, 0 60px 90px -40px rgba(60,30,120,0.4)`, display: 'grid', placeItems: 'center', textAlign: 'center', transform: side ? 'none' : 'rotateY(180deg)', ...ff }}>
          <div>
            <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: '0.06em', color: side ? INK : '#fff' }}>{side ? o.closed : o.open}</div>
            <div style={{ fontSize: 34, color: side ? BODY : 'rgba(255,255,255,0.85)', marginTop: 8 }}>{side ? o.closedSub : o.openSub}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Orders({ t, s, o }: { t: number; s: TScene; o: any }) {
  const rows: [string, string][] = o.rows;
  return (
    <div style={{ ...card, left: 90, right: 90, top: 540, padding: '44px 48px', ...ff, ...appear(t, s.at + 0.1, 0.6) }}>
      <div style={{ fontSize: 24, letterSpacing: '0.16em', fontWeight: 600, color: BODY }}>{o.title}</div>
      {rows.map(([a, b], i) => (
        <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 24, padding: '22px 26px', borderRadius: 24, background: i === rows.length - 1 ? 'rgba(122,95,255,0.08)' : '#F7F7F8', ...appear(t, s.at + 0.5 + i * 0.45, 0.35) }}>
          <span style={{ width: 16, height: 16, borderRadius: 16, background: i === rows.length - 1 ? INDIGO : INK }} />
          <span style={{ flex: 1, fontSize: 34, color: INK }}>{a}</span>
          <span style={{ fontSize: 28, color: BODY }}>{b}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ c09 : Bruxelles, la nuit, trois langues */

function City({ t, s, o }: { t: number; s: TScene; o: any }) {
  const words: [string, string, number, number][] = o.words; // texte, langue, x, y
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 640, textAlign: 'center', ...ff, ...appear(t, s.at + 0.1, 0.7) }}>
        <div style={{ fontSize: 150, color: INK, letterSpacing: '-0.03em', ...serif }}>{o.city}</div>
        <div style={{ fontSize: 44, color: BODY, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{o.time}</div>
      </div>
      {words.map(([w, lang, x, y], i) => {
        const at = s.at + 0.6 + i * 0.5;
        const k = spring(p(t, at, 0.9, (v) => v));
        const lit = lang === o.lit;
        return t >= at && (
          <div key={w} style={{ position: 'absolute', left: x, top: y + Math.sin(t * 1.2 + i) * 8, padding: '16px 26px', borderRadius: 30, borderBottomLeftRadius: 8, fontSize: 34, background: lit ? INDIGO : '#fff', color: lit ? '#fff' : INK, boxShadow: `0 0 0 1px ${PLATE}, 0 20px 40px -24px rgba(60,30,120,0.35)`, ...ff, opacity: Math.min(1, k * 2), transform: `scale(${0.7 + 0.3 * k})` }}>
            <span style={{ fontSize: 20, letterSpacing: '0.12em', marginRight: 12, opacity: 0.7 }}>{lang}</span>{w}
          </div>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ c10 : le clavier qui compose le code */

const KEYS: [string, string][] = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];

/** Le clavier de l'app Téléphone, mode sombre, aux cotes du kit (1118:8444) : touches de 78 pt en #333, 24 pt d'écart, 18 pt entre les rangées. */
function Dialer({ t, s, o }: { t: number; s: TScene; o: any }) {
  const code: string = o.code;
  const start = s.at + 0.6, step = Math.min(0.22, Math.max(0.1, (s.out - s.at - 1.8) / code.length));
  const typed = Math.max(0, Math.min(code.length, Math.floor((t - start) / step) + 1));
  const last = typed > 0 ? code[typed - 1] : '';
  const pressK = typed > 0 ? 1 - p(t, start + (typed - 1) * step, 0.18) : 0;
  const called = t >= start + code.length * step + 0.3;
  return (
    <>
    <PhoneAt t={t} s={s} x={324} y={560} angle={-2}>
      <div style={{ position: 'relative', width: W, height: H, background: '#000', overflow: 'hidden', ...sf }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 110, textAlign: 'center', color: '#fff', fontSize: code.length > 12 ? 28 : 36, letterSpacing: 0.2, height: 41 }}>{code.slice(0, typed)}</div>
        {o.hint && <div style={{ position: 'absolute', left: 0, right: 0, top: 160, textAlign: 'center', fontSize: 16, color: '#0A84FF' }}>{o.hint}</div>}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 250, display: 'grid', gridTemplateColumns: 'repeat(3, 78px)', justifyContent: 'center', columnGap: 24, rowGap: 18 }}>
          {KEYS.map(([k, sub]) => (
            <div key={k} style={{ width: 78, height: 78, borderRadius: 100, background: k === last ? `rgba(${Math.round(51 + 120 * pressK)},${Math.round(51 + 120 * pressK)},${Math.round(51 + 120 * pressK)},1)` : '#333', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: k === '*' ? 40 : 37, lineHeight: '41px' }}>{k}</span>
              {sub && <span style={{ fontSize: k === '0' ? 14 : 10, fontWeight: 700, letterSpacing: 2.8 }}>{sub}</span>}
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: '50%', top: 652, marginLeft: -37.5, width: 75, height: 75, borderRadius: 75, background: '#30D158', transform: `scale(${called ? 1 - 0.08 * (1 - p(t, start + code.length * step + 0.3, 0.25)) : 1})` }}>
          <svg viewBox="0 0 24 24" width={34} height={34} style={{ position: 'absolute', left: 20.5, top: 20.5 }} fill="#fff"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" /></svg>
        </div>
        {called && o.result && <div style={{ position: 'absolute', left: 16, right: 16, top: 10, ...reveal(t, start + code.length * step + 0.5) }}><Notification kind="phone" title={o.result} desc={o.resultDesc ?? ''} time={o.now ?? 'maintenant'} /></div>}
      </div>
    </PhoneAt>
    {o.result && <Pop3D t={t} at={start + code.length * step + 0.7} title={o.result} desc={o.resultDesc ?? ''} y={1250} />}
    </>
  );
}

/* ------------------------------------------------------------------ l'aiguillage */

export function campaignVisual(t: number, s: TScene, lang: Lang): { body?: React.ReactNode; over?: React.ReactNode } {
  const r = campaignBody(t, s, lang);
  const o = (s.visual as Extract<TScene['visual'], { kind: 'x' }>).opts ?? {};
  if (!o.pop) return r;
  return { ...r, body: <>{r.body}<Pop3D t={t} at={s.at + o.pop.at} title={o.pop.title} desc={o.pop.desc} time={o.pop.time ?? (lang === 'fr' ? 'maintenant' : lang === 'nl' ? 'nu' : 'now')} y={o.pop.y ?? 1250} /></> };
}

function campaignBody(t: number, s: TScene, lang: Lang): { body?: React.ReactNode; over?: React.ReactNode } {
  const v = s.visual as Extract<TScene['visual'], { kind: 'x' }>;
  const o = v.opts ?? {};
  switch (v.scene) {
    case 'split': return { body: <Split t={t} s={s} o={o} lang={lang} /> };
    case 'clock': return { body: <Clock t={t} s={s} o={o} /> };
    case 'settings': return { body: <PhoneAt t={t} s={s} x={324} y={560} angle={-2}><SettingsScreen t={t} s={s} o={o} /></PhoneAt> };
    case 'quote': return { body: <Quote t={t} s={s} o={o} /> };
    case 'pile': return { body: <Pile t={t} s={s} o={o} /> };
    case 'ticket': return { body: <Ticket t={t} s={s} o={o} /> };
    case 'recents': return { body: <Recents t={t} s={s} o={o} /> };
    case 'countdown': return { body: <Countdown t={t} s={s} o={o} /> };
    case 'calendar': return { body: <Calendar t={t} s={s} o={o} /> };
    case 'voicemail': return { body: <Voicemail t={t} s={s} o={o} /> };
    case 'sign': return { body: <Sign t={t} s={s} o={o} /> };
    case 'orders': return { body: <Orders t={t} s={s} o={o} /> };
    case 'city': return { body: <City t={t} s={s} o={o} /> };
    case 'dialer': return { body: <Dialer t={t} s={s} o={o} /> };
    case 'livecall': return { body: <PhoneAt t={t} s={s} x={324} y={560} angle={2}><LiveCall t={t} s={s} who={o.who} /></PhoneAt> };
    default: return {};
  }
}
