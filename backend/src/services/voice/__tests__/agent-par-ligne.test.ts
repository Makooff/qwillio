import { describe, it, expect } from 'vitest';
import { applyLineAgent } from '../realtime-orchestrator.service';
import { lineAgentOf, type LineAgent } from '../inbound-routing.service';
import type { ClientVoiceProfile } from '../realtime-context.service';

/**
 * Un agent par ligne téléphonique.
 *
 * `client_phone_numbers.label` existait déjà, et `inbound-routing` calculait
 * même un `lineLabel`... qu'il JETAIT: il n'atteignait jamais le prompt. Un
 * garage avec une ligne atelier et une ligne vente avait le même agent sur les
 * deux, et l'agent ne savait pas laquelle avait sonné.
 *
 * Ce qui se paie cher ici, c'est de servir l'agent d'une ligne sur une autre.
 * Ces tests portent d'abord là-dessus.
 */

const base = {
  clientId: 'c1',
  businessName: 'Garage Martin',
  businessType: 'garage',
  agentName: 'Camille',
  language: 'fr',
  timezone: 'Europe/Brussels',
  transferNumber: '+3225550001',
  transferMode: 'always',
  instructions: 'Toujours vouvoyer.',
  services: [],
  openingHours: null,
  bookingEnabled: true,
  calendarConnected: false,
  planType: 'solo',
  characterId: 'camille',
  customVoice: null,
  country: 'BE',
  customLlm: true,
  voiceMode: 'auto',
  hasKnowledgeBase: false,
} as unknown as ClientVoiceProfile;

describe('la surcharge ne s\'applique QUE si la ligne la porte', () => {
  it('rend exactement le profil du client quand la ligne ne règle rien', () => {
    /* La garantie de non-régression: les clients existants ont des lignes sans
       aucun de ces champs, et leur réceptionniste ne doit pas bouger d'un iota. */
    expect(applyLineAgent(base, {})).toEqual(base);
  });

  it('ne fabrique pas de surcharge à partir de champs vides', () => {
    // Une chaîne vide en base est un champ NON réglé, pas un nom d'agent vide:
    // l'appliquer donnerait un agent sans nom.
    expect(lineAgentOf({ label: '', agentName: null, greeting: undefined })).toBeUndefined();
    expect(lineAgentOf(null)).toBeUndefined();
    expect(lineAgentOf({ label: 'Boutique Ixelles' })).toEqual({ label: 'Boutique Ixelles' });
  });
});

describe('ce que la ligne redéfinit', () => {
  const atelier: LineAgent = {
    label: 'Atelier',
    agentName: 'Léo',
    transferNumber: '+3225559999',
    characterId: 'leo',
  };

  it("annonce le nom de la LIGNE, pas celui de l'entreprise", () => {
    /* C'est la première seconde de l'appel, et la seule chose que l'appelant
       entend tout de suite: « Atelier, bonjour » et non « Garage Martin ». */
    expect(applyLineAgent(base, atelier).businessName).toBe('Atelier');
  });

  it('bascule vers le téléphone de CETTE ligne', () => {
    // Un atelier et un service commercial ne décrochent pas au même endroit.
    expect(applyLineAgent(base, atelier).transferNumber).toBe('+3225559999');
    // Et la ligne qui ne le règle pas garde celui du client.
    expect(applyLineAgent(base, { label: 'Vente' }).transferNumber).toBe('+3225550001');
  });

  it('change le nom et la voix de l\'agent', () => {
    const p = applyLineAgent(base, atelier);
    expect(p.agentName).toBe('Léo');
    expect(p.characterId).toBe('leo');
  });

  it('AJOUTE les consignes de la ligne, sans effacer celles du client', () => {
    /* Une ligne dit ce qui lui est propre (« ici on ne prend que les
       urgences »), pas tout ce que l'entreprise a déjà écrit. Remplacer ferait
       perdre le vouvoiement, les tarifs, et tout le reste. */
    const p = applyLineAgent(base, { instructions: 'Ici, urgences seulement.' });
    expect(p.instructions).toContain('Toujours vouvoyer.');
    expect(p.instructions).toContain('Ici, urgences seulement.');
  });

  it('remplace le reste, parce qu\'un nom ne se cumule pas', () => {
    const p = applyLineAgent(base, { agentName: 'Léo' });
    expect(p.agentName).toBe('Léo');
    expect(p.agentName).not.toContain('Camille');
  });
});

describe('ce qui servirait le mauvais agent', () => {
  it('ne modifie JAMAIS le profil reçu', () => {
    /* Le contexte est mis en cache PAR CLIENT. Muter le profil ici servirait
       l'agent de la boutique d'Ixelles au prochain appel arrivé sur la ligne
       des urgences, et la panne ne se verrait qu'au deuxième appel. */
    const avant = JSON.stringify(base);
    applyLineAgent(base, { label: 'Ixelles', agentName: 'Sofia', instructions: 'X' });
    expect(JSON.stringify(base)).toBe(avant);
  });

  it('deux lignes du même client donnent deux agents distincts', () => {
    const a = applyLineAgent(base, { label: 'Atelier', agentName: 'Léo' });
    const b = applyLineAgent(base, { label: 'Vente', agentName: 'Sofia' });

    expect(a.businessName).toBe('Atelier');
    expect(b.businessName).toBe('Vente');
    expect(a.agentName).not.toBe(b.agentName);
  });

  it('garde le client, la langue et le métier: la ligne change de VISAGE, pas de propriétaire', () => {
    // `clientId` décide de l'agenda lu, du CRM écrit et de la facturation. Une
    // surcharge de ligne qui pourrait le toucher casserait le cloisonnement.
    const p = applyLineAgent(base, { label: 'Atelier', agentName: 'Léo' } as LineAgent);
    expect(p.clientId).toBe('c1');
    expect(p.language).toBe('fr');
    expect(p.businessType).toBe('garage');
  });
});
