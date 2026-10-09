import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE_OUT_EXPO } from './motion/reducedMotion';
import { WEEKDAYS_FR, monthGrid, monthLabel, isoDay } from '../../utils/month-grid';
import { parseTranscript } from '../../utils/transcript';
import SentimentBadge from '../client-dashboard/SentimentBadge';
import { Phone, Clock, Calendar, CheckCircle2 } from '../../components/icons';
import { t } from '../../styles/admin-theme';

/* Les illustrations des six cartes de la page Réceptionniste.

   Ce sont les VRAIS composants du portail, rendus tels quels — même grille de
   calendrier (utils/month-grid), même relecture de transcript (utils/transcript),
   même pastille de sentiment (SentimentBadge). Les COULEURS sont celles du vrai
   portail : elles viennent de `admin-theme.ts` (« Signal Dark v3 »), la source
   unique de vérité — pas des hex approximés. */

/* ── Couleurs (source unique : admin-theme / Signal Dark v3) ───────────── */
const C = {
  card: t.panel,       // #0a0a0a — la surface
  decal: t.elevated,   // #111111 — l'ombre déportée
  well: t.inset,       // #111111 — les puits imbriqués
  border: t.border,    // oklch(24% 0 0 / 0.55)
  borderHi: t.borderHi, // oklch(32% 0 0 / 0.70)
  text: t.text,        // oklch(95% 0 0)
  sec: t.textSec,      // oklch(65% 0 0)
  ter: t.textTer,      // oklch(42% 0 0)
  muted: t.textMuted,  // oklch(28% 0 0)
  brand: t.brand,      // #7349fe
  brandHi: t.brandHi,  // #8a6fff
  ok: t.success,       // vert
  warn: t.warning,     // ambre (le lead)
  wash: 'rgba(255,255,255,0.06)',
  washCell: 'rgba(255,255,255,0.04)',
  washDim: 'rgba(255,255,255,0.02)',
} as const;

/* Lavis de marque, calqués sur `t.accentGlow` / `t.accentDim`. */
const brandWash = 'rgba(115,73,254,0.14)';
const brandWashSoft = 'rgba(115,73,254,0.10)';

/* Le cadre commun : une ombre déportée — un panneau #111111 décalé de 8 px en
   bas à droite, comme le cadre de déco qu'on posait derrière les captures —
   puis la surface #0a0a0a par-dessus.

   L'animation est CELLE DU SITE (RevealV2) rejouée en boucle : le fondu + la
   remontée d'arrivée (opacity 0→1, y 20→0, courbe expo), un temps de pose,
   puis la sortie, et ça recommence — comme une démo qui tourne. */
function Card({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="relative"
      initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      animate={reduced ? { opacity: 1, y: 0 } : { opacity: [0, 1, 1, 0], y: [20, 0, 0, 20] }}
      transition={
        reduced
          ? { duration: 0 }
          : {
              duration: 4,
              times: [0, 0.125, 0.625, 0.75],
              ease: [EASE_OUT_EXPO, 'linear', 'easeIn'],
              repeat: Infinity,
              repeatDelay: 1.2,
            }
      }
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 translate-x-2 translate-y-2 rounded-2xl"
        style={{ background: C.decal, border: '1px solid rgba(255,255,255,0.12)' }}
      />
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{ background: C.card, border: '1px solid rgba(255,255,255,0.16)' }}
      >
        {children}
      </div>
    </motion.div>
  );
}

/* Le petit en-tête de carte : un titre et un sous-titre, comme un écran du
   portail. */
function CardHead({ title, sub, accent }: { title: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-4 pb-3"
      style={{ borderBottom: `1px solid ${C.border}` }}
    >
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold" style={{ color: C.text }}>{title}</p>
        {sub ? <p className="truncate text-[11px]" style={{ color: C.ter }}>{sub}</p> : null}
      </div>
      {accent ? (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ background: brandWashSoft, color: C.brandHi, border: `1px solid ${C.borderHi}` }}
        >
          <span className="h-1 w-1 rounded-full" style={{ background: C.brand }} aria-hidden="true" />
          Live
        </span>
      ) : null}
    </div>
  );
}

/* ── 01 · Rendez-vous ─────────────────────────────────────────────────────
   La grille du mois du calendrier des rendez-vous (ClientBookings), avec le
   contenu des jours : heure et nom, deux par case. */
const SAMPLE_DAYS: Record<number, { time: string; name: string }[]> = {
  6: [
    { time: '09:30', name: 'Dupont' },
    { time: '14:00', name: 'Lefèvre' },
  ],
  11: [{ time: '11:15', name: 'Martin' }],
  17: [{ time: '16:30', name: 'Bernard' }],
  23: [{ time: '10:00', name: 'Petit' }],
};

function AgendaCard({ isFr }: { isFr: boolean }) {
  const month = new Date();
  const cells = monthGrid(month);
  const today = isoDay(new Date());
  return (
    <Card>
      <CardHead
        title={isFr ? 'Rendez-vous' : 'Bookings'}
        sub={monthLabel(month)}
      />
      <div className="p-4 sm:p-5">
        <div className="mb-2 grid grid-cols-7 gap-1.5">
          {WEEKDAYS_FR.map((d) => (
            <div key={d} className="text-center text-[10px] uppercase tracking-wider" style={{ color: C.ter }}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5" role="grid">
          {cells.map((cell) => {
            const dayBookings = cell.inMonth ? (SAMPLE_DAYS[cell.day] ?? []) : [];
            const isToday = cell.iso === today;
            return (
              <div
                key={cell.iso}
                role="gridcell"
                className="flex min-h-[54px] flex-col rounded-lg p-1"
                style={{
                  background: cell.inMonth ? C.washCell : C.washDim,
                  boxShadow: isToday ? `0 0 0 1px ${t.borderFocus}` : undefined,
                }}
              >
                <span
                  className="px-0.5 text-[11px] tabular-nums"
                  style={{
                    color: isToday ? C.brandHi : cell.inMonth ? C.text : C.muted,
                    fontWeight: isToday ? 600 : 400,
                  }}
                >
                  {cell.day}
                </span>
                {dayBookings.slice(0, 2).map((b) => (
                  <span
                    key={b.time + b.name}
                    className="mt-0.5 flex items-baseline gap-1 rounded px-1 py-[2px] text-[9.5px] leading-tight"
                    style={{ background: brandWash }}
                  >
                    <span className="shrink-0 font-semibold tabular-nums" style={{ color: C.brandHi }}>{b.time}</span>
                    <span className="truncate" style={{ color: C.text }}>{b.name}</span>
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/* ── 02 · SMS de brief ────────────────────────────────────────────────────
   La fiche d'appel que le gérant reçoit : qui appelle, le résumé, le
   sentiment et le rendez-vous pris. */
function BriefCard({ isFr }: { isFr: boolean }) {
  return (
    <Card>
      <CardHead title={isFr ? 'Fiche d’appel' : 'Call record'} sub={isFr ? 'Il y a 2 min' : '2 min ago'} />
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: brandWashSoft }}>
            <Phone size={15} style={{ color: C.brandHi }} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium" style={{ color: C.text }}>Mme Lefèvre</p>
            <p className="text-[11px]" style={{ color: C.sec }}>06 12 45 78 90</p>
          </div>
          <SentimentBadge sentiment="positive" />
        </div>

        <div className="rounded-xl p-3" style={{ background: C.well, border: `1px solid ${C.border}` }}>
          <p className="mb-1 text-[10px] uppercase tracking-wider" style={{ color: C.ter }}>
            {isFr ? 'Résumé IA' : 'AI summary'}
          </p>
          <p className="text-[12.5px] leading-relaxed" style={{ color: C.text }}>
            {isFr
              ? 'Demande un détartrage pour la semaine prochaine. Rendez-vous pris jeudi à 15 h, confirmation SMS envoyée.'
              : 'Asks for a cleaning next week. Booked Thursday at 3 pm, SMS confirmation sent.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: C.washCell, border: `1px solid ${C.border}` }}>
          <Calendar size={14} style={{ color: C.brandHi }} aria-hidden="true" />
          <span className="text-[12px]" style={{ color: C.sec }}>
            {isFr ? 'Jeudi 15 h — Détartrage' : 'Thu 3 pm — Cleaning'}
          </span>
          <CheckCircle2 size={13} className="ml-auto" style={{ color: C.ok }} aria-hidden="true" />
        </div>
      </div>
    </Card>
  );
}

/* ── 03 · Habitués ────────────────────────────────────────────────────────
   La liste des leads reconnus (ClientLeads) : nom, numéro, dernier contact,
   score. */
const LEADS = [
  { name: 'Sophie Lambert', phone: '06 12 45 78 90', last: 'Hier', score: 9, lead: true },
  { name: 'Marc Dubois', phone: '06 98 32 11 04', last: 'Il y a 3 j', score: 7, lead: false },
  { name: 'Julie Moreau', phone: '06 45 21 09 88', last: 'Il y a 1 sem.', score: 6, lead: false },
];

function RegularsCard({ isFr }: { isFr: boolean }) {
  return (
    <Card>
      <CardHead title={isFr ? 'Leads' : 'Leads'} sub={isFr ? 'Habitués reconnus' : 'Recognised regulars'} />
      <ul>
        {LEADS.map((l) => (
          <li
            key={l.name}
            className="flex items-center gap-3 px-4 py-3 sm:px-5"
            style={{ borderBottom: `1px solid ${C.border}` }}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold"
              style={{ background: 'rgba(255,193,7,0.10)', color: C.warn }}
            >
              {l.name.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[13px] font-medium" style={{ color: C.text }}>
                <span className="truncate">{l.name}</span>
                {l.lead ? (
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                    style={{ background: 'rgba(255,193,7,0.10)', color: C.warn }}
                  >
                    LEAD
                  </span>
                ) : null}
              </p>
              <p className="text-[11px]" style={{ color: C.sec }}>
                {l.phone} · {l.last}
              </p>
            </div>
            <span className="shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: C.brandHi }}>
              {l.score}/10
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ── 04 · Conversation ────────────────────────────────────────────────────
   Le transcript de l'appel (ClientCalls), relu par parseTranscript : le
   locuteur en tête de réplique, pas une bulle. */
const SAMPLE_TRANSCRIPT = [
  'AI: Bonjour, Clinique Dentaire Léopold, je vous écoute.',
  'User: Bonjour, je voudrais prendre rendez-vous pour un détartrage.',
  'AI: Avec plaisir. Je regarde les disponibilités du Dr Mercier… Jeudi à 15 h, ça vous convient ?',
  'User: Parfait, je prends.',
  'AI: Très bien, c’est réservé. Vous recevrez un SMS de confirmation.',
];

function TranscriptCard({ isFr }: { isFr: boolean }) {
  const lines = parseTranscript(SAMPLE_TRANSCRIPT.join('\n'));
  return (
    <Card>
      <CardHead title={isFr ? 'Transcript' : 'Transcript'} sub={isFr ? 'Appel en cours' : 'Live call'} accent />
      <div className="p-4 sm:p-5">
        <div className="space-y-2.5 rounded-xl p-4" style={{ background: C.well, border: `1px solid ${C.border}` }}>
          {lines.map((line, i) => (
            <p key={i} className="text-[12.5px] leading-relaxed">
              {line.who && (
                <span
                  className="mr-1.5 text-[10.5px] font-semibold uppercase tracking-wide"
                  style={{ color: line.who === 'agent' ? C.brandHi : C.sec }}
                >
                  {line.who === 'agent' ? 'IA' : 'Appelant'}
                </span>
              )}
              <span style={{ color: C.text }}>{line.text}</span>
            </p>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ── 05 · Deux mémoires ───────────────────────────────────────────────────
   La base de connaissances du réceptionniste : services, tarifs, horaires. */
const KNOWLEDGE = [
  { title: 'Tarifs', value: 'Détartrage 70 € · Consultation 45 €' },
  { title: 'Horaires', value: 'Lun–Ven 9 h–18 h · Sam 9 h–12 h' },
  { title: 'Urgences', value: 'Hors horaires, renvoi vers le 15' },
  { title: 'Paiement', value: 'Carte ou virement, pas de chèque' },
];

function KnowledgeCard({ isFr }: { isFr: boolean }) {
  return (
    <Card>
      <CardHead title={isFr ? 'Base de connaissances' : 'Knowledge base'} sub={isFr ? '128 entrées' : '128 entries'} />
      <ul>
        {KNOWLEDGE.map((k) => (
          <li
            key={k.title}
            className="flex items-baseline gap-3 px-4 py-3 sm:px-5"
            style={{ borderBottom: `1px solid ${C.border}` }}
          >
            <span className="shrink-0 text-[11px] font-medium" style={{ color: C.brandHi }}>{k.title}</span>
            <span className="min-w-0 text-[12.5px]" style={{ color: C.text }}>{k.value}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ── 06 · Ce qui ne bouge pas ─────────────────────────────────────────────
   Le forfait (ClientBilling) : le prix, l'engagement, ce qui est inclus. */
function GuaranteeCard({ isFr }: { isFr: boolean }) {
  const rows = isFr
    ? [
        'Enregistrement annoncé au décrochage, conforme RGPD',
        'Données jamais vendues, jamais utilisées pour entraîner un modèle sans accord',
        'Appels spam écartés, non décomptés',
        '24/7, français et anglais sur le même appel',
      ]
    : [
        'Recording announced at pickup, GDPR compliant',
        'Data never sold, never used to train a model without consent',
        'Spam calls filtered out, not counted',
        '24/7, French and English on the same call',
      ];
  return (
    <Card>
      <CardHead title={isFr ? 'Facturation' : 'Billing'} sub={isFr ? 'Forfait mensuel' : 'Monthly plan'} />
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-baseline gap-2">
          <span className="text-[26px] font-semibold tabular-nums" style={{ color: C.text }}>
            {isFr ? '99 €' : '€99'}
          </span>
          <span className="text-[12px]" style={{ color: C.sec }}>/ {isFr ? 'mois' : 'month'}</span>
          <span
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ background: 'rgba(120,220,120,0.10)', color: C.ok, border: `1px solid ${C.border}` }}
          >
            <Clock size={11} aria-hidden="true" />
            {isFr ? 'Sans engagement' : 'No commitment'}
          </span>
        </div>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r} className="flex items-start gap-2 text-[12.5px] leading-relaxed" style={{ color: C.text }}>
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: C.ok }} aria-hidden="true" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

/* Le dispatcher : `num` est la clé de carte ('01'…'06'), `isFr` la langue. */
export default function ReceptionistCard({ num, isFr }: { num: string; isFr: boolean }) {
  switch (num) {
    case '02':
      return <BriefCard isFr={isFr} />;
    case '03':
      return <RegularsCard isFr={isFr} />;
    case '04':
      return <TranscriptCard isFr={isFr} />;
    case '05':
      return <KnowledgeCard isFr={isFr} />;
    case '06':
      return <GuaranteeCard isFr={isFr} />;
    case '01':
    default:
      return <AgendaCard isFr={isFr} />;
  }
}
