import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../system-prompt';
import type { CallerHistory, ClientVoiceProfile } from '../realtime-context.service';

/**
 * Limites d'autorité de l'agent.
 *
 * L'agent savait prendre un rendez-vous et répondre; rien ne lui disait ce
 * qu'il n'avait PAS le droit d'engager au nom du client. Un accueil humain
 * sait qu'il n'accorde pas de remise et ne prend pas de carte au téléphone;
 * c'est un savoir implicite qu'un modèle n'a pas, et un appelant insistant
 * obtient facilement un « oui » d'un assistant conçu pour être serviable.
 */

const base: ClientVoiceProfile = {
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
  calendarConnected: false,
  planType: 'pro',
  characterId: null,
  customVoice: null,
  country: 'FR',
  customLlm: true,
  voiceMode: 'auto',
  hasKnowledgeBase: false,
  recordCalls: true,
};

const noHistory: CallerHistory = {
  previousCalls: 0,
  lastCallAt: null,
  lastSummary: null,
  knownName: null,
  hasUpcomingBooking: false,
};

const promptFor = (language: 'fr' | 'en' | 'nl') =>
  buildSystemPrompt({ ...base, language }, noHistory);

describe('limites d’autorité', () => {
  it('interdit la négociation commerciale dans les trois langues', () => {
    expect(promptFor('fr')).toMatch(/AUTORITÉ/);
    expect(promptFor('fr')).toMatch(/remise/i);
    expect(promptFor('en')).toMatch(/AUTHORITY/);
    expect(promptFor('en')).toMatch(/discount/i);
    expect(promptFor('nl')).toMatch(/BEVOEGDHEID/);
    expect(promptFor('nl')).toMatch(/korting/i);
  });

  it('interdit de demander des coordonnées bancaires', () => {
    expect(promptFor('fr')).toMatch(/carte/i);
    expect(promptFor('en')).toMatch(/card details/i);
  });

  it('interdit les conseils médicaux, juridiques et financiers', () => {
    expect(promptFor('fr')).toMatch(/médical.*juridique.*financier/i);
  });

  it('offre une porte de sortie plutôt qu’un simple refus', () => {
    // Un refus sec fait raccrocher. La règle doit renvoyer vers l'équipe et
    // proposer rappel ou transfert, sinon elle coûte des rendez-vous.
    const fr = promptFor('fr');
    expect(fr).toMatch(/rappel/i);
    expect(fr).toMatch(/transfert/i);
  });

  it('reste AVANT la clause SÉCURITÉ, donc après les consignes du client', () => {
    /* L'ordre porte du sens. La règle d'autorité est placée après les
       consignes du client pour qu'un client PUISSE l'élargir explicitement
       (« tu peux confirmer nos tarifs affichés »), tandis que la clause
       anti-injection reste la dernière et prime sur tout. Inverser les deux
       rendrait l'autorité non paramétrable, ou la sécurité désarmable. */
    const fr = promptFor('fr');
    expect(fr.indexOf('AUTORITÉ')).toBeGreaterThan(-1);
    expect(fr.indexOf('SÉCURITÉ')).toBeGreaterThan(fr.indexOf('AUTORITÉ'));
  });
});
