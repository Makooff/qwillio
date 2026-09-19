import type { VoiceLanguage } from './speech-plans';
import type { ClientVoiceProfile } from './realtime-context.service';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { toE164 } from '../../utils/phone';
import { wouldLoop } from './transfer-loop';
import { webhookServer } from './webhook-identity';
import { voiceForProfile } from './profile-voice';

/**
 * Tool schemas + contextual filler (Phase 4).
 *
 * Two things happen here, and they are the same problem seen from both ends:
 *
 *  1. The schemas tell the model what it may do (check a slot, book it, capture
 *     a lead, hand over to a human).
 *  2. The `messages` attached to each schema tell Vapi what to SAY while the
 *     server executes it. A calendar round-trip is 400-900 ms; without a filler
 *     the caller hears dead air and assumes the line dropped. This is the
 *     "meublage" — it is config, not an extra LLM turn, so it costs nothing and
 *     starts speaking the instant the tool is invoked.
 */

/**
 * Filler lines, per tool and per language. Several variants each because a
 * receptionist that says the exact same seven words before every lookup stops
 * sounding human by the third time.
 *
 * `request-start` fires immediately on invocation. `request-response-delayed`
 * fires only if the tool is still running after `timingMilliseconds` — that is
 * the second reassurance for a slow calendar, and it is why the first line can
 * stay short.
 *
 * ── LA RÈGLE, payée sur deux appels réels le 16/09/2026 ───────────────────
 *
 * Une phrase de démarrage décrit ce qui est EN COURS, jamais son ISSUE. Elle
 * est dite AVANT que l'outil ne réponde, donc toute phrase qui affirme un
 * résultat ment une fois sur deux, et ment toujours quand l'outil échoue.
 *
 * Ce que ça a donné, mot pour mot: « Parfait, je vous réserve ça. » suivi
 * immédiatement de « pourriez-vous épeler votre nom de famille » — rien n'était
 * réservé, et rien ne l'a jamais été sur cet appel. Puis, l'appel suivant,
 * « Je déplace votre rendez-vous, un instant. » SEPT fois, pendant que l'outil
 * répondait sept fois « AUCUNE RESERVATION trouvee ».
 *
 * Le plus dur à voir: le prompt avait été durci pendant des semaines contre
 * exactement ça (6quadragesies, `missingBookingInfo`, « RIEN N'EST ENCORE
 * RESERVE »), pendant que cette table le disait à voix haute avant même que
 * l'outil ne tourne. Le modèle n'y était pour rien.
 *
 * `checkAvailability` portait déjà la bonne forme et sert de modèle:
 * « Je regarde ça tout de suite » décrit le geste, pas ce qu'il trouvera.
 * `filler-says-nothing-done.test.ts` interdit le retour en arrière.
 */
const FILLER: Record<string, Record<VoiceLanguage, { start: string[]; delayed: string[] }>> = {
  checkAvailability: {
    fr: {
      start: [
        'Je regarde ça tout de suite.',
        'Laissez-moi vérifier une petite seconde.',
        'Je consulte l\'agenda, un instant.',
      ],
      delayed: [
        'Je suis toujours dessus, merci de patienter.',
        'Encore deux secondes, l\'agenda charge.',
      ],
    },
    en: {
      start: [
        'Let me check that for you.',
        'One second, I\'m looking at the calendar.',
        'Let me pull that up real quick.',
      ],
      delayed: [
        'Still checking, thanks for holding.',
        'Just another moment, almost there.',
      ],
    },
    nl: {
      start: [
        'Ik kijk het meteen even na.',
        'Een momentje, ik bekijk de agenda.',
        'Ik zoek dat even op voor u.',
      ],
      delayed: [
        'Ik ben er nog mee bezig, een ogenblikje.',
        'Nog heel even, de agenda laadt.',
      ],
    },
  },
  bookAppointment: {
    fr: {
      start: ['Un instant, je m\'en occupe.', 'Je vérifie ça, un instant.'],
      delayed: ['Encore un instant, je suis dessus.'],
    },
    en: {
      start: ['One moment, I\'m on it.', 'Let me take care of that, one second.'],
      delayed: ['Still on it, one moment.'],
    },
    nl: {
      start: ['Een ogenblikje, ik kijk dat na.', 'Momentje, ik ben ermee bezig.'],
      delayed: ['Nog even geduld, ik ben ermee bezig.'],
    },
  },
  captureLead: {
    fr: {
      start: ['Un instant, je prends note.'],
      delayed: [],
    },
    en: {
      start: ['One moment, taking that down.'],
      delayed: [],
    },
    nl: {
      start: ['Een momentje, ik noteer het.'],
      delayed: [],
    },
  },
  lookupBooking: {
    fr: {
      start: ['Je cherche votre réservation, un instant.'],
      delayed: ['Je cherche encore, merci de patienter.'],
    },
    en: {
      start: ['Let me look for your booking.'],
      delayed: ['Still looking, one moment.'],
    },
    nl: {
      start: ['Ik zoek uw reservatie even op.'],
      delayed: ['Ik ben nog aan het zoeken, een momentje.'],
    },
  },
  rescheduleBooking: {
    fr: {
      start: ['Un instant, je regarde votre rendez-vous.'],
      delayed: ['Encore un instant, je consulte l\'agenda.'],
    },
    en: {
      start: ['One moment, let me look at your appointment.'],
      delayed: ['One moment, I\'m checking the calendar.'],
    },
    nl: {
      start: ['Een momentje, ik bekijk uw afspraak.'],
      delayed: ['Een momentje, ik raadpleeg de agenda.'],
    },
  },
  /* ANNULER: la phrase de démarrage dit qu'on REGARDE, jamais qu'on annule.
     « J'annule votre rendez-vous » est la même faute que « je déplace votre
     rendez-vous », dite sept fois le 16/09/2026 pendant que l'outil répondait
     sept fois « AUCUNE RESERVATION trouvee ». Elle est pire ici: l'appelant
     qui l'entend raccroche en croyant son créneau libéré, et le commerce le
     garde. La table interdit désormais les deux formes. */
  cancelBooking: {
    fr: {
      start: ['Un instant, je regarde votre rendez-vous.'],
      delayed: ['Encore un instant, je consulte l\'agenda.'],
    },
    en: {
      start: ['One moment, let me look at your appointment.'],
      delayed: ['One moment, I\'m checking the calendar.'],
    },
    nl: {
      start: ['Een momentje, ik bekijk uw afspraak.'],
      delayed: ['Een momentje, ik raadpleeg de agenda.'],
    },
  },
  lookupKnowledge: {
    fr: {
      start: ['Je vérifie ça.', 'Alors, je regarde.'],
      delayed: [],
    },
    en: {
      start: ['Let me check on that.', 'One sec, checking.'],
      delayed: [],
    },
    nl: {
      start: ['Ik kijk dat even na.', 'Momentje, ik zoek het op.'],
      delayed: [],
    },
  },
};

/**
 * La phrase de demarrage en PAROLE-A-PAROLE: une seule, vouvoyante, qui ne
 * decrit RIEN.
 *
 * Elle ne remplace pas les tables ci-dessus, qui restent le bon choix en
 * classique: la chaine ne peut rien dire pendant que l'outil tourne, et
 * nommer l'action rassure. Ici le modele nomme deja l'action lui-meme.
 */
const MINIMAL_START: Record<VoiceLanguage, string[]> = {
  fr: ['Un instant.'],
  en: ['One moment.'],
  nl: ['Een momentje.'],
};

export function fillerFor(tool: string, lang: VoiceLanguage, phase: 'start' | 'delayed'): string[] {
  return FILLER[tool]?.[lang]?.[phase] ?? [];
}

/**
 * Build the Vapi `messages` block for a tool: the filler contract.
 * Returned as an array because Vapi accepts several message roles per tool.
 */
function toolMessages(tool: string, lang: VoiceLanguage, speechToSpeech = false) {
  const messages: Array<Record<string, unknown>> = [];
  /* PAS DE PHRASE DE DÉMARRAGE EN PAROLE-À-PAROLE. Le modèle y produit son
     audio lui-même et annonce SPONTANÉMENT ce qu'il fait avant d'appeler
     l'outil; la nôtre s'ajoute par-dessus, dans une autre voix, en disant la
     même chose. Relevé deux fois dans le même appel du 17/09/2026:
       « Je vais maintenant vérifier vos rendez-vous. Un instant s'il vous
         plaît. » (le modèle) puis « Je cherche votre réservation, un
         instant. » (cette table, mot pour mot)
     C'est « il répète en boucle ce qu'il fait », le retour exact du
     propriétaire. En classique la phrase est indispensable — la chaîne ne peut
     RIEN dire pendant que l'outil tourne — et elle reste.

     LA PHRASE RETARDÉE SE TAIT AUSSI, et la raison invalide ce que cette
     note disait le 17/09 (19/09/2026). Elle a été gardée en parole-à-parole
     au motif qu'elle « ne part qu'après `VOICE_FILLER_DELAY_MS`, quand le
     modèle a fini d'annoncer et qu'il n'y a plus que du silence ». Ce seuil
     vaut 1 200 ms, et le relevé du LENDEMAIN donne les durées d'outil
     réelles: 2,2 / 6,1 / 2,9 / 4,5 / 7,7 s. **Les cinq le dépassent.**
     Elle ne partait donc pas sur l'outil rare et lent, elle partait sur
     TOUS, par-dessus une narration que le modèle produit déjà lui-même.

     C'est le même défaut que la phrase de démarrage, et c'est le même retour
     du propriétaire, mot pour mot: « il ne fait que se répéter, on dirait un
     robot ». Le correctif du 17 n'en avait fermé que la moitié.

     La règle: une justification qui repose sur un seuil doit être relue
     quand on MESURE ce que ce seuil filtre. Ici la mesure existait un jour
     plus tard et personne n'est revenu comparer.

     En CLASSIQUE les deux restent: la chaîne ne peut rien dire pendant que
     l'outil tourne, et un `lookupBooking` à 7,9 s y est exactement le cas où
     l'appelant croit la ligne coupée. */
  /* TAIRE LA PHRASE NE LA RETIRE PAS (19/09/2026), et c'est la troisieme fois
     que ce depot paie cette forme (6sexquinquagesies, sur `transcriber`).
     `messages: []` a ete lu comme « pas de phrase ». Relevé sur un appel
     réel: les DEUX appels d'outil sont suivis, 10 ms apres
     `Tool execution started`, d'un `sayQueuePush` de Vapi, et l'appelant a
     entendu « Donne-moi un moment. » Cette phrase n'est dans aucune table
     d'ici, et l'audio du modele en parole-a-parole ne passe pas par cette
     file (le tour d'avant n'a aucun `sayQueuePush`). C'est donc le DEFAUT de
     Vapi qui a pris la place — et il TUTOIE, sur un agent dont tout le prompt
     impose le vouvoiement depuis dix jours.
     Le silence n'etait donc pas une option offerte: le choix reel est entre
     NOTRE phrase et la SIENNE. On reprend la main, avec une phrase MINIMALE
     et identique pour tous les outils: le defaut du 17/09 etait que la notre
     narrait ce que le modele narrait deja (« Je cherche votre reservation »
     par-dessus « Je vais verifier vos rendez-vous »). « Un instant » ne
     narre rien, donc il ne peut pas faire doublon avec une narration.
     La RETARDEE reste tue: elle, elle n'a pas de defaut Vapi derriere, et
     c'est elle qui relancait le bavardage a chaque outil. */
  const start = speechToSpeech ? MINIMAL_START[lang] : fillerFor(tool, lang, 'start');
  const delayed = speechToSpeech ? [] : fillerFor(tool, lang, 'delayed');

  if (start.length) {
    messages.push({
      type: 'request-start',
      // Vapi picks one at random per invocation when several are supplied.
      contents: start.map(text => ({ type: 'text', text, language: lang })),
      blocking: false,
    });
  }
  if (delayed.length) {
    messages.push({
      type: 'request-response-delayed',
      contents: delayed.map(text => ({ type: 'text', text, language: lang })),
      timingMilliseconds: env.VOICE_FILLER_DELAY_MS,
    });
  }
  return messages;
}

/**
 * The tool set offered to a client's receptionist.
 *
 * Availability and booking are only exposed when the client actually has a
 * calendar connected — an assistant that can promise a slot it cannot write is
 * worse than one that offers a callback. Same logic for the transfer tool and
 * the transfer number.
 */
export function buildVoiceTools(profile: ClientVoiceProfile) {
  const lang = profile.language;
  /* Le moteur se lit sur le PROFIL, par la seule règle qui tranche
     (`useSpeechToSpeech`, via `voiceForProfile`): une seconde règle écrite ici
     divergerait de celle de l'assistant en moins d'un mois (6vicies). */
  const s2s = voiceForProfile(profile).speechToSpeech;
  const serverUrl = `${env.API_BASE_URL}/api/webhooks/vapi/tools/${profile.clientId}`;
  const tools: Array<Record<string, unknown>> = [];

  const canBook = profile.bookingEnabled && profile.calendarConnected;

  if (canBook) {
    tools.push({
      type: 'function',
      async: false,
      server: { ...webhookServer(serverUrl), timeoutSeconds: env.VOICE_TOOL_TIMEOUT_SECONDS },
      messages: toolMessages('checkAvailability', lang, s2s),
      function: {
        name: 'checkAvailability',
        description:
          'Check which appointment slots are free on a given date. Call it in the SAME turn as the request, never say you will check first. Call this BEFORE proposing any time to the caller. Never invent availability.',
        parameters: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Requested date, ISO 8601 (YYYY-MM-DD). Resolve relative dates ("tomorrow", "lundi prochain") before calling.',
            },
            partOfDay: {
              type: 'string',
              enum: ['morning', 'afternoon', 'evening', 'any'],
              description: 'Caller preference within the day. Use "any" when unspecified.',
            },
            /* L'HEURE QUE L'APPELANT A DITE, et c'est un argument parce que le
               modèle ne sait pas la garder en bouche. Appel réel du 18/09/2026:
               l'appelant demande « 13 heures », le modèle répond « 14 heures »,
               le corrige, redit « 14 heures », se fait corriger une seconde
               fois, redit « 14 heures ». Son rendez-vous EXISTANT était à 14 h,
               et la liste rendue contenait les deux: il a lu son ancre au lieu
               d'entendre le chiffre.
               Passée en argument, l'heure revient par le RÉSULTAT de l'outil,
               qui la renomme. C'est la même règle que le jour de semaine et que
               la fenêtre d'ouverture: ce que le modèle doit dire, il le lit,
               il ne le retient pas. */
            preferredTime: {
              type: 'string',
              description:
                'The exact time the caller asked for, 24h HH:mm, when they named one ("13 heures" -> "13:00"). '
                + 'Pass it every time they name an hour, including when they correct an earlier one.',
            },
            serviceType: {
              type: 'string',
              description: 'Service the caller is asking about, when they named one.',
            },
          },
          required: ['date'],
        },
      },
    });

    tools.push({
      type: 'function',
      async: false,
      server: { ...webhookServer(serverUrl), timeoutSeconds: env.VOICE_TOOL_TIMEOUT_SECONDS },
      messages: toolMessages('bookAppointment', lang, s2s),
      function: {
        name: 'bookAppointment',
        description:
          'Book a confirmed appointment in a slot that checkAvailability returned as free. Only call once the caller has explicitly agreed to a specific time.',
        parameters: {
          type: 'object',
          properties: {
            /* Le NOM DE FAMILLE, dit comme une EXIGENCE DE CONTENU et non
               comme un ordre de le demander.
               « Full name » laissait passer un prénom seul: un agenda qui porte
               « Marc, 14h » ne distingue pas deux Marc, et le client ne sait pas
               qui se présente.
               La première rédaction disait « ask for their family name before
               booking », et elle a cassé `fr-discipline-agenda`, un scénario
               sans rapport: à « je voudrais un rendez-vous demain », l'agent
               répondait « le matin ou l'après-midi ? » au lieu d'appeler
               checkAvailability. C'est 6quinquies, et la leçon est plus large
               qu'un glossaire de prompt: un verbe d'action posé N'IMPORTE OÙ
               dans le contexte concurrence la discipline d'appel d'outil. Une
               description de champ dit ce que le champ CONTIENT. */
            customerName: {
              type: 'string',
              description:
                'The caller\'s first name and family name. A first name alone does not identify them in the calendar.',
            },
            date: { type: 'string', description: 'Appointment date, ISO 8601 (YYYY-MM-DD).' },
            time: { type: 'string', description: 'Start time, 24h HH:mm in the business timezone.' },
            serviceType: { type: 'string', description: 'Service being booked.' },
            partySize: { type: 'number', description: 'Number of people, when relevant (restaurants).' },
            customerEmail: { type: 'string', description: 'Email, only if the caller volunteers it.' },
            specialRequests: { type: 'string', description: 'Anything the caller asked for specifically.' },
            // Le rendez-vous qui se tient CHEZ l'appelant: sans adresse, il
            // n'est pas pris, il est seulement noté.
            address: {
              type: 'string',
              description:
                'Address where the appointment takes place, when the professional travels to the caller. Exactly as said, with postcode and town.',
            },
          },
          required: ['customerName', 'date', 'time'],
        },
      },
    });

    tools.push({
      type: 'function',
      async: false,
      server: { ...webhookServer(serverUrl), timeoutSeconds: env.VOICE_TOOL_TIMEOUT_SECONDS },
      messages: toolMessages('lookupBooking', lang, s2s),
      function: {
        name: 'lookupBooking',
        description: 'Find the caller\'s existing upcoming bookings, to confirm, move or cancel one. Returns every upcoming booking of this caller; pass what the caller said so the right one comes first.',
        parameters: {
          type: 'object',
          properties: {
            customerName: { type: 'string', description: 'Name the booking was made under, as heard, when given.' },
            currentDate: { type: 'string', description: 'Date the caller says the booking is on, YYYY-MM-DD, when given.' },
            currentTime: { type: 'string', description: 'Time the caller says the booking is at, HH:MM 24h, when given.' },
          },
        },
      },
    });

    /* DÉPLACER un rendez-vous existant. Sans cet outil, « je dois modifier la
       date » finissait en bookAppointment: un second rendez-vous, l'ancien
       toujours dans l'agenda (appel réel, 12/09/2026). */
    tools.push({
      type: 'function',
      async: false,
      server: { ...webhookServer(serverUrl), timeoutSeconds: env.VOICE_TOOL_TIMEOUT_SECONDS },
      messages: toolMessages('rescheduleBooking', lang, s2s),
      function: {
        name: 'rescheduleBooking',
        description:
          'Move the caller\'s existing upcoming booking to a new date and time that checkAvailability returned as free. The old slot is released; no second booking is created.',
        parameters: {
          type: 'object',
          properties: {
            currentDate: { type: 'string', description: 'Date of the booking being moved, YYYY-MM-DD, as lookupBooking listed it. Required when the caller has several bookings.' },
            date: { type: 'string', description: 'New appointment date, ISO 8601 (YYYY-MM-DD).' },
            time: { type: 'string', description: 'New start time, 24h HH:mm in the business timezone.' },
            customerName: { type: 'string', description: 'Name the booking was made under, when the caller gave one.' },
          },
          required: ['date', 'time'],
        },
      },
    });

    /* ANNULER un rendez-vous existant, et c'est l'outil qui MANQUAIT.
       Appel réel du 19/09/2026, mot pour mot:
         Appelant: « Je voudrais ANNULER celui du 22. »
         Agent:    « Votre rendez-vous du 22 septembre est DEPLACE au vendredi
                     25 septembre à 14 heures. »
       Le modèle n'a pas désobéi: privé de l'outil, il a fait la chose la plus
       proche qu'il avait sous la main et l'a annoncée comme faite. C'est
       6quindecies mot pour mot, où l'agent sans outil de transfert proposait
       de prendre un message, « ce qui ressemble à un choix ».
       Et la surface d'outils PROMETTAIT déjà l'annulation: la description de
       `lookupBooking` dit « to confirm, move or cancel one ». */
    tools.push({
      type: 'function',
      async: false,
      server: { ...webhookServer(serverUrl), timeoutSeconds: env.VOICE_TOOL_TIMEOUT_SECONDS },
      messages: toolMessages('cancelBooking', lang, s2s),
      function: {
        name: 'cancelBooking',
        description:
          'Cancel the caller\'s existing upcoming booking and release the slot. '
          /* « Seulement après un accord explicite »: c'est la même forme que
             bookAppointment, et pour une raison plus forte. Une réservation de
             trop se déplace; une annulation ne se défait pas, l'agent n'ayant
             aucun outil pour rebooker le créneau qu'il vient de libérer. */
          + 'Only call it after the caller has explicitly confirmed they want that appointment cancelled. '
          + 'Never call it to move an appointment: that is rescheduleBooking.',
        parameters: {
          type: 'object',
          properties: {
            currentDate: {
              type: 'string',
              description: 'Date of the booking being cancelled, YYYY-MM-DD, as lookupBooking listed it. Required when the caller has several bookings.',
            },
            currentTime: { type: 'string', description: 'Time of that booking, HH:MM 24h, when the caller gave one.' },
            customerName: { type: 'string', description: 'Name the booking was made under, when the caller gave one.' },
          },
        },
      },
    });
  }

  // Always available: capturing who called and why is the minimum viable
  // outcome even when nothing can be booked.
  tools.push({
    type: 'function',
    /* SYNCHRONE, et ce n'était pas le cas.
       `async: true` veut dire chez Vapi « n'attends pas, et ne rends RIEN au
       modèle »: le résultat de l'outil n'est jamais réinjecté dans la
       conversation. Tout ce que `captureLead` répond partait donc dans le vide
       — la relecture d'un numéro mal compris, le repli clavier au deuxième
       échec (BEL-4), la relecture d'un numéro valide. Trois mécanismes écrits,
       testés, et qu'aucun appel n'a jamais reçus.
       Ce que ça coûte: le modèle attend une écriture. Une seule, indexée, avec
       la mémoire appelant déjà détachée en `void`, largement dans le budget de
       l'outil. `captureLead` n'a d'ailleurs aucun message d'attente, donc rien
       n'est dit à voix haute pendant ce temps. */
    async: false,
    server: { ...webhookServer(serverUrl), timeoutSeconds: env.VOICE_TOOL_TIMEOUT_SECONDS },
    messages: toolMessages('captureLead', lang, s2s),
    function: {
      name: 'captureLead',
      description:
        'Record the caller\'s details and the reason for the call. Call this as soon as you have a name and an intent, without waiting for the end of the conversation.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          /* Le numéro de RAPPEL, et il ne fait pas doublon avec l'identifiant
             d'appelant: un appelant en numéro masqué n'en a pas, et celui qui
             demande à être rappelé sur une autre ligne en donne un différent.
             Jusqu'ici aucun numéro dicté n'était capté nulle part. */
          phone: {
            type: 'string',
            description:
              'Callback number, exactly as the caller said it, digits or words. '
              /* Pas « ask for it whenever you promise a call back »: voir
                 `customerName` ci-dessus, et 6quinquies. Que les coordonnées
                 soient à prendre est déjà dit par la règle RENDEZ-VOUS du
                 prompt, qui est l'endroit des consignes. */
              + 'The line to call back on: the caller\'s own line is unusable when withheld, and wrong when they want a different one.',
          },
          reason: { type: 'string', description: 'Why they called, one sentence.' },
          /* L'adresse, telle que dite (BEL-6). Un dépanneur, un vétérinaire à
             domicile ou un livreur ne peuvent rien faire d'un lead sans elle,
             et jusqu'ici elle finissait au mieux noyée dans `reason`. */
          address: {
            type: 'string',
            description:
              'Street address, exactly as the caller said it, including postcode and town when given. Only when an address is relevant to why they called.',
          },
          urgency: { type: 'string', enum: ['low', 'normal', 'high'] },
        },
        required: ['reason'],
      },
    },
  });

  // Knowledge lookup. Only offered when the client actually has entries, so an
  // agent with an empty knowledge base is not tempted to call a tool that can
  // only ever answer "no info".
  if (profile.hasKnowledgeBase) {
    tools.push({
      type: 'function',
      async: false,
      server: { ...webhookServer(serverUrl), timeoutSeconds: env.VOICE_TOOL_TIMEOUT_SECONDS },
      messages: toolMessages('lookupKnowledge', lang, s2s),
      function: {
        name: 'lookupKnowledge',
        description:
          'Look up the business knowledge base (FAQ, staff, house rules) for ANY question about the business not already covered in your instructions. Call it BEFORE saying you do not know: the base may hold the answer. Never guess an answer about the business.',
        parameters: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'The caller\'s question, in their own words.',
            },
          },
          required: ['question'],
        },
      },
    });
  }

  // Vapi validates the destination and rejects the ENTIRE assistant when it is
  // not E.164 ("each value in destinations.number must be a valid phone
  // number"). The transfer number is typed by hand in the settings screen, so
  // "06 12 34 56 78" is as likely as "+33612345678" — and one badly typed
  // number used to take down every call for that client, transfer or not.
  /* Le garde-fou qui protège un appelant RÉEL, et le seul.
     Le contrôle à l'enregistrement ne couvre pas les fiches réglées avant son
     existence, ni un numéro posé à la main sur la fiche par un exploitant.
     Retirer l'outil vaut mieux que boucler: l'agent prend un message au lieu de
     transférer, ce qui est dégradé mais fini. */
  if (wouldLoop(profile.transferNumber, {
    vapiPhoneNumber: profile.inboundNumber,
    declared: profile.inboundLines,
  }, profile.forwardingType)) {
    logger.error(
      `[VoiceTools] transfert en BOUCLE pour ${profile.clientId}: le numéro de transfert `
        + 'est renvoyé vers la réceptionniste. Outil retiré, l\'agent prendra un message.'
    );
  } else {

  const transferTo = toE164(profile.transferNumber, profile.country);
  if (profile.transferNumber && !transferTo) {
    logger.warn(
      `[VoiceTools] transfer number "${profile.transferNumber}" for ${profile.clientId} is not a valid ` +
        'phone number; the transfer tool is omitted rather than breaking every call.'
    );
  }
  if (transferTo) {
    tools.push({
      type: 'transferCall',
      destinations: [
        {
          type: 'number',
          number: transferTo,
          // Spoken before the bridge, so the caller is not dumped into silence
          // while Twilio dials.
          message:
            lang === 'fr'
              ? 'Bien sûr, je vous mets en relation avec quelqu\'un de l\'équipe. Un instant.'
              : 'Of course, let me connect you with someone from the team. One moment.',
          // Warm: Vapi speaks a summary to the operator before bridging. The
          // per-call summary comes from the transfer-destination-request
          // handler; this static plan is the fallback when that is not reached.
          transferPlan: {
            mode: 'warm-transfer-say-summary',
            // La même borne de sonnerie que le plan par appel: ce chemin-ci est
            // le repli, et un repli qui sonne trois fois plus longtemps que le
            // chemin normal est un piège, pas un repli (REL-6).
            dialTimeout: env.VOICE_TRANSFER_RING_SECONDS,
            summaryPlan: { enabled: true },
          },
        },
      ],
    });
  }
  }

  return tools;
}

/** Tool names the runtime knows how to execute, for validation on the webhook. */
export const KNOWN_TOOLS = [
  'checkAvailability',
  'bookAppointment',
  'lookupBooking',
  'rescheduleBooking',
  'cancelBooking',
  'captureLead',
  'lookupKnowledge',
] as const;
export type KnownTool = (typeof KNOWN_TOOLS)[number];

export function isKnownTool(name: string): name is KnownTool {
  return (KNOWN_TOOLS as readonly string[]).includes(name);
}
