import { WEEKDAYS_FR, monthGrid, monthLabel, isoDay } from '../../utils/month-grid';
import { parseTranscript } from '../../utils/transcript';
import SentimentBadge from '../client-dashboard/SentimentBadge';
import { Phone, Clock, Calendar, CheckCircle2 } from '../../components/icons';

/* Les illustrations des six cartes de la page Réceptionniste.

   Ce ne sont PAS des captures d'écran (retour utilisateur : « des simples
   screens rognés c'est moche, va chercher des vrais composants ») : ce sont les
   VRAIS composants du portail, rendus tels quels — même grille de calendrier
   (utils/month-grid), même relecture de transcript (utils/transcript), même
   pastille de sentiment (SentimentBadge), mêmes tokens sombres du dashboard.
   Seule différence : les données sont posées en dur au lieu d'être servies par
   l'API, puisque c'est une page de démonstration, pas le portail branché.

   Chaque carte est un panneau sombre fidèle au dashboard (fond #0E0F11, accent
   #7349fe), posé sur la page. Le registre sombre ne bascule pas avec le thème :
   c'est l'écran du produit, il reste sombre en clair comme en sombre. */

/* Le cadre commun : la surface sombre du portail, ses coins, son filet discret
   et une ombre qui la décolle de la page. */
const FRAME =
  'rounded-2xl border border-white/10 bg-[#0E0F11] overflow-hidden shadow-[0_24px_60px_-24px_rgba(17,17,23,0.5)]';

/* Le petit en-tête de carte : un titre et un sous-titre, comme un écran du
   portail. */
function CardHead({ title, sub, accent }: { title: string; sub?: string; accent?: boolean }) {
  return (
    <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-white/[0.06] flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[#F5F5F7] truncate">{title}</p>
        {sub ? <p className="text-[11px] text-white/40 truncate">{sub}</p> : null}
      </div>
      {accent ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#7349fe]/30 bg-[#7349fe]/10 px-2 py-0.5 text-[10px] font-medium text-[#A78BFA]">
          <span className="h-1 w-1 rounded-full bg-[#7349fe]" aria-hidden="true" />
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
    <div className={FRAME}>
      <CardHead
        title={isFr ? 'Rendez-vous' : 'Bookings'}
        sub={monthLabel(month)}
      />
      <div className="p-4 sm:p-5">
        <div className="mb-2 grid grid-cols-7 gap-1.5">
          {WEEKDAYS_FR.map((d) => (
            <div key={d} className="text-center text-[10px] uppercase tracking-wider text-white/40">
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
                className={`flex min-h-[54px] flex-col rounded-lg p-1 ${
                  cell.inMonth ? 'bg-white/[0.04]' : 'bg-white/[0.015]'
                } ${isToday ? 'ring-1 ring-[#7349fe]/50' : ''}`}
              >
                <span
                  className={`px-0.5 text-[11px] tabular-nums ${
                    isToday ? 'font-semibold text-[#A78BFA]' : cell.inMonth ? 'text-white/80' : 'text-white/25'
                  }`}
                >
                  {cell.day}
                </span>
                {dayBookings.slice(0, 2).map((b) => (
                  <span
                    key={b.time + b.name}
                    className="mt-0.5 flex items-baseline gap-1 rounded bg-[#7349fe]/[0.16] px-1 py-[2px] text-[9.5px] leading-tight"
                  >
                    <span className="shrink-0 font-semibold tabular-nums text-[#b9a6ff]">{b.time}</span>
                    <span className="truncate text-white/85">{b.name}</span>
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── 02 · SMS de brief ────────────────────────────────────────────────────
   La fiche d'appel que le gérant reçoit : qui appelle, le résumé, le
   sentiment et le rendez-vous pris. */
function BriefCard({ isFr }: { isFr: boolean }) {
  return (
    <div className={FRAME}>
      <CardHead title={isFr ? 'Fiche d’appel' : 'Call record'} sub={isFr ? 'Il y a 2 min' : '2 min ago'} />
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#7349fe]/10">
            <Phone size={15} className="text-[#A78BFA]" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-[#F5F5F7] truncate">Mme Lefèvre</p>
            <p className="text-[11px] text-white/45">06 12 45 78 90</p>
          </div>
          <SentimentBadge sentiment="positive" />
        </div>

        <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-white/40">
            {isFr ? 'Résumé IA' : 'AI summary'}
          </p>
          <p className="text-[12.5px] leading-relaxed text-[#F5F5F7]">
            {isFr
              ? 'Demande un détartrage pour la semaine prochaine. Rendez-vous pris jeudi à 15 h, confirmation SMS envoyée.'
              : 'Asks for a cleaning next week. Booked Thursday at 3 pm, SMS confirmation sent.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] px-3 py-2.5">
          <Calendar size={14} className="text-[#A78BFA]" aria-hidden="true" />
          <span className="text-[12px] text-white/70">
            {isFr ? 'Jeudi 15 h — Détartrage' : 'Thu 3 pm — Cleaning'}
          </span>
          <CheckCircle2 size={13} className="ml-auto text-emerald-400" aria-hidden="true" />
        </div>
      </div>
    </div>
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
    <div className={FRAME}>
      <CardHead title={isFr ? 'Leads' : 'Leads'} sub={isFr ? 'Habitués reconnus' : 'Recognised regulars'} />
      <ul className="divide-y divide-white/[0.05]">
        {LEADS.map((l) => (
          <li key={l.name} className="flex items-center gap-3 px-4 sm:px-5 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-[12px] font-semibold text-amber-400">
              {l.name.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[13px] font-medium text-[#F5F5F7]">
                <span className="truncate">{l.name}</span>
                {l.lead ? (
                  <span className="shrink-0 rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
                    LEAD
                  </span>
                ) : null}
              </p>
              <p className="text-[11px] text-white/45">
                {l.phone} · {l.last}
              </p>
            </div>
            <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[#A78BFA]">
              {l.score}/10
            </span>
          </li>
        ))}
      </ul>
    </div>
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
    <div className={FRAME}>
      <CardHead title={isFr ? 'Transcript' : 'Transcript'} sub={isFr ? 'Appel en cours' : 'Live call'} accent />
      <div className="p-4 sm:p-5">
        <div className="space-y-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] p-4">
          {lines.map((line, i) => (
            <p key={i} className="text-[12.5px] leading-relaxed">
              {line.who && (
                <span
                  className={`mr-1.5 text-[10.5px] font-semibold uppercase tracking-wide ${
                    line.who === 'agent' ? 'text-[#A78BFA]' : 'text-[#A1A1A8]'
                  }`}
                >
                  {line.who === 'agent' ? 'IA' : 'Appelant'}
                </span>
              )}
              <span className="text-[#F5F5F7]">{line.text}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
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
    <div className={FRAME}>
      <CardHead title={isFr ? 'Base de connaissances' : 'Knowledge base'} sub={isFr ? '128 entrées' : '128 entries'} />
      <ul className="divide-y divide-white/[0.05]">
        {KNOWLEDGE.map((k) => (
          <li key={k.title} className="flex items-baseline gap-3 px-4 sm:px-5 py-3">
            <span className="shrink-0 text-[11px] font-medium text-[#A78BFA]">{k.title}</span>
            <span className="min-w-0 text-[12.5px] text-[#F5F5F7]">{k.value}</span>
          </li>
        ))}
      </ul>
    </div>
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
    <div className={FRAME}>
      <CardHead title={isFr ? 'Facturation' : 'Billing'} sub={isFr ? 'Forfait mensuel' : 'Monthly plan'} />
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-[26px] font-semibold tabular-nums text-[#F5F5F7]">
            {isFr ? '99 €' : '€99'}
          </span>
          <span className="text-[12px] text-white/45">/ {isFr ? 'mois' : 'month'}</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
            <Clock size={11} aria-hidden="true" />
            {isFr ? 'Sans engagement' : 'No commitment'}
          </span>
        </div>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-[#F5F5F7]">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" aria-hidden="true" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
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
