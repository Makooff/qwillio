import type { CSSProperties, ReactNode } from 'react';
import {
  Building2,
  Calendar,
  CalendarCheck,
  Check,
  Clock,
  FileText,
  Lightbulb,
  MessageSquare,
  Mic,
  PhoneForwarded,
  Send,
  Smartphone,
  UserVoice,
  Users,
} from '../icons';
import './product-illustration.css';

export type ProductIllustrationKind =
  | 'overview'
  | 'booking'
  | 'transfer'
  | 'intake'
  | 'returning'
  | 'knowledge'
  | 'setup'
  | 'conversation'
  | 'summary'
  | 'insight';

export interface ProductIllustrationProps {
  kind: ProductIllustrationKind;
  isFr: boolean;
  compact?: boolean;
}

const KINDS: ProductIllustrationKind[] = [
  'overview',
  'booking',
  'transfer',
  'intake',
  'returning',
  'knowledge',
  'setup',
  'conversation',
  'summary',
  'insight',
];

function rise(i: number): CSSProperties {
  return { ['--i' as string]: i };
}

/* Chaque dessin est un diagramme STATIQUE: aucun bouton, aucun
   champ de formulaire réel — uniquement des <span>. Le dessin est
   aria-hidden; c'est le <figure> qui porte le libellé accessible. */

function Overview({ isFr }: { isFr: boolean }) {
  const t = {
    phone: isFr ? 'Appel entrant' : 'Incoming call',
    caller: isFr ? '« Table pour 2, ce soir ? »' : '“Table for 2 tonight?”',
    booking: isFr ? 'Réservation proposée' : 'Proposed booking',
    date: isFr ? 'Ce soir · 19:30' : 'Tonight · 7:30 pm',
    slots: isFr ? ['19:00', '19:30', '20:00'] : ['7:00', '7:30', '8:00'],
  };
  return (
    <span className="pi-overview">
      <span className="pi__card pi-overview__phone pi__rise" style={rise(0)}>
        <span className="pi__chip">
          <Smartphone />
          {t.phone}
        </span>
        <span className="pi__text">{t.caller}</span>
        <span className="pi-overview__wave" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </span>
      <span className="pi__link pi-overview__link" aria-hidden="true" />
      <span className="pi__tile pi-overview__tile pi__rise" style={rise(1)}>
        <UserVoice />
      </span>
      <span className="pi__card pi-overview__booking pi__rise" style={rise(2)}>
        <span className="pi__chip">
          <CalendarCheck />
          {t.booking}
        </span>
        <span className="pi__title">{t.date}</span>
        <span className="pi-overview__row">
          {t.slots.map((s, i) => (
            <span
              key={s}
              className={
                i === 1
                  ? 'pi-overview__slot pi-overview__slot--pick'
                  : 'pi-overview__slot'
              }
            >
              {s}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

function Booking({ isFr }: { isFr: boolean }) {
  const t = {
    title: isFr ? 'Choix de l’horaire' : 'Pick a time slot',
    hours: isFr
      ? ['12:00', '12:30', '13:00', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30']
      : ['12:00', '12:30', '1:00', '7:00', '7:30', '8:00', '8:30', '9:00', '9:30'],
    cond: isFr ? 'Agenda connecté requis' : 'Connected calendar required',
    condText: isFr
      ? 'Les créneaux libres ne sont proposés que si votre agenda est relié.'
      : 'Free slots are only offered once your calendar is connected.',
    confirm: isFr ? 'Créneau confirmé au client' : 'Slot confirmed to the caller',
    ok: isFr ? 'Confirmé' : 'Confirmed',
  };
  const off = [1, 6, 8];
  return (
    <span className="pi-booking">
      <span className="pi__card pi-booking__macro pi__rise" style={rise(0)}>
        <span className="pi__chip">
          <Clock />
          {t.title}
        </span>
        <span className="pi-booking__hours">
          {t.hours.map((h, i) => (
            <span
              key={h}
              className={
                i === 4
                  ? 'pi-booking__hour pi-booking__hour--sel'
                  : off.includes(i)
                    ? 'pi-booking__hour pi-booking__hour--off'
                    : 'pi-booking__hour'
              }
            >
              {h}
            </span>
          ))}
        </span>
      </span>
      <span className="pi-booking__cond pi__rise" style={rise(1)}>
        <span className="pi-booking__condcard">
          <span className="pi__chip">
            <Calendar />
            {t.cond}
          </span>
          <span className="pi__text">{t.condText}</span>
        </span>
        <span className="pi__card pi-booking__confirm">
          <span className="pi__title">{t.confirm}</span>
          <span className="pi__ok">
            <Check />
            {t.ok}
          </span>
        </span>
      </span>
    </span>
  );
}

function Transfer({ isFr }: { isFr: boolean }) {
  const t = {
    from: isFr ? 'Qwillio' : 'Qwillio',
    fromSub: isFr ? 'Réceptionne l’appel' : 'Answers the call',
    brief: isFr ? 'Brief de la demande' : 'Request brief',
    name: isFr ? 'Nom de l’appelant' : 'Caller name',
    need: isFr ? 'Objet de la demande' : 'What they need',
    when: isFr ? 'Moment souhaité' : 'Preferred time',
    to: isFr ? 'Votre équipe' : 'Your team',
    toSub: isFr ? 'Reprend la main' : 'Takes over',
  };
  return (
    <span className="pi-transfer">
      <span className="pi__card pi-transfer__col pi-transfer__col--a pi__rise" style={rise(0)}>
        <span className="pi-transfer__icon">
          <Mic />
        </span>
        <span className="pi__title">{t.from}</span>
        <span className="pi__text">{t.fromSub}</span>
      </span>
      <span className="pi__link pi-transfer__link1" aria-hidden="true" />
      <span className="pi__tile pi-transfer__tile1 pi__rise" style={rise(1)}>
        <PhoneForwarded />
      </span>
      <span className="pi__card pi-transfer__brief pi__rise" style={rise(2)}>
        <span className="pi__chip">
          <FileText />
          {t.brief}
        </span>
        <span>
          <span className="pi__field-label">{t.name}</span>
          <span className="pi__field">{isFr ? 'Client au téléphone' : 'Caller on the line'}</span>
        </span>
        <span>
          <span className="pi__field-label">{t.need}</span>
          <span className="pi__field">{isFr ? 'Événement privé' : 'Private event'}</span>
        </span>
        <span>
          <span className="pi__field-label">{t.when}</span>
          <span className="pi__field">{isFr ? 'Vendredi soir' : 'Friday evening'}</span>
        </span>
      </span>
      <span className="pi__link pi-transfer__link2" aria-hidden="true" />
      <span className="pi__tile pi-transfer__tile2 pi__rise" style={rise(3)}>
        <Users />
      </span>
      <span className="pi__card pi-transfer__col pi-transfer__col--c pi__rise" style={rise(4)}>
        <span className="pi-transfer__icon">
          <UserVoice />
        </span>
        <span className="pi__title">{t.to}</span>
        <span className="pi__text">{t.toSub}</span>
      </span>
    </span>
  );
}

function Intake({ isFr }: { isFr: boolean }) {
  const t = {
    title: isFr ? 'Votre établissement' : 'Your establishment',
    sub: isFr ? 'Informations partagées aux appelants' : 'Details shared with callers',
    name: isFr ? 'Nom affiché' : 'Displayed name',
    hours: isFr ? 'Horaires d’ouverture' : 'Opening hours',
    hoursVal: isFr ? 'Mar–Dim · 12:00–14:30 · 19:00–22:30' : 'Tue–Sun · 12–2:30 pm · 7–10:30 pm',
    addr: isFr ? 'Adresse' : 'Address',
    addrVal: isFr ? 'Votre adresse' : 'Your address',
    notes: isFr ? 'Instructions particulières' : 'Special instructions',
    notesVal: isFr
      ? 'Terrasse accessible · chiens acceptés'
      : 'Patio accessible · dogs welcome',
  };
  return (
    <span className="pi-intake">
      <span className="pi__card pi-intake__card pi__rise" style={rise(0)}>
        <span className="pi-intake__head">
          <span className="pi-intake__mark">
            <Building2 />
          </span>
          <span>
            <span className="pi__title">{t.title}</span>
            <span className="pi__text pi__text--small" style={{ display: 'block' }}>
              {t.sub}
            </span>
          </span>
        </span>
        <span className="pi-intake__grid">
          <span>
            <span className="pi__field-label">{t.name}</span>
            <span className="pi__field pi__field--active">{t.title}</span>
          </span>
          <span>
            <span className="pi__field-label">{t.addr}</span>
            <span className="pi__field">{t.addrVal}</span>
          </span>
          <span className="pi-intake__full">
            <span className="pi__field-label">{t.hours}</span>
            <span className="pi__field">{t.hoursVal}</span>
          </span>
          <span className="pi-intake__full">
            <span className="pi__field-label">{t.notes}</span>
            <span className="pi__field">{t.notesVal}</span>
          </span>
        </span>
      </span>
    </span>
  );
}

function Setup({ isFr }: { isFr: boolean }) {
  return <span className="pi-setup pi-configuration">
    <span className="pi__card pi__rise" style={rise(0)}><span className="pi__chip"><MessageSquare />{isFr ? 'Votre consigne' : 'Your instruction'}</span><span className="pi__text">{isFr ? '« Le samedi, nous ouvrons de 9 h à 13 h. »' : '“On Saturdays, we open from 9 am to 1 pm.”'}</span></span>
    <span className="pi__card pi__rise" style={rise(1)}><span className="pi__chip"><Clock />{isFr ? 'Horaires du samedi' : 'Saturday hours'}</span><span className="pi__title">09:00 — 13:00</span><span className="pi__ok"><Check />{isFr ? 'Consigne appliquée et relue' : 'Instruction applied and read back'}</span></span>
  </span>;
}

function Knowledge({ isFr }: { isFr: boolean }) {
  return <span className="pi-knowledge">
    <span className="pi__card pi__rise" style={rise(0)}>
      <span className="pi__chip"><FileText />{isFr ? 'Base de connaissances' : 'Knowledge base'}</span>
      <span className="pi__text pi__text--small">{isFr ? 'Horaires · Services · Règles d’accueil' : 'Hours · Services · House rules'}</span>
      <span className="pi__field pi__field--active"><span className="pi__chip">FAQ</span><span className="pi__title">{isFr ? 'Les chiens sont-ils acceptés ?' : 'Are dogs allowed?'}</span><span className="pi__text">{isFr ? 'Oui, uniquement sur la terrasse.' : 'Yes, on the patio only.'}</span></span>
    </span>
    <span className="pi__card pi-knowledge__answer pi__rise" style={rise(1)}>
      <span className="pi__chip"><Mic />Qwillio</span><span className="pi__text">{isFr ? '« Votre chien est le bienvenu sur la terrasse. »' : '“Your dog is welcome on the patio.”'}</span><span className="pi__ok"><Check />{isFr ? 'Réponse fondée sur votre FAQ' : 'Answer based on your FAQ'}</span>
    </span>
  </span>;
}

function ReturningCaller({ isFr }: { isFr: boolean }) {
  return <span className="pi-intake pi-returning">
    <span className="pi__card pi__rise" style={rise(0)}>
      <span className="pi__chip"><UserVoice />{isFr ? 'Client déjà connu' : 'Returning caller'}</span>
      <span className="pi__title">Camille</span>
      <span className="pi__text"><Check /> {isFr ? 'Résumé du dernier appel disponible' : 'Previous call summary available'}</span>
      <span className="pi__text"><CalendarCheck /> {isFr ? 'Rendez-vous à venir retrouvé' : 'Upcoming appointment on hand'}</span>
    </span>
    <span className="pi__card pi__rise" style={rise(1)}>
      <span className="pi__chip"><Mic />Qwillio</span>
      <span className="pi__text">{isFr ? '« Bonjour Camille, je vous écoute. »' : '“Hello Camille, how can I help?”'}</span>
    </span>
  </span>;
}

function Conversation({ isFr }: { isFr: boolean }) {
  const t = {
    caller: isFr ? 'Appelant' : 'Caller',
    callerMsg: isFr
      ? '« Pardon, je voulais dire vendredi… »'
      : '“Sorry, I meant Friday…”',
    qwillio: isFr ? 'Qwillio' : 'Qwillio',
    reply: isFr
      ? '« Bien sûr, allez-y. »'
      : '“Of course, go ahead.”',
    live: isFr ? 'Elle vous laisse la parole' : 'She gives you room to speak',
  };
  return (
    <span className="pi-conv">
      <span className="pi-conv__bubble pi-conv__bubble--caller pi__rise" style={rise(0)}>
        <span className="pi-conv__who">
          <UserVoice />
          {t.caller}
        </span>
        {t.callerMsg}
      </span>
      <span className="pi-conv__bubble pi-conv__bubble--qwillio pi__rise" style={rise(1)}>
        <span className="pi-conv__who pi-conv__who--deep">
          <Mic />
          {t.qwillio}
        </span>
        {t.reply}
      </span>
      <span className="pi-conv__wavecard pi__rise" style={rise(2)}>
        <span className="pi-conv__who pi-conv__who--deep" style={{ margin: 0 }}>
          <MessageSquare />
        </span>
        <span className="pi-conv__wave" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => (
            <i key={i} />
          ))}
        </span>
        <span className="pi__text pi__text--small">{t.live}</span>
      </span>
    </span>
  );
}

function Summary({ isFr }: { isFr: boolean }) {
  const t = {
    title: isFr ? 'Note de fin d’appel' : 'End-of-call note',
    duration: isFr ? 'Durée' : 'Duration',
    durationVal: isFr ? '2 min 10' : '2 min 10 s',
    contact: isFr ? 'Contact' : 'Contact',
    contactPh: isFr ? 'nom + numéro' : 'name + number',
    lines: isFr
      ? ['Demande : table pour 2, ce soir.', 'Créneau proposé : 19 h 30.']
      : ['Request: table for 2, tonight.', 'Slot offered: 7:30 pm.'],
    ph: isFr ? 'coordonnées de rappel…' : 'callback details…',
  };
  return (
    <span className="pi-summary">
      <span className="pi__card pi-summary__card pi__rise" style={rise(0)}>
        <span className="pi__chip">
          <FileText />
          {t.title}
        </span>
        <span className="pi-summary__meta">
          <span className="pi-summary__pill">
            <Clock />
            {t.duration} · {t.durationVal}
          </span>
          <span className="pi-summary__pill">
            <UserVoice />
            {t.contact} · <span className="pi-summary__ph">{t.contactPh}</span>
          </span>
        </span>
        <span className="pi-summary__lines">
          {t.lines.map((l) => (
            <span key={l} className="pi__text">
              {l}
            </span>
          ))}
          <span className="pi__text pi-summary__ph">{t.ph}</span>
        </span>
      </span>
    </span>
  );
}

function Insight({ isFr }: { isFr: boolean }) {
  const t = {
    found: isFr ? 'Question identifiée' : 'Spotted question',
    quote: isFr
      ? '« Vous ouvrez le dimanche soir ? »'
      : '“Are you open on Sunday evenings?”',
    ctx: isFr
      ? 'Une question récurrente, absente de vos instructions.'
      : 'A recurring question not covered by your instructions.',
    suggest: isFr ? 'Instruction suggérée' : 'Suggested instruction',
    suggestVal: isFr
      ? '« Le dimanche, service uniquement le midi. »'
      : '“On Sundays, lunch service only.”',
  };
  return (
    <span className="pi-insight">
      <span className="pi__card pi__card--cream pi-insight__q pi__rise" style={rise(0)}>
        <span className="pi__chip">
          <Lightbulb />
          {t.found}
        </span>
        <span className="pi-insight__quote">{t.quote}</span>
        <span className="pi__text pi__text--small">{t.ctx}</span>
      </span>
      <span className="pi__link pi-insight__link" aria-hidden="true" />
      <span className="pi__card pi-insight__a pi__rise" style={rise(1)}>
        <span className="pi__chip">
          <Send />
          {t.suggest}
        </span>
        <span className="pi-insight__suggest">{t.suggestVal}</span>
      </span>
    </span>
  );
}

const DRAWINGS: Record<ProductIllustrationKind, (p: { isFr: boolean }) => ReactNode> = {
  overview: Overview,
  booking: Booking,
  transfer: Transfer,
  intake: Intake,
  returning: ReturningCaller,
  knowledge: Knowledge,
  setup: Setup,
  conversation: Conversation,
  summary: Summary,
  insight: Insight,
};

const LABELS: Record<ProductIllustrationKind, { fr: string; en: string }> = {
  overview: {
    fr: 'Illustration du fonctionnement : de l’appel entrant à la réservation proposée',
    en: 'How it works illustration: from the incoming call to the proposed booking',
  },
  booking: {
    fr: 'Illustration du fonctionnement : sélection d’un horaire selon l’agenda connecté',
    en: 'How it works illustration: picking a slot based on the connected calendar',
  },
  transfer: {
    fr: 'Illustration du fonctionnement : Qwillio transmet un brief à votre équipe',
    en: 'How it works illustration: Qwillio hands a brief to your team',
  },
  intake: {
    fr: 'Illustration du fonctionnement : la fiche de votre établissement renseignée',
    en: 'How it works illustration: your establishment profile filled in',
  },
  knowledge: {
    fr: 'Illustration du fonctionnement : FAQ et base de connaissances utilisées pour répondre',
    en: 'How it works illustration: answering from your FAQs and knowledge base',
  },
  returning: {
    fr: 'Illustration du fonctionnement : un client habituel reconnu et son contexte retrouvé',
    en: 'How it works illustration: a returning caller recognised with their context',
  },
  setup: {
    fr: 'Illustration du fonctionnement : une consigne dans le chat met à jour les horaires',
    en: 'How it works illustration: a chat instruction updates opening hours',
  },
  conversation: {
    fr: 'Illustration du fonctionnement : la conversation entre l’appelant et Qwillio',
    en: 'How it works illustration: the conversation between caller and Qwillio',
  },
  summary: {
    fr: 'Illustration du fonctionnement : la note de fin d’appel',
    en: 'How it works illustration: the end-of-call note',
  },
  insight: {
    fr: 'Illustration du fonctionnement : une question identifiée devient une instruction',
    en: 'How it works illustration: a spotted question becomes an instruction',
  },
};

export { KINDS as PRODUCT_ILLUSTRATION_KINDS };

export default function ProductIllustration({
  kind,
  isFr,
  compact = false,
}: ProductIllustrationProps) {
  const Draw = DRAWINGS[kind];
  const label = isFr ? LABELS[kind].fr : LABELS[kind].en;
  const caption = isFr
    ? 'Illustration du fonctionnement'
    : 'How it works illustration';
  return (
    <figure
      className={compact ? 'pi pi--compact' : 'pi'}
      data-kind={kind}
      role="img"
      aria-label={label}
    >
      <span className="pi__frame">
        <span className="pi__draw" aria-hidden="true">
          <Draw isFr={isFr} />
        </span>
      </span>
      <figcaption className="pi__caption q2-body-text">{caption}</figcaption>
    </figure>
  );
}
