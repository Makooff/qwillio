import { describe, it, expect } from 'vitest';
import { buildVoiceTools, fillerFor, isKnownTool } from '../voice-tools';
import type { ClientVoiceProfile } from '../realtime-context.service';

const profile: ClientVoiceProfile = {
  clientId: 'client_1',
  businessName: 'Le Comptoir',
  businessType: 'restaurant',
  agentName: 'Camille',
  language: 'fr',
  timezone: 'Europe/Paris',
  transferNumber: null,
  instructions: null,
  services: [],
  openingHours: null,
  bookingEnabled: true,
  calendarConnected: true,
  planType: 'pro',
  characterId: null,
  country: 'FR',
  customLlm: true,
  hasKnowledgeBase: false,
};

function toolNames(tools: Array<Record<string, any>>): string[] {
  return tools.map(t => t.function?.name ?? t.type);
}

describe('buildVoiceTools', () => {
  it('exposes booking tools when a calendar is connected', () => {
    expect(toolNames(buildVoiceTools(profile))).toEqual(
      expect.arrayContaining(['checkAvailability', 'bookAppointment', 'lookupBooking', 'captureLead'])
    );
  });

  it('hides booking tools when no calendar is connected — never promise a slot we cannot write', () => {
    const names = toolNames(buildVoiceTools({ ...profile, calendarConnected: false }));
    expect(names).not.toContain('checkAvailability');
    expect(names).not.toContain('bookAppointment');
    expect(names).toContain('captureLead');
  });

  it('hides booking tools when the client disabled booking', () => {
    const names = toolNames(buildVoiceTools({ ...profile, bookingEnabled: false }));
    expect(names).not.toContain('bookAppointment');
  });

  it('only offers lookupKnowledge when the client actually has entries', () => {
    // An agent with an empty knowledge base would only ever get "no info" back.
    expect(toolNames(buildVoiceTools(profile))).not.toContain('lookupKnowledge');
    expect(toolNames(buildVoiceTools({ ...profile, hasKnowledgeBase: true }))).toContain('lookupKnowledge');
  });

  it('only offers transferCall when a transfer number exists', () => {
    expect(toolNames(buildVoiceTools(profile))).not.toContain('transferCall');
    expect(toolNames(buildVoiceTools({ ...profile, transferNumber: '+33123456789' }))).toContain('transferCall');
  });

  it('points every function tool at the dedicated tool endpoint', () => {
    for (const tool of buildVoiceTools(profile).filter(t => t.type === 'function')) {
      expect((tool as any).server.url).toMatch(/\/api\/webhooks\/vapi\/tools\/client_1$/);
    }
  });
});

describe('filler (meublage)', () => {
  /* Le meublage couvre l'ATTENTE, pas le blocage: le critère est l'aller-retour
     vers un système extérieur (l'agenda, la base de connaissance), pas le fait
     d'être synchrone. `captureLead` est synchrone depuis qu'on a compris qu'un
     outil asynchrone ne rend rien au modèle, mais il n'écrit qu'une ligne
     indexée: lui coller une phrase d'attente ferait parler l'agent pour ne rien
     dire, sur un appel déjà jugé trop bavard. */
  it('attaches a request-start message to every tool that waits on something outside', () => {
    const waiting = buildVoiceTools(profile).filter(
      t => t.type === 'function' && ['checkAvailability', 'bookAppointment', 'lookupBooking', 'lookupKnowledge'].includes((t as any).function?.name),
    );
    expect(waiting.length).toBeGreaterThan(0);
    for (const tool of waiting) {
      const messages = (tool as any).messages as Array<Record<string, any>>;
      expect(messages.some(m => m.type === 'request-start')).toBe(true);
    }
  });

  it('adds a second reassurance for the slow calendar lookups only', () => {
    expect(fillerFor('checkAvailability', 'fr', 'delayed').length).toBeGreaterThan(0);
    // captureLead writes one indexed row; a delayed line there would be noise.
    expect(fillerFor('captureLead', 'fr', 'delayed')).toHaveLength(0);
  });

  it('varies the wording so it does not sound like a recording', () => {
    expect(new Set(fillerFor('checkAvailability', 'fr', 'start')).size).toBeGreaterThan(1);
  });

  it('speaks the caller language', () => {
    expect(fillerFor('checkAvailability', 'fr', 'start')[0]).toMatch(/regarde|vérifi|consulte/i);
    expect(fillerFor('checkAvailability', 'en', 'start')[0]).toMatch(/check|look/i);
  });

  /**
   * Ce test figeait exactement la valeur fautive, et c'est ce qui a permis au
   * défaut de dormir: `async: true` veut dire chez Vapi « ne rends RIEN au
   * modèle ». Tout ce que `captureLead` répond — relecture d'un numéro mal
   * compris, repli clavier au deuxième échec, relecture d'un numéro valide —
   * partait dans le vide. Trois mécanismes écrits, testés, jamais reçus.
   * L'écriture est une seule ligne indexée, la mémoire appelant est déjà
   * détachée, et l'outil n'a aucune phrase d'attente: le modèle n'attend rien
   * d'audible.
   */
  it('garde captureLead SYNCHRONE — sinon sa réponse n\'atteint jamais le modèle', () => {
    const lead = buildVoiceTools(profile).find(t => (t as any).function?.name === 'captureLead');
    expect((lead as any).async).toBe(false);
  });

  /**
   * Un agenda qui porte « Marc, 14h » ne distingue pas deux Marc, et le client
   * ne sait pas qui se présente. « Full name » laissait passer le prénom seul.
   */
  it('exige le nom de famille pour un rendez-vous', () => {
    const book = buildVoiceTools(profile).find(t => (t as any).function?.name === 'bookAppointment');
    const desc = (book as any).function.parameters.properties.customerName.description as string;
    expect(desc).toMatch(/family name/i);
  });
});

describe('isKnownTool', () => {
  it('accepts the tools the runtime implements', () => {
    expect(isKnownTool('bookAppointment')).toBe(true);
  });

  it('rejects anything else — a hallucinated tool name must not reach the runtime', () => {
    expect(isKnownTool('deleteAllBookings')).toBe(false);
  });
});


/**
 * 6quinquies, et la leçon est plus large qu'un glossaire de prompt.
 *
 * La règle était écrite pour le bloc belgicismes: « un glossaire qui contient
 * un verbe d'action se lit comme une consigne, et une consigne écrite là se
 * substitue aux règles du métier, qui sont ailleurs ». Le test qui la gardait
 * ne lisait QUE ce bloc.
 *
 * Deux descriptions de champ écrites à l'impératif (« ask for their family
 * name before booking », « ask for it whenever you promise a call back ») ont
 * suffi à casser `fr-discipline-agenda`, un scénario qui n'a rien à voir avec
 * un nom ni un numéro: à « je voudrais un rendez-vous demain », l'agent
 * répondait « le matin ou l'après-midi ? » au lieu d'appeler checkAvailability.
 * Deux fois de suite, le second essai du harnais compris.
 *
 * Ce que ça apprend: le modèle ne distingue pas le prompt des descriptions
 * d'outils, il lit un seul contexte. Un ordre de POSER UNE QUESTION, où qu'il
 * soit, concurrence la discipline d'APPELER UN OUTIL. Une description de champ
 * dit donc ce que le champ CONTIENT; ce que l'agent doit faire vit dans les
 * règles du prompt, à un seul endroit.
 */
describe('les descriptions d\'outils ne donnent pas d\'ordre', () => {
  /** Chaque texte que le modèle lit sur la surface d'outils. */
  function descriptions(): string[] {
    const out: string[] = [];
    for (const tool of buildVoiceTools(profile) as Array<Record<string, any>>) {
      const fn = tool.function;
      if (!fn) continue;
      if (typeof fn.description === 'string') out.push(fn.description);
      for (const prop of Object.values(fn.parameters?.properties ?? {})) {
        const d = (prop as any)?.description;
        if (typeof d === 'string') out.push(d);
      }
    }
    return out;
  }

  it('ne dit jamais à l\'agent de DEMANDER quelque chose', () => {
    for (const d of descriptions()) {
      expect(d, d).not.toMatch(/\bask (?:for|them|the caller)\b/i);
      expect(d, d).not.toMatch(/\bdemande[-\s]/i);
    }
  });

  /* « Call this as soon as you have a name » et « Only call once the caller
     agrees » restent: ce sont les règles d'appel de l'outil LUI-MÊME, donc ce
     que la description existe pour dire. Ce qu'on interdit, c'est de détourner
     ce texte en consigne de conversation. */
  it('garde les règles d\'appel de l\'outil, qui sont son objet', () => {
    const lead = buildVoiceTools(profile).find(t => (t as any).function?.name === 'captureLead');
    expect((lead as any).function.description).toMatch(/call this/i);
  });
});
