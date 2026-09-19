import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

vi.mock('../../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { callSessionStore } from '../call-session.store';
import { moodPromptBlock } from '../caller-mood';

/**
 * L'HUMEUR ÉTAIT MESURÉE ET JAMAIS LUE (19/09/2026).
 *
 * `assessMood` tourne à chaque tour de l'appelant, escalade, et écrit
 * `[Voice] caller mood → upset` dans les journaux. `moodPromptBlock`, qui dit
 * au modèle comment parler à quelqu'un d'énervé, n'avait qu'UN consommateur:
 * `llm-stream`, qui le repose à chaque tour du chemin custom-LLM.
 *
 * Or `llm-stream` ne tourne PAS en parole-à-parole, ni chez un client dont
 * `customLlm` est éteint (6quaterquadragesies). Sur ces chemins, un appelant
 * énervé recevait donc exactement le même accueil qu'un appelant calme, et
 * tout ce qui a été écrit dans ce module partait dans le vide.
 *
 * C'est la même famille que le brief d'ouverture, et c'est le même canal qui
 * la répare: `add-message` sur l'adresse de contrôle, le seul qui ait été VU
 * atteindre un appel réel sur ce chemin.
 */

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const orchestrator = stripComments(
  readFileSync(join(__dirname, '../realtime-orchestrator.service.ts'), 'utf8'),
);

describe('le bloc d\'humeur atteint l\'appel', () => {
  it('part quand l\'humeur CHANGE, et sans être attendu', () => {
    /* `handleTranscript` est du côté où l'appelant n'attend rien: un `await`
       y serait de la contre-pression sur le chemin audio. */
    expect(orchestrator).toMatch(/void postMoodNudge\(session\.clientId, vapiCallId, assessed\.mood, session\.language\)/);
    expect(orchestrator).not.toMatch(/await postMoodNudge/);
  });

  it('lit `needsCallBrief`, et pas une seconde règle écrite à la main', () => {
    /* Deux règles écrites à la main pour la même question divergent en moins
       d'un mois (6vicies). Celle-ci est « `llm-stream` tourne-t-il ? », et le
       brief d'ouverture la pose déjà. La reposer ici ferait, sur le chemin
       custom-LLM, compter le bloc DEUX fois. */
    const body = orchestrator.slice(
      orchestrator.indexOf('async function postMoodNudge'),
      orchestrator.indexOf('export async function postCallBrief'),
    );
    expect(body).toMatch(/needsCallBrief\(profile\)/);
    expect(body).not.toMatch(/voiceTier|speechToSpeech|voiceMode/);
  });

  it('passe par l\'adresse de contrôle retenue, pas par l\'événement du tour', () => {
    /* Un événement de transcript ne porte pas forcément `call.monitor`, et
       « SANS ADRESSE DE CONTROLE » est un mode d'échec déjà relevé sur le
       brief. L'adresse est donc retenue à l'ouverture. */
    expect(orchestrator).toMatch(/callSessionStore\.noteControlUrl\(vapiCallId, controlUrlOf\(event\)\)/);
    const body = orchestrator.slice(orchestrator.indexOf('async function postMoodNudge'));
    expect(body).toMatch(/callSessionStore\.controlUrlFor\(vapiCallId\)/);
  });

  it('consigne son issue, sinon rien ne dirait qu\'il a atteint un appel', () => {
    /* La règle du dépôt: un mécanisme qui n'a jamais été VU atteindre un appel
       réel n'est pas prouvé (6octovicies). Et sans l'issue, « il m'a parlé
       comme un robot alors que j'étais énervé » ne distingue pas le bloc qui
       n'est pas parti du bloc parti que le modèle ignore. */
    expect(orchestrator).toMatch(/noteMoodNudge\(vapiCallId, `pose \(\$\{mood\}\)`\)/);
    expect(orchestrator).toMatch(/noteMoodNudge\(vapiCallId, 'SANS ADRESSE DE CONTROLE'\)/);
    expect(orchestrator).toMatch(/moodNudge: session\.moodNudge/);
  });
});

/**
 * LE NÉERLANDAIS TOMBAIT DANS LA BRANCHE ANGLAISE.
 *
 * `fr ? ... : ...` n'a que deux issues, et `nl` est une langue servie. Un
 * client flamand recevait donc un bloc ANGLAIS posé au milieu d'une
 * conversation néerlandaise, ce qui est exactement ce qui fait basculer le
 * modèle vers l'anglais quand il perd le fil (6novoquinquagesies).
 */
describe('le bloc d\'humeur parle la langue de l\'appel', () => {
  it('rend du néerlandais pour un appelant mécontent', () => {
    const block = moodPromptBlock('upset', 'nl');
    expect(block).toMatch(/TOESTAND VAN DE BELLER/);
    expect(block).not.toMatch(/CALLER STATE|ETAT DU CORRESPONDANT/);
  });

  it('rend du néerlandais pour un appelant pressé', () => {
    const block = moodPromptBlock('rushed', 'nl');
    expect(block).toMatch(/gehaast/);
    expect(block).not.toMatch(/in a hurry|presse/);
  });

  it('ne dit rien sur un appel ordinaire', () => {
    /* `neutral` rend une chaîne vide, et c'est l'état normal: le prompt décrit
       déjà le registre par défaut. Poser un message pour le redire coûterait
       un aller-retour sur chaque appel du monde. */
    for (const lang of ['fr', 'en', 'nl'] as const) {
      expect(moodPromptBlock('neutral', lang)).toBe('');
    }
  });
});

describe('l\'adresse de contrôle retenue', () => {
  const base = { vapiCallId: 'call_mood', clientId: 'client_1', callerNumber: '+32475123456', language: 'fr' as const };
  beforeEach(() => callSessionStore.reset());

  it('se retient, et ne se perd pas sur un événement qui ne la porte pas', () => {
    callSessionStore.start(base);
    callSessionStore.noteControlUrl('call_mood', 'https://vapi.example/control/abc');
    /* Un `transcript` sans `call.monitor` passe ici avec `null`: écraser
       rendrait muet tout ce qui parle au modèle après l'accueil. */
    callSessionStore.noteControlUrl('call_mood', null);
    expect(callSessionStore.controlUrlFor('call_mood')).toBe('https://vapi.example/control/abc');
  });

  it('vaut `null` tant que rien ne l\'a portée', () => {
    callSessionStore.start(base);
    expect(callSessionStore.controlUrlFor('call_mood')).toBeNull();
    expect(callSessionStore.controlUrlFor('inconnu')).toBeNull();
  });
});
