import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

vi.mock('../../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { callBrief } from '../call-brief';
import { needsCallBrief, llmStreamRuns } from '../profile-voice';
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

/**
 * UNE règle, DEUX lecteurs qui ne tiennent pas la même chose.
 *
 * Le webhook a le profil du client; l'audit a l'assistant DISTANT, c'est-à-dire
 * ce qui a vraiment décroché. La question est pourtant la même — `llm-stream`
 * tourne-t-il — et ce qu'elle décide déborde du brief: sans lui, PREP, LLM et
 * TTFA n'existent pas non plus. Écrite deux fois, elle divergerait en moins
 * d'un mois et les deux réponses seraient également crédibles (6vicies).
 */
describe('llmStreamRuns', () => {
  it('ne tourne ni en parole-à-parole ni sans custom-LLM', () => {
    expect(llmStreamRuns({ speechToSpeech: true, customLlm: true })).toBe(false);
    expect(llmStreamRuns({ speechToSpeech: true, customLlm: false })).toBe(false);
    expect(llmStreamRuns({ speechToSpeech: false, customLlm: false })).toBe(false);
  });

  it('ne tourne QUE sur la chaîne classique en custom-LLM', () => {
    expect(llmStreamRuns({ speechToSpeech: false, customLlm: true })).toBe(true);
  });

  it("`needsCallBrief` en est la négation, pas une seconde règle", () => {
    const src = stripComments(readFileSync(join(__dirname, '../profile-voice.ts'), 'utf8'));
    expect(src).toMatch(/return !llmStreamRuns\(\{/);
    expect(src).not.toMatch(/speechToSpeech \|\| !profile\.customLlm/);
  });

  it("l'audit la LIT au lieu de la réécrire à la main", () => {
    /* Le code qui lit un champ compte autant que celui qui l'écrit
       (6sexvicies): c'est en réécrivant cette question de son côté que
       l'audit aurait pu conclure autre chose que le webhook sur le même
       appel. */
    const src = stripComments(readFileSync(join(__dirname, '../call-audit.ts'), 'utf8'));
    expect(src).toMatch(/llmStreamRuns\(\{ speechToSpeech:/);
    expect(src).not.toMatch(/speechToSpeech === true \|\| /);
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

/**
 * LE PROMPT FIGÉ DOIT CÉDER AU BRIEF (18/09/2026).
 *
 * « Il ne me reconnaît pas alors que je suis déjà un client dans la base de
 * données et il a mon numéro de téléphone, donc il est censé me reconnaître et
 * pas me redemander mon nom. Et même une fois que je l'ai dit dans l'appel, je
 * ne devrais pas avoir à le dire deux fois. »
 *
 * Sur cet appel, l'audit disait « brief d'ouverture: posé (22 appels, 1 rdv) ».
 * La plomberie marchait donc, et le modèle demandait quand même. La cause est
 * un CONFLIT DE CONSIGNES: le brief arrive comme un MESSAGE de la conversation,
 * `buildSystemPrompt` est l'instruction de SESSION, et une instruction de
 * session gagne contre un message. Tant que le prompt ordonnait « demande-les »
 * sans condition, le modèle demandait.
 *
 * La ligne qui dit laquelle des deux gagne ne peut donc vivre QUE dans le
 * prompt: la mettre dans le brief, ce serait la remettre du côté qui perd —
 * et le brief dit DÉJÀ « Ne redemande ni le nom ni la date actuelle », ce qui
 * n'a pas suffi.
 */
describe('le prompt figé cède au brief sur le nom', () => {
  const src = readFileSync(join(__dirname, '../system-prompt.ts'), 'utf8')
    /* Les commentaires nomment forcément la forme fautive: un test de source
       qui ne les retire pas tombe sur sa propre explication (6vicies). */
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    /* Les apostrophes du source sont échappées (`s\'ils`) parce qu'elles
       vivent dans des chaînes à guillemets simples: sans ça, une règle se
       cherche avec une apostrophe qu'elle ne porte pas. */
    .replace(/\\'/g, "'");

  it("porte la règle qui fait céder le prompt, dans le prompt lui-même", () => {
    expect(src).toMatch(/CONTEXTE DE CET APPEL te donne son nom, il fait foi/);
    expect(src).toMatch(/ne le fais pas épeler/);
  });

  it("n'ordonne plus « demande-les » sans condition", () => {
    /* La forme fautive exacte: le point-virgule qui suivait « demande-les »
       en faisait un impératif inconditionnel, et c'est ce que le modèle a
       exécuté contre le brief. */
    expect(src).not.toMatch(/\(demande-les;/);
    expect(src).toMatch(/demande-les s'ils manquent encore/);
  });

  it("laisse le dernier mot à l'appelant qui dément", () => {
    /* Ne pas REDEMANDER n'est pas refuser une correction. Une consigne absolue
       sur un nom a déjà tenu contre quatre démentis (6octotrigesies), et c'est
       le défaut opposé, aussi coûteux. */
    expect(src).toMatch(/ce n'est pas le sien, il a raison/);
  });

  it("le brief nomme toujours l'appelant, lui, pour que la règle ait un objet", () => {
    const brief = callBrief(
      { language: 'fr', timezone: 'Europe/Brussels' } as ClientVoiceProfile,
      history(),
    );
    expect(brief).toContain('Jean-Luc de la Forge');
    expect(brief).toMatch(/ne redemande pas/i);
  });
});
