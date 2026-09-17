import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

vi.mock('../../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { callBrief } from '../call-brief';
import { needsCallBrief } from '../profile-voice';
import type { CallerHistory, ClientVoiceProfile } from '../realtime-context.service';

/**
 * LE BRIEF D'OUVERTURE (17/09/2026).
 *
 * « Il ne se souvient pas de moi grâce à mon numéro », sur un appel réel en
 * parole-à-parole, et le code disait exactement ça: le prompt de l'assistant
 * ENREGISTRÉ est figé à la synchronisation, donc il naît avec un historique
 * vide; `llm-stream` le rattrape à chaque tour sur le chemin custom-LLM, et
 * `llm-stream` ne tourne pas ici.
 */

const history = (over: Partial<CallerHistory> = {}): CallerHistory => ({
  previousCalls: 3,
  lastCallAt: '2026-09-10T09:00:00.000Z',
  lastSummary: 'Voulait déplacer un détartrage.',
  knownName: 'Jean-Luc de la Forge',
  hasUpcomingBooking: true,
  upcomingBookings: [
    { name: 'Jean-Luc de la Forge', date: '2027-03-22', time: '17:00', service: 'detartrage' },
  ],
  ...over,
});

const profile = { language: 'fr' as const, timezone: 'Europe/Brussels' };
const at = new Date('2026-09-17T07:12:00.000Z');

describe('callBrief', () => {
  it("porte le nom de l'appelant connu, pour qu'il n'ait pas à se présenter", () => {
    const brief = callBrief(profile, history(), at);
    expect(brief).toMatch(/Jean-Luc de la Forge/);
    expect(brief).toMatch(/3 fois/);
  });

  it("porte une VRAIE date, calculée à l'instant, et la dit faisant foi", () => {
    const brief = callBrief(profile, history(), at);
    /* Pas le gabarit `{{"now" | date: …}}` de l'assistant enregistré: ce
       mécanisme n'a jamais été vu tenir dans une session temps réel, et une
       date calculée ici ne dépend de personne. */
    expect(brief).not.toMatch(/\{\{/);
    expect(brief).toMatch(/jeudi 17 septembre 2026/);
    expect(brief).toMatch(/fait foi/);
  });

  it("n'est JAMAIS vide, même pour un appelant inconnu: la date vaut pour tout le monde", () => {
    /* Un mécanisme qui ne s'exercerait que sur un appelant connu resterait
       endormi jusqu'au jour où on compte dessus (6octovicies). */
    const brief = callBrief(profile, null, at);
    expect(brief).toMatch(/jeudi 17 septembre 2026/);
    expect(brief).not.toMatch(/HISTORIQUE/);
  });

  it("dit au modèle de ne PAS répondre: ce n'est pas l'appelant qui parle", () => {
    expect(callBrief(profile, null, at)).toMatch(/ne réponds pas à ce message/);
  });

  it('suit la langue du profil', () => {
    const nl = callBrief({ language: 'nl', timezone: 'Europe/Brussels' }, history(), at);
    expect(nl).toMatch(/CONTEXT VAN DIT GESPREK/);
    expect(nl).toMatch(/GESCHIEDENIS/);
  });
});

const prof = (over: Partial<ClientVoiceProfile>): ClientVoiceProfile =>
  ({ language: 'fr', customLlm: true, voiceTier: null, voiceMode: 'classic', customVoice: null, ...over }) as ClientVoiceProfile;

/**
 * LES RENDEZ-VOUS SE DISENT, ILS NE SE FONT PAS CHERCHER (17/09/2026).
 *
 * Appel réel de 161 s: l'appelant veut déplacer un rendez-vous, son numéro le
 * désigne, `lookupBooking` n'est JAMAIS appelé, le modèle consulte QUATRE fois
 * les créneaux et cherche en septembre 2026 une réservation de mars 2027.
 * L'appelant: « tu as mon numéro de téléphone, tu as simplement à aller
 * chercher dans ta base de données ». Il a raison, et en parole-à-parole le
 * modèle est trop faible sur l'appel d'outils pour qu'on lui demande d'en
 * appeler un pour savoir qui appelle.
 */
describe('le brief porte les rendez-vous, en clair', () => {
  it('les nomme avec leur date ET leur année', () => {
    const brief = callBrief(profile, history(), at);
    /* L'année est le point: « 22 mars 2027 » entendu, puis cherché au
       22 septembre 2026, deux fois dans le même appel. */
    expect(brief).toMatch(/22 mars 2027/);
    expect(brief).toMatch(/17:00/);
  });

  it("dit au modèle de ne PAS les faire chercher, et donne la suite exacte", () => {
    const brief = callBrief(profile, history(), at);
    expect(brief).toMatch(/ne les fais pas chercher/);
    expect(brief).toMatch(/checkAvailability/);
    expect(brief).toMatch(/rescheduleBooking/);
    expect(brief).toMatch(/currentDate/);
  });

  it("se tait quand il n'y a rien: pas de section vide à interpréter", () => {
    const brief = callBrief(profile, history({ upcomingBookings: [], hasUpcomingBooking: false }), at);
    expect(brief).not.toMatch(/RENDEZ-VOUS DEJA PRIS/);
  });

  it('une date illisible ne casse pas le brief', () => {
    const brief = callBrief(profile, history({ upcomingBookings: [{ name: 'X', date: 'n/a', time: null, service: null }] }), at);
    expect(brief).toMatch(/RENDEZ-VOUS DEJA PRIS/);
    expect(brief).toMatch(/n\/a/);
  });
});

describe('needsCallBrief', () => {
  it('le parole-à-parole en a besoin: Vapi parle à OpenAI, `llm-stream` ne tourne pas', () => {
    expect(needsCallBrief(prof({ voiceTier: 'superagent', superagentAllowed: true } as any))).toBe(true);
  });

  it("un client dont le LLM personnalisé est éteint aussi: même cause, Vapi appelle OpenAI lui-même", () => {
    expect(needsCallBrief(prof({ customLlm: false }))).toBe(true);
  });

  it("la chaîne custom-LLM n'en a pas besoin: `llm-stream` repose le bloc à chaque tour", () => {
    expect(needsCallBrief(prof({ customLlm: true }))).toBe(false);
  });
});

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('le brief est branché sur l\'ouverture de l\'appel', () => {
  const src = stripComments(readFileSync(join(__dirname, '../realtime-orchestrator.service.ts'), 'utf8'));

  it("part à l'ouverture, sans être attendu: l'appelant écoute l'accueil", () => {
    expect(src).toMatch(/if \(profile && needsCallBrief\(profile\)\) void postCallBrief\(clientId, event, profile\)/);
    expect(src).not.toMatch(/await postCallBrief/);
  });

  it('pose le message en SILENCE, sinon il couperait l\'accueil pour dire bonjour deux fois', () => {
    const vapi = stripComments(readFileSync(join(__dirname, '../../../config/vapi.ts'), 'utf8'));
    expect(vapi).toMatch(/type: 'add-message'/);
    expect(vapi).toMatch(/triggerResponseEnabled: false/);
  });

  it("un historique illisible ne fait pas sauter la DATE: c'est elle qui a coûté le plus cher", () => {
    const body = src.slice(src.indexOf('export async function postCallBrief'));
    /* `.catch(() => null)` sur l'historique, puis le brief posé quand même:
       `callBrief` accepte `null` et garde l'horloge. */
    expect(body).toMatch(/getCallerHistory[\s\S]{0,160}catch\(\(\) => null\)/);
    expect(body).toMatch(/callBrief\(profile, caller\)/);
  });
});
