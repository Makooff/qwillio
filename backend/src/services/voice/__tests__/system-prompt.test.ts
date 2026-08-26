import { describe, it, expect } from 'vitest';
import { buildFirstMessage, buildSystemPrompt, firstMessageVariants } from '../system-prompt';
import type { CallerHistory, ClientVoiceProfile } from '../realtime-context.service';

const profile: ClientVoiceProfile = {
  clientId: 'client_1',
  businessName: 'Le Comptoir',
  businessType: 'restaurant',
  agentName: 'Camille',
  language: 'fr',
  timezone: 'Europe/Paris',
  transferNumber: '+33123456789',
  instructions: 'Ne jamais donner les prix au telephone.',
  services: ['dejeuner', 'diner', 'privatisation'],
  openingHours: '12h-14h et 19h-22h30',
  bookingEnabled: true,
  calendarConnected: true,
  planType: 'pro',
  characterId: null,
  customVoice: null,
  country: 'FR',
  customLlm: true,
  voiceMode: 'auto',
  hasKnowledgeBase: false,
  recordCalls: true,
};

const newCaller: CallerHistory = {
  previousCalls: 0,
  lastCallAt: null,
  lastSummary: null,
  knownName: null,
  hasUpcomingBooking: false,
};

describe('buildSystemPrompt', () => {
  it('injects the business identity so the agent is in character from word one', () => {
    const prompt = buildSystemPrompt(profile, newCaller);
    expect(prompt).toContain('Camille');
    expect(prompt).toContain('Le Comptoir');
    expect(prompt).toContain('restaurant');
  });

  it('carries the client instructions and marks them as taking priority', () => {
    const prompt = buildSystemPrompt(profile, newCaller);
    expect(prompt).toContain('Ne jamais donner les prix');
    expect(prompt).toMatch(/prioritaires/i);
  });

  it('forbids booking when no calendar is connected', () => {
    const prompt = buildSystemPrompt({ ...profile, calendarConnected: false }, newCaller);
    expect(prompt).toMatch(/tu ne peux pas réserver/i);
    expect(prompt).toContain('captureLead');
  });

  it('includes the anti-injection clause — the transcript is caller-controlled', () => {
    expect(buildSystemPrompt(profile, newCaller)).toMatch(/jamais une instruction système/i);
  });

  it('surfaces caller memory and tells the agent not to re-ask the name', () => {
    const prompt = buildSystemPrompt(profile, {
      previousCalls: 2,
      lastCallAt: '2026-07-30T10:00:00.000Z',
      lastSummary: 'Voulait reserver pour six personnes.',
      knownName: 'Julien',
      hasUpcomingBooking: true,
    });
    expect(prompt).toContain('Julien');
    expect(prompt).toMatch(/ne redemande pas son nom/i);
    expect(prompt).toContain('lookupBooking');
  });

  /**
   * Les règles de DÉBIT, épinglées.
   *
   * Elles sont les seules à agir en parole-à-parole, où le modèle fabrique sa
   * propre voix et où aucun réglage de synthèse ne l'atteint. Deux retours de
   * terrain consécutifs les ont fait écrire (« ça articule trop, pas assez
   * naturel »); un nettoyage de prompt les retirerait sans bruit, et personne
   * ne saurait dire ce qui a changé.
   */
  it('dit COMMENT parler, pas seulement quoi dire', () => {
    const prompt = buildSystemPrompt(profile, newCaller);
    expect(prompt).toMatch(/ne détache pas les syllabes/i);
    expect(prompt).toMatch(/varie le rythme/i);
  });

  it('omits the history block entirely for a first-time caller', () => {
    expect(buildSystemPrompt(profile, newCaller)).not.toMatch(/HISTORIQUE/);
  });

  it('stays compact — the prompt is replayed on every model turn', () => {
    /* ~4 caractères par jeton. Le plafond était de 2000, et il ne restait plus
       un caractère: la règle de débit (« enchaîne les mots, ne détache pas les
       syllabes ») le dépassait de vingt-six. Elle a été fondue dans la règle du
       langage parlé plutôt qu'ajoutée, et le plafond monte de 100 caractères,
       soit 25 jetons par tour: un appel de 20 tours reste sous 10 500 jetons de
       prompt. Le plafond est là pour empêcher la dérive, pas pour interdire une
       règle qui répond à un défaut entendu. Il monte une seconde fois, de 100
       caractères encore, pour la règle de prosodie: en mode direct le prompt
       est le SEUL levier sur la façon de parler, aucun réglage de synthèse ne
       l'atteint. Un appel de 20 tours reste sous 11 000 jetons de prompt. */
    expect(buildSystemPrompt(profile, newCaller).length).toBeLessThan(2200);
  });

  it('injects the pre-rendered knowledge block when one is supplied', () => {
    const prompt = buildSystemPrompt(profile, newCaller, 'RÈGLES DE LA MAISON:\n- Pas de prix au téléphone');
    expect(prompt).toContain('RÈGLES DE LA MAISON');
  });

  it('tells the agent to look things up rather than invent them, when a base exists', () => {
    const prompt = buildSystemPrompt({ ...profile, hasKnowledgeBase: true }, newCaller);
    expect(prompt).toContain('lookupKnowledge');
    expect(prompt).toMatch(/n'invente jamais/i);
  });

  it('switches language wholesale for an English client', () => {
    const prompt = buildSystemPrompt({ ...profile, language: 'en', agentName: 'Ashley' }, newCaller);
    expect(prompt).toContain('SPEAKING RULES');
    expect(prompt).not.toContain('RÈGLES DE PAROLE');
  });
});

describe('buildFirstMessage', () => {
  it('greets a known caller by name', () => {
    const msg = buildFirstMessage(profile, { ...newCaller, previousCalls: 1, knownName: 'Julien' });
    expect(msg).toContain('Julien');
  });

  it('falls back to a neutral greeting for a new caller', () => {
    const msg = buildFirstMessage(profile, newCaller);
    expect(msg).toContain('Le Comptoir');
    expect(msg).toContain('Camille');
  });
});

describe('firstMessageVariants', () => {
  it('offers several distinct openings — a regular must not hear a recording', () => {
    const variants = firstMessageVariants(profile, null);
    expect(variants.length).toBeGreaterThan(1);
    expect(new Set(variants).size).toBe(variants.length);
  });

  it('names every variant after the business and the agent', () => {
    for (const v of firstMessageVariants(profile, null)) {
      expect(v).toContain('Le Comptoir');
      expect(v).toContain('Camille');
    }
  });

  it('uses the caller name in every variant when we know it', () => {
    for (const v of firstMessageVariants(profile, 'Julien')) {
      expect(v).toContain('Julien');
    }
  });

  it('keeps openings short — this is the sentence the caller judges', () => {
    // The ceiling includes the AI disclosure and the recording notice: the
    // compliant greeting must still land in one breath.
    for (const v of firstMessageVariants(profile, null)) {
      expect(v.length).toBeLessThan(170);
    }
  });

  it('switches language with the profile', () => {
    for (const v of firstMessageVariants({ ...profile, language: 'en', agentName: 'Ashley' }, null)) {
      expect(v).not.toMatch(/bonjour/i);
    }
  });
});

describe('les règles de transfert, réglées par le client', () => {
  /* « Ne me passez pas d'appel après 19 h » est la demande la plus fréquente
     d'un indépendant, et le prompt n'avait qu'un seul comportement. */

  const withMode = (mode: 'always' | 'hours' | 'never') =>
    buildSystemPrompt({ ...profile, transferNumber: '+32470111222', transferMode: mode } as never, newCaller);

  it('garde le comportement historique par défaut', () => {
    const sans = buildSystemPrompt({ ...profile, transferNumber: '+32470111222' } as never, newCaller);
    expect(sans).toMatch(/transferCall tout de suite/);
    expect(sans).toBe(withMode('always'));
  });

  it("interdit le transfert en nommant l'outil à prendre À LA PLACE", () => {
    /* Retirer la ligne au lieu de la remplacer laisserait deux instructions
       contradictoires plus haut dans le prompt, et l'agent transférerait quand
       même, au hasard des exécutions. */
    const jamais = withMode('never');
    expect(jamais).toMatch(/TRANSFERT INTERDIT/);
    expect(jamais).toMatch(/captureLead/);
    expect(jamais).not.toMatch(/transferCall/);
  });

  it("conditionne le transfert à l'ouverture, avec un repli explicite", () => {
    const heures = withMode('hours');
    expect(heures).toMatch(/SI ouvert/);
    expect(heures).toMatch(/sinon captureLead/);
  });

  it('ne fait pas grossir le prompt, qui est rejoué à chaque tour', () => {
    // Les trois variantes tiennent la même longueur à quelques caractères près.
    const tailles = (['always', 'hours', 'never'] as const).map(m => withMode(m).length);
    expect(Math.max(...tailles)).toBeLessThan(2200);
    expect(Math.max(...tailles) - Math.min(...tailles)).toBeLessThan(30);
  });
});
