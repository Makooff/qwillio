import type { VoiceLanguage } from './speech-plans';
import type { ClientVoiceProfile } from './realtime-context.service';
import { env } from '../../config/env';

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
  },
  bookAppointment: {
    fr: {
      start: ['Parfait, je vous réserve ça.', 'Très bien, j\'enregistre le rendez-vous.'],
      delayed: ['Je finalise la réservation, un instant.'],
    },
    en: {
      start: ['Perfect, let me lock that in for you.', 'Great, I\'m booking that now.'],
      delayed: ['Just finishing the booking, one moment.'],
    },
  },
  captureLead: {
    fr: {
      start: ['C\'est noté.'],
      delayed: [],
    },
    en: {
      start: ['Got it, noting that down.'],
      delayed: [],
    },
  },
  lookupBooking: {
    fr: {
      start: ['Je retrouve votre réservation, un instant.'],
      delayed: ['Je cherche encore, merci de patienter.'],
    },
    en: {
      start: ['Let me find your booking.'],
      delayed: ['Still looking, one moment.'],
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
  },
};

export function fillerFor(tool: string, lang: VoiceLanguage, phase: 'start' | 'delayed'): string[] {
  return FILLER[tool]?.[lang]?.[phase] ?? [];
}

/**
 * Build the Vapi `messages` block for a tool: the filler contract.
 * Returned as an array because Vapi accepts several message roles per tool.
 */
function toolMessages(tool: string, lang: VoiceLanguage) {
  const messages: Array<Record<string, unknown>> = [];
  const start = fillerFor(tool, lang, 'start');
  const delayed = fillerFor(tool, lang, 'delayed');

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
  const serverUrl = `${env.API_BASE_URL}/api/webhooks/vapi/tools/${profile.clientId}`;
  const tools: Array<Record<string, unknown>> = [];

  const canBook = profile.bookingEnabled && profile.calendarConnected;

  if (canBook) {
    tools.push({
      type: 'function',
      async: false,
      server: { url: serverUrl, timeoutSeconds: env.VOICE_TOOL_TIMEOUT_SECONDS },
      messages: toolMessages('checkAvailability', lang),
      function: {
        name: 'checkAvailability',
        description:
          'Check which appointment slots are free on a given date. Call this BEFORE proposing any time to the caller. Never invent availability.',
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
      server: { url: serverUrl, timeoutSeconds: env.VOICE_TOOL_TIMEOUT_SECONDS },
      messages: toolMessages('bookAppointment', lang),
      function: {
        name: 'bookAppointment',
        description:
          'Book a confirmed appointment in a slot that checkAvailability returned as free. Only call once the caller has explicitly agreed to a specific time.',
        parameters: {
          type: 'object',
          properties: {
            customerName: { type: 'string', description: 'Full name of the caller.' },
            date: { type: 'string', description: 'Appointment date, ISO 8601 (YYYY-MM-DD).' },
            time: { type: 'string', description: 'Start time, 24h HH:mm in the business timezone.' },
            serviceType: { type: 'string', description: 'Service being booked.' },
            partySize: { type: 'number', description: 'Number of people, when relevant (restaurants).' },
            customerEmail: { type: 'string', description: 'Email, only if the caller volunteers it.' },
            specialRequests: { type: 'string', description: 'Anything the caller asked for specifically.' },
          },
          required: ['customerName', 'date', 'time'],
        },
      },
    });

    tools.push({
      type: 'function',
      async: false,
      server: { url: serverUrl, timeoutSeconds: env.VOICE_TOOL_TIMEOUT_SECONDS },
      messages: toolMessages('lookupBooking', lang),
      function: {
        name: 'lookupBooking',
        description: 'Find an existing upcoming booking for the caller, to confirm, move or cancel it.',
        parameters: {
          type: 'object',
          properties: {
            customerName: { type: 'string', description: 'Name the booking was made under, when given.' },
          },
        },
      },
    });
  }

  // Always available: capturing who called and why is the minimum viable
  // outcome even when nothing can be booked.
  tools.push({
    type: 'function',
    // Fire-and-forget: the model must not wait on a write that only matters
    // after the call. This is the one tool where async is correct.
    async: true,
    server: { url: serverUrl, timeoutSeconds: env.VOICE_TOOL_TIMEOUT_SECONDS },
    messages: toolMessages('captureLead', lang),
    function: {
      name: 'captureLead',
      description:
        'Record the caller\'s details and the reason for the call. Call this as soon as you have a name and an intent, without waiting for the end of the conversation.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          reason: { type: 'string', description: 'Why they called, one sentence.' },
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
      server: { url: serverUrl, timeoutSeconds: env.VOICE_TOOL_TIMEOUT_SECONDS },
      messages: toolMessages('lookupKnowledge', lang),
      function: {
        name: 'lookupKnowledge',
        description:
          'Look up the business knowledge base (FAQ, staff, house rules) when the caller asks something not already covered in your instructions. Never guess an answer about the business.',
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

  if (profile.transferNumber) {
    tools.push({
      type: 'transferCall',
      destinations: [
        {
          type: 'number',
          number: profile.transferNumber,
          // Spoken before the bridge, so the caller is not dumped into silence
          // while Twilio dials.
          message:
            lang === 'fr'
              ? 'Bien sûr, je vous mets en relation avec quelqu\'un de l\'équipe. Un instant.'
              : 'Of course, let me connect you with someone from the team. One moment.',
          // Warm: Vapi speaks a summary to the operator before bridging. The
          // per-call summary comes from the transfer-destination-request
          // handler; this static plan is the fallback when that is not reached.
          transferPlan: { mode: 'warm-transfer-say-summary', summaryPlan: { enabled: true } },
        },
      ],
    });
  }

  return tools;
}

/** Tool names the runtime knows how to execute, for validation on the webhook. */
export const KNOWN_TOOLS = [
  'checkAvailability',
  'bookAppointment',
  'lookupBooking',
  'captureLead',
  'lookupKnowledge',
] as const;
export type KnownTool = (typeof KNOWN_TOOLS)[number];

export function isKnownTool(name: string): name is KnownTool {
  return (KNOWN_TOOLS as readonly string[]).includes(name);
}
