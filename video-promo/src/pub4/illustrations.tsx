/**
 * Trois illustrations de la pub n° 2, dessinées avec la grammaire de celles du
 * site (`frontend/src/components/v2/ProductIllustration.tsx`) : mêmes classes
 * `pi__*`, même feuille de style, mêmes icônes. Le site n'a pas de dessin pour
 * le message noté, le clonage de voix ni les moteurs ; ces trois-là en sont les
 * cousins, pas des copies.
 *
 * Rien n'y est animé par le CSS (une animation CSS ne suit pas l'horloge de
 * Remotion) : chaque élément reçoit son apparition depuis `t`.
 */
import React from 'react';
import { Check, Clock, Lightbulb, MessageSquare, Mic, Send, UserVoice } from '../../../frontend/src/components/icons';
import '../../../frontend/src/components/v2/product-illustration.css';
import '../site-illustrations.css';
import { EASE_OUT, p } from '../lib';

const ff: React.CSSProperties = { fontFamily: 'Outfit, sans-serif' };
const W = 440; // la largeur mobile des illustrations du site, rendue ×2

/** Une apparition : elle sort du flou et monte d'un cheveu, au temps donné. */
const at = (t: number, from: number) => {
  const k = p(t, from, 0.45, EASE_OUT);
  return { opacity: k, filter: `blur(${(1 - k) * 6}px)`, transform: `translateY(${(1 - k) * 10}px)` } as React.CSSProperties;
};

/** Le cadre des illustrations du site : figure `.pi`, posée à ×2. */
export function SiteFrame({ kind, children, top = 620 }: { kind: string; children: React.ReactNode; top?: number }) {
  return (
    <div style={{ position: 'absolute', left: (1080 - W * 2) / 2, top, width: W, transform: 'scale(2)', transformOrigin: '0 0', borderRadius: 24, boxShadow: '0 30px 60px rgba(20,16,50,0.12)', ...ff }}>
      <figure className="pi" data-kind={kind} style={{ margin: 0 }}>
        <span className="pi__frame">
          <span className="pi__draw">{children}</span>
        </span>
      </figure>
    </div>
  );
}

/** « Elle note chaque message » : la fiche que le gérant reçoit. */
export function MessageNote({ t, from }: { t: number; from: number }) {
  const rows: Array<[string, string, boolean?]> = [
    ['Pour', 'Marc', true],
    ['Rappeler', 'après 17 h'],
    ['Numéro', '+32 471 52 18 90'],
    ['Motif', 'Une table pour huit, vendredi'],
  ];
  return (
    <SiteFrame kind="summary">
      <span className="pi__card" style={{ gap: 12 }}>
        <span className="pi__chip" style={at(t, from)}><MessageSquare />Nouveau message</span>
        <span className="pi__title" style={at(t, from + 0.15)}>Julie Martin a appelé</span>
        <span style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {rows.map(([label, value, active], i) => (
            <span key={label} style={{ ...at(t, from + 0.4 + i * 0.22), gridColumn: i === 3 ? '1 / -1' : undefined }}>
              <span className="pi__field-label" style={{ display: 'block' }}>{label}</span>
              <span className={active ? 'pi__field pi__field--active' : 'pi__field'}>{value}</span>
            </span>
          ))}
        </span>
        <span className="pi__chip" style={at(t, from + 1.5)}><Send />Envoyé à Marc par SMS<Check /></span>
      </span>
    </SiteFrame>
  );
}

/** « Elle peut même parler avec votre voix » : l'échantillon, puis la voix prête. */
export function VoiceClone({ t, from, ready }: { t: number; from: number; ready: number }) {
  const bars = 28;
  const rec = Math.min(1, Math.max(0, (t - from - 0.3) / (ready - from - 0.5)));
  const done = p(t, ready, 0.4, EASE_OUT);
  return (
    <SiteFrame kind="conversation">
      <span className="pi__card" style={{ gap: 14 }}>
        <span className="pi__chip" style={at(t, from)}><UserVoice />Votre voix</span>
        <span className="pi__title" style={at(t, from + 0.15)}>Une minute d’enregistrement</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, height: 54, ...at(t, from + 0.3) }}>
          {Array.from({ length: bars }, (_, i) => {
            const on = i / bars < rec;
            const h = 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7 + t * (on ? 9 : 0)) * Math.sin(i * 0.6 + 1));
            return <span key={i} style={{ flex: 1, height: `${h * 100}%`, borderRadius: 4, background: on ? 'var(--q2-indigo)' : 'var(--pi-line)' }} />;
          })}
        </span>
        <span className="pi__text pi__text--small" style={{ display: 'flex', alignItems: 'center', gap: 6, ...at(t, from + 0.4) }}><Clock />{`0:${String(Math.round(rec * 59)).padStart(2, '0')} / 1:00`}</span>
        <span className="pi__field pi__field--active" style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: done, filter: `blur(${(1 - done) * 6}px)` }}><Check />Voix prête : votre réceptionniste parle comme vous</span>
      </span>
    </SiteFrame>
  );
}

/** « Les meilleurs moteurs » : écouter, comprendre, répondre, en temps réel. */
export function Engines({ t, from }: { t: number; from: number }) {
  const rows: Array<[React.ReactNode, string, string]> = [
    [<Mic key="m" />, 'Elle écoute', 'Transcription en direct, accents compris'],
    [<Lightbulb key="l" />, 'Elle comprend', 'Les modèles de langage les plus récents'],
    [<UserVoice key="u" />, 'Elle répond', 'Une voix naturelle, sans attente'],
  ];
  return (
    <SiteFrame kind="insight">
      <span className="pi__card" style={{ gap: 14 }}>
        <span className="pi__chip" style={at(t, from)}><Clock />Temps réel</span>
        {rows.map(([icon, title, sub], i) => (
          <span key={title} style={{ display: 'flex', alignItems: 'center', gap: 12, ...at(t, from + 0.35 + i * 0.35) }}>
            <span className="pi__field pi__field--active" style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, padding: 0 }}>{icon}</span>
            <span>
              <span className="pi__title" style={{ fontSize: 18 }}>{title}</span>
              <span className="pi__text pi__text--small" style={{ display: 'block' }}>{sub}</span>
            </span>
          </span>
        ))}
      </span>
    </SiteFrame>
  );
}
