// Public comparisons: primary-source observations, not competitor guarantees.
import { PLAN_MONTHLY_EUR, PLAN_MINUTES } from '../pages/v2/pricing-plans';
export type ComparisonBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][]; caption?: string }
  | { type: 'verdict'; tone: 'good' | 'bad' | 'neutral'; title: string; text: string };
export interface Localized { en: string; fr: string; }
export interface ComparisonPage {
  slug: string; competitor: string; title: Localized; subtitle: Localized;
  updated: string; sources: { label: string; url: string }[];
  content: { en: ComparisonBlock[]; fr: ComparisonBlock[] };
}
interface ComparisonEvidence {
  slug: string; competitor: string; source: string;
  intro: Localized; question: Localized; fit: Localized;
  rows: { fr: string[][]; en: string[][] };
}

const SUBTITLES: Record<string, Localized> = {
  "sylen": {
    "fr": "Minutes incluses, agenda et suivi : comparez le coût de votre usage.",
    "en": "Included minutes, scheduling and follow-up: compare your actual usage cost."
  },
  "nerolia": {
    "fr": "Automatisation sur mesure ou accueil à abonnement : deux approches à comparer.",
    "en": "Custom automation or subscription answering: two different approaches."
  },
  "smith-ai": {
    "fr": "Réseau d’agents humains ou relais vers votre équipe : la différence compte.",
    "en": "An external agent network or a transfer to your team: the difference matters."
  },
  "yelda": {
    "fr": "Service client multicanal ou accueil téléphonique : partez de votre besoin.",
    "en": "Multichannel customer service or phone answering: start with your needs."
  },
  "rosie": {
    "fr": "Langues, minutes et réservation directe : comparez la bonne formule.",
    "en": "Languages, minutes and direct booking: compare the right plan."
  },
  "ruby": {
    "fr": "Accueil humain externalisé ou IA : choisissez qui répond à vos clients.",
    "en": "Outsourced human reception or AI: choose who answers your customers."
  },
  "answering-legal": {
    "fr": "Accueil juridique humain ou qualification IA : gardez les rôles clairs.",
    "en": "Human legal intake or AI qualification: keep the roles clear."
  }
};

const EVIDENCE: ComparisonEvidence[] = [
  {
    "slug": "sylen",
    "competitor": "Sylen AI",
    "source": "https://sylen.ai/solutions/restaurant",
    "intro": {
      "fr": "Sylen présente un accueil IA avec agenda, transferts et comptes rendus. Son offre Start publiée est à 49 € HT/mois pour 100 minutes, avec 0,44 €/minute supplémentaire. Ce prix seul ne compare pas le coût de votre volume réel.",
      "en": "Sylen advertises AI answering with scheduling, transfers and call summaries. Its published Start plan is €49 excluding tax/month for 100 minutes, then €0.44 per additional minute. That sticker price is not the cost of your actual traffic."
    },
    "question": {
      "fr": "Demandez un test de modification puis d’annulation dans votre agenda, pas seulement une réservation réussie. Comparez aussi le traitement d’un agenda déconnecté et le coût des dépassements.",
      "en": "Ask for a calendar reschedule and cancellation test, not just a successful booking. Compare disconnected-calendar handling and overage costs too."
    },
    "fit": {
      "fr": "Sylen mérite un essai si ses minutes et connecteurs correspondent à votre activité. Choisissez Qwillio si vous voulez piloter l’accueil, les contacts et les rendez-vous dans le même portail, après validation de vos scénarios.",
      "en": "Try Sylen if its minute allowance and connectors fit your business. Choose Qwillio if you want answering, contacts and bookings in one portal, after validating your own scenarios."
    },
    "rows": {
      "fr": [
        [
          "Accueil",
          "IA, selon l’offre publiée",
          "IA conversationnelle"
        ],
        [
          "Agenda",
          "Connecteurs annoncés",
          "Google Agenda ou Outlook connecté"
        ],
        [
          "Budget de départ",
          "Start : 49 € HT / 100 min",
          "Solo : 99 € / 250 min"
        ]
      ],
      "en": [
        [
          "Answering",
          "AI, per published offering",
          "Conversational AI"
        ],
        [
          "Calendar",
          "Connectors advertised",
          "Connected Google Calendar or Outlook"
        ],
        [
          "Entry budget",
          "Start: €49 excl. tax / 100 min",
          "Solo: €99 / 250 min"
        ]
      ]
    }
  },
  {
    "slug": "nerolia",
    "competitor": "Nerolia",
    "source": "https://nerolia-ai.fr/agence-automatisation",
    "intro": {
      "fr": "La page d’automatisation de Nerolia décrit des workflows sur mesure et des agents vocaux qui prennent des rendez-vous et alimentent un CRM. Elle propose un devis fixe. Un prix cité dans un guide général n’est pas un devis pour votre installation.",
      "en": "Nerolia’s automation page describes custom workflows and voice agents that book appointments and update a CRM. It offers a fixed quote. A price in a general guide is not a quote for your installation."
    },
    "question": {
      "fr": "Faites préciser qui maintient chaque workflow, ce que couvre le devis et les frais récurrents. Pour l’accueil, faites tester une question hors consigne, une annulation et le relais vers votre équipe.",
      "en": "Clarify who maintains each workflow, what the quote includes and recurring charges. For answering, test an out-of-scope question, a cancellation and transfer to your team."
    },
    "fit": {
      "fr": "Un projet Nerolia peut convenir à une chaîne métier spécifique. Qwillio convient si votre besoin commence par un accueil téléphonique configurable, avec contacts et agenda dans un produit à abonnement.",
      "en": "A Nerolia project may suit a specific business workflow. Qwillio fits when you need configurable phone answering with contacts and calendar in a subscription product."
    },
    "rows": {
      "fr": [
        [
          "Approche",
          "Automatisation sur mesure",
          "Produit à abonnement"
        ],
        [
          "CRM",
          "Intégration décrite dans le projet",
          "Contacts et suivi dans le portail"
        ],
        [
          "Budget",
          "Devis selon périmètre",
          "Forfait avec minutes incluses"
        ]
      ],
      "en": [
        [
          "Approach",
          "Custom automation",
          "Subscription product"
        ],
        [
          "CRM",
          "Integration scoped in the project",
          "Contacts and follow-up in the portal"
        ],
        [
          "Budget",
          "Quote based on scope",
          "Plan with included minutes"
        ]
      ]
    }
  },
  {
    "slug": "smith-ai",
    "competitor": "Smith.ai",
    "source": "https://smith.ai/",
    "intro": {
      "fr": "Smith.ai présente un accueil associant IA et agents humains, avec qualification et prise de consultation. Le relais vers son réseau d’agents n’est pas le même service qu’un transfert vers votre propre équipe chez Qwillio.",
      "en": "Smith.ai advertises AI answering with live human agents, qualification and consultation booking. Escalation to its agent network is not the same service as a Qwillio transfer to your own team."
    },
    "question": {
      "fr": "Comparez séparément appel traité par l’IA, appel escaladé et appel long. Un tarif par appel ne se compare pas à un forfait de minutes sans vos durées moyennes et vos règles de facturation.",
      "en": "Compare AI-handled, escalated and long calls separately. Per-call pricing cannot be compared with a minute allowance without your average durations and billing rules."
    },
    "fit": {
      "fr": "Smith.ai peut convenir si vous cherchez aussi une permanence humaine externalisée. Qwillio convient si vous voulez l’IA en première ligne et votre équipe en relais, sans présenter ce relais comme une équipe humaine fournie par Qwillio.",
      "en": "Smith.ai may fit if you also need an outsourced human answering team. Qwillio fits if you want AI first and your team as backup, without treating that transfer as a human team supplied by Qwillio."
    },
    "rows": {
      "fr": [
        [
          "Qui répond",
          "IA et/ou agents selon l’offre",
          "IA conversationnelle"
        ],
        [
          "Relais humain sur appel complexe",
          "Réseau d’agents annoncé",
          "Oui, vers votre équipe (si configuré)"
        ],
        [
          "Unité de facturation",
          "Par appel selon offre et escalade",
          "Minutes incluses puis dépassement"
        ]
      ],
      "en": [
        [
          "Who answers",
          "AI and/or live agents by offering",
          "Conversational AI"
        ],
        [
          "Human backup on tricky calls",
          "Advertised live agent network",
          "Yes, to your team (when configured)"
        ],
        [
          "Billing unit",
          "Per call, depending on offering and escalation",
          "Included minutes then overage"
        ]
      ]
    }
  },
  {
    "slug": "yelda",
    "competitor": "YeldaAI",
    "source": "https://yelda.fr",
    "intro": {
      "fr": "YeldaAI présente des callbots, voicebots et chatbots vocaux reliés aux systèmes métier. C’est une piste pour un service client multicanal. Cette présentation ne donne pas le budget de votre projet ni la liste des connecteurs inclus dans votre contrat.",
      "en": "YeldaAI advertises callbots, voicebots and voice-enabled chatbots connected to business systems. It is an option for multichannel customer service. That description does not establish your project budget or contracted connectors."
    },
    "question": {
      "fr": "Faites cadrer les canaux, l’authentification de vos outils et les actions autorisées avant le devis. Pour un accueil PME, comparez le temps d’administration quotidien, pas uniquement la liste des canaux possibles.",
      "en": "Scope channels, tool authentication and allowed actions before requesting a quote. For small-business answering, compare daily administration, not just the list of possible channels."
    },
    "fit": {
      "fr": "YeldaAI mérite une étude si votre priorité est un service client intégré à plusieurs canaux. Qwillio convient à un accueil téléphonique avec agenda et suivi dans un portail, sans promettre un remplacement de tous vos logiciels métier.",
      "en": "Consider YeldaAI when your priority is customer service across multiple channels. Qwillio fits phone answering with scheduling and follow-up in a portal, without promising to replace every business system."
    },
    "rows": {
      "fr": [
        [
          "Périmètre présenté",
          "Callbot, voicebot, chatbot vocal",
          "Accueil téléphonique et portail"
        ],
        [
          "Systèmes métier",
          "Connexions annoncées, à cadrer",
          "Agenda connecté ; autres flux selon configuration"
        ],
        [
          "Budget",
          "À demander pour votre projet",
          "Abonnement et consommation de minutes"
        ]
      ],
      "en": [
        [
          "Advertised scope",
          "Callbot, voicebot, voice chatbot",
          "Phone answering and portal"
        ],
        [
          "Business systems",
          "Advertised connections, scope required",
          "Connected calendar; other workflows depend on configuration"
        ],
        [
          "Budget",
          "Request a project quote",
          "Subscription and minute usage"
        ]
      ]
    }
  },
  {
    "slug": "rosie",
    "competitor": "Rosie",
    "source": "https://heyrosie.com/pricing",
    "intro": {
      "fr": "Rosie publie Professional à 49 $/mois pour 250 minutes. La réservation directe et les transferts sont annoncés dans Scale, à 149 $ pour 1 000 minutes. Sa page indique anglais et espagnol. Comparez la formule contenant les actions nécessaires, pas le seul prix d’entrée.",
      "en": "Rosie lists Professional at $49/month for 250 minutes. Direct booking and transfers are advertised in Scale, at $149 for 1,000 minutes. Its page lists English and Spanish. Compare the tier containing the actions you need, not only the entry price."
    },
    "question": {
      "fr": "Testez votre langue, votre numéro et un créneau dans votre fuseau horaire. Vérifiez si l’offre envoie un lien de réservation ou écrit directement dans l’agenda : ces deux parcours ne rendent pas le même service.",
      "en": "Test your language, phone number and a slot in your time zone. Check whether a tier texts a booking link or writes directly to the calendar: those are different workflows."
    },
    "fit": {
      "fr": "Rosie peut convenir si ses langues et son offre correspondent à vos appelants. Qwillio mérite un essai pour un accueil français et anglais avec un agenda Google ou Outlook connecté. Les prix en dollars et en euros restent dans leur devise d’origine.",
      "en": "Rosie may fit if its languages and plan suit your callers. Try Qwillio for French and English answering with a connected Google or Outlook calendar. Dollar and euro prices remain in their original currencies."
    },
    "rows": {
      "fr": [
        [
          "Langues publiées",
          "Anglais et espagnol",
          "Français et anglais"
        ],
        [
          "Réservation directe",
          "Scale et offres supérieures",
          "Avec agenda connecté et configuration"
        ],
        [
          "Budget de départ",
          "Professional : 49 $ / 250 min",
          "Solo : 99 € / 250 min"
        ]
      ],
      "en": [
        [
          "Published languages",
          "English and Spanish",
          "French and English"
        ],
        [
          "Direct booking",
          "Scale and higher tiers",
          "With connected calendar and configuration"
        ],
        [
          "Entry budget",
          "Professional: $49 / 250 min",
          "Solo: €99 / 250 min"
        ]
      ]
    }
  },
  {
    "slug": "ruby",
    "competitor": "Ruby",
    "source": "https://info.ruby.com/lp-virtual-receptionists-more-than-answering-service/",
    "intro": {
      "fr": "Ruby présente une permanence avec des réceptionnistes humains basés aux États-Unis. Leur prestation inclut prise de messages, qualification et gestion de rendez-vous. Qwillio propose un accueil IA ; ce n’est pas la même forme de présence humaine.",
      "en": "Ruby advertises answering by US-based human receptionists. Its service includes messages, intake and appointment handling. Qwillio provides AI answering; it is not the same form of human coverage."
    },
    "question": {
      "fr": "Si l’humain est votre critère principal, faites écouter vos appels types à la personne chargée de choisir. Comparez ensuite langues contractuelles, volume inclus, dépassements et traitement des demandes qui exigent votre jugement.",
      "en": "If human answering is your main criterion, let the decision-maker hear your typical calls. Then compare contracted languages, included volume, overage and requests requiring your judgment."
    },
    "fit": {
      "fr": "Ruby est une piste si vous voulez externaliser l’accueil humain. Qwillio convient si vous acceptez un accueil IA et gardez les décisions sensibles dans votre équipe, avec transfert configuré lorsque votre ligne est disponible.",
      "en": "Consider Ruby if you want outsourced human answering. Qwillio fits if you accept AI answering and keep sensitive decisions with your team, with configured transfers when your line is available."
    },
    "rows": {
      "fr": [
        [
          "Qui répond",
          "Réceptionnistes humains",
          "IA conversationnelle"
        ],
        [
          "Équipe externalisée",
          "Oui, selon prestation Ruby",
          "Non ; relais vers votre équipe"
        ],
        [
          "Rendez-vous",
          "Prestation annoncée",
          "Agenda connecté et règles configurées"
        ]
      ],
      "en": [
        [
          "Who answers",
          "Human receptionists",
          "Conversational AI"
        ],
        [
          "Outsourced team",
          "Yes, under the Ruby service",
          "No; transfers to your team"
        ],
        [
          "Appointments",
          "Advertised service",
          "Connected calendar and configured rules"
        ]
      ]
    }
  },
  {
    "slug": "answering-legal",
    "competitor": "Answering Legal",
    "source": "https://answeringlegal.com/",
    "intro": {
      "fr": "Answering Legal présente une permanence humaine dédiée aux cabinets d’avocats, avec qualification juridique, anglais/espagnol et prise de rendez-vous. Son chatbot IA de site web est une offre distincte de cet accueil téléphonique humain.",
      "en": "Answering Legal advertises human answering for law firms, legal intake, English/Spanish handling and scheduling. Its AI website chatbot is separate from that human phone-answering service."
    },
    "question": {
      "fr": "Pour un cabinet, testez le recueil du motif sans conseil juridique et la remise des informations au bon collaborateur. Vérifiez l’accord de traitement des données et les sous-traitants des deux offres : un pays d’origine ne prouve pas, à lui seul, la conformité.",
      "en": "For a law firm, test capturing the matter without legal advice and delivering it to the right colleague. Check both providers’ data processing terms and subprocessors: country of origin alone does not establish compliance."
    },
    "fit": {
      "fr": "Answering Legal peut convenir à un cabinet cherchant une équipe humaine formée à l’accueil juridique. Qwillio convient à une qualification initiale en français ou anglais, avec rendez-vous dans l’agenda connecté ; les décisions juridiques restent humaines.",
      "en": "Answering Legal may fit a firm seeking humans trained in legal intake. Qwillio fits initial qualification in French or English with booking in a connected calendar; legal decisions remain human."
    },
    "rows": {
      "fr": [
        [
          "Accueil téléphonique",
          "Humains spécialisés juridique",
          "IA configurée pour votre cabinet"
        ],
        [
          "Langues publiées",
          "Anglais et espagnol",
          "Français et anglais"
        ],
        [
          "Prise de rendez-vous",
          "Annoncée par le prestataire",
          "Avec agenda connecté et configuration"
        ]
      ],
      "en": [
        [
          "Phone answering",
          "Humans trained in legal intake",
          "AI configured for your firm"
        ],
        [
          "Published languages",
          "English and Spanish",
          "French and English"
        ],
        [
          "Scheduling",
          "Advertised by provider",
          "With connected calendar and configuration"
        ]
      ]
    }
  }
];

function blocks(e: ComparisonEvidence, lang: 'fr' | 'en'): ComparisonBlock[] {
  const fr = lang === 'fr';
  return [
    { type: 'p', text: e.intro[lang] },
    { type: 'p', text: fr
      ? 'Les éléments concurrentiels ci-dessous décrivent les pages officielles citées, consultées le 1er novembre 2026. Ce ne sont pas des essais indépendants. Prix, conditions et disponibilité pour votre compte : à revérifier avant de décider.'
      : 'Competitor details below describe the cited official pages, reviewed on November 1, 2026. They are not independent product tests. Prices, terms and availability for your account: re-verify before deciding.' },
    { type: 'h2', text: fr ? 'Comparer le service rendu' : 'Compare the actual service' },
    { type: 'table', head: [fr ? 'Critère' : 'Criterion', e.competitor, 'Qwillio'], rows: e.rows[lang] },
    { type: 'p', text: e.question[lang] },
    { type: 'h2', text: fr ? 'Le budget Qwillio, en minutes' : 'Qwillio budget, in minutes' },
    { type: 'table', head: [fr ? 'Formule' : 'Plan', fr ? 'Prix mensuel' : 'Monthly price', fr ? 'Minutes incluses' : 'Included minutes'],
      rows: (Object.keys(PLAN_MONTHLY_EUR) as (keyof typeof PLAN_MONTHLY_EUR)[]).map(key => [key === 'enterprise' ? 'Enterprise' : key[0].toUpperCase() + key.slice(1), `${PLAN_MONTHLY_EUR[key]} €`, `${PLAN_MINUTES[key].toLocaleString('en-US')} min`]),
      caption: fr ? 'Tarifs mensuels, hors remise annuelle. Dépassements facturés à la minute selon la formule ; pas d’appels illimités.' : 'Monthly prices, before annual discounts. Overage is billed per minute according to plan; calls are not unlimited.' },
    { type: 'p', text: fr
      ? 'Chez Qwillio, la réservation exige un agenda Google ou Outlook connecté. Le transfert exige un numéro de destination configuré et dépend de votre opérateur ; son acceptation technique ne prouve pas qu’une personne a décroché. La consultation, la modification et l’annulation d’un rendez-vous existant passent à votre équipe après vérification d’identité. CRM inclus, sync HubSpot/webhook selon configuration. Le récap hebdomadaire dépend du bot actif et des emails configurés ; les autres envois et automatisations dépendent des options activées sur le compte.'
      : 'Qwillio booking requires a connected Google or Outlook calendar. Transfer requires a configured destination number and depends on your carrier; an accepted transfer request does not prove anyone answered. Looking up, changing or cancelling an existing booking requires team identity verification. CRM is included; HubSpot/webhook sync depends on configuration. The weekly recap requires an active bot and configured emails; other messages and automation depend on enabled account options.' },
    { type: 'h2', text: fr ? 'Un essai qui permet de décider' : 'A trial that helps you decide' },
    { type: 'p', text: fr
      ? 'L’essai Qwillio dure 7 jours, carte requise à l’inscription. La démo navigateur permet d’écouter et de poser des questions sans créer de rendez-vous ni envoyer de SMS. Pour valider l’exploitation, testez ensuite votre ligne réelle, un agenda indisponible et un destinataire qui ne répond pas.'
      : 'The Qwillio trial lasts 7 days, card required at signup. The browser demo lets you listen and ask questions without creating bookings or sending texts. To validate operations, then test your actual phone line, an unavailable calendar and an unanswered transfer.' },
    { type: 'verdict', tone: 'neutral', title: fr ? 'Choisissez selon votre organisation' : 'Choose for your operation', text: e.fit[lang] },
  ];
}
export const COMPARISON_PAGES: ComparisonPage[] = EVIDENCE.map(e => ({
  slug: e.slug, competitor: e.competitor,
  title: { fr: `Qwillio ou ${e.competitor}`, en: `Qwillio vs ${e.competitor}` },
  subtitle: SUBTITLES[e.slug],
  updated: '2026-11-01', sources: [{ label: e.competitor, url: e.source }],
  content: { fr: blocks(e, 'fr'), en: blocks(e, 'en') },
}));
export function getComparisonBySlug(slug: string): ComparisonPage | undefined {
  return COMPARISON_PAGES.find(c => c.slug === slug);
}
