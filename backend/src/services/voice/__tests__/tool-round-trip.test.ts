import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { callSessionStore } from '../call-session.store';
import { hasToolCallDelta } from '../llm-stream.service';
import { hopBreakdown } from '../call-audit';

/**
 * L'ALLER-RETOUR BACKEND ↔ VAPI, RENDU DÉCOMPOSABLE (22/09/2026).
 *
 * Relevé sur deux appels réels et sept appariements d'outils: Vapi compte
 * ~2 s pour un outil dont notre exécution fait ~400 ms. L'écart était noté
 * « aller-retour réseau » — en le disant PLAFOND, mais en appelant quand même
 * le déménagement de la région.
 *
 * Or il contient au moins trois choses qui ne se réparent pas au même endroit,
 * et l'une d'elles est le TOUR DE MODÈLE SUIVANT (1513 ms de médiane sur le
 * même appel), auquel cas la région n'y peut rien. Ces cas figent la mesure
 * qui permet enfin de les distinguer.
 */

const base = { vapiCallId: 'rt_1', clientId: 'c1', callerNumber: '+32475000000', language: 'fr' as const };
const chunk = (delta: Record<string, unknown>) =>
  `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`;

describe('hasToolCallDelta — dater le départ de l\'appel d\'outil', () => {
  it('voit un appel d\'outil dans la tranche', () => {
    expect(hasToolCallDelta(chunk({ tool_calls: [{ index: 0, function: { name: 'lookupBooking' } }] }))).toBe(true);
  });

  it('ignore le texte ordinaire, qui est l\'immense majorité des tranches', () => {
    expect(hasToolCallDelta(chunk({ content: 'Un instant' }))).toBe(false);
    expect(hasToolCallDelta('data: [DONE]\n\n')).toBe(false);
    expect(hasToolCallDelta('')).toBe(false);
  });

  it('une liste VIDE n\'est pas un appel d\'outil', () => {
    /* OpenAI clôt le tour avec `tool_calls` en `finish_reason`, sans delta:
       compter cette tranche daterait la FIN de l'émission au lieu du début. */
    expect(hasToolCallDelta(chunk({ tool_calls: [] }))).toBe(false);
  });

  it('une tranche coupée en deux ne fait pas tomber la boucle', () => {
    expect(hasToolCallDelta('data: {"choices":[{"delta":{"tool_ca')).toBe(false);
  });
});

describe('la borne d\'émission, posée et consommée', () => {
  beforeEach(() => callSessionStore.reset());

  it('la PREMIÈRE tranche du tour fait foi, pas la dernière', () => {
    /* Les suivantes portent les arguments morceau par morceau: prendre la
       dernière mesurerait la génération des arguments, pas le trajet. */
    callSessionStore.start(base);
    callSessionStore.markToolEmitted('rt_1', 1_000);
    callSessionStore.markToolEmitted('rt_1', 1_400);
    expect(callSessionStore.takeToolEmittedAt('rt_1', 1_600)).toBe(1_000);
  });

  it('se consomme: elle ne vaut que pour l\'aller-retour qui la suit', () => {
    callSessionStore.start(base);
    callSessionStore.markToolEmitted('rt_1', 1_000);
    expect(callSessionStore.takeToolEmittedAt('rt_1', 1_200)).toBe(1_000);
    expect(callSessionStore.takeToolEmittedAt('rt_1', 1_300)).toBeNull();
  });

  it('PÉRIMÉE, une borne ne mesure plus rien', () => {
    /* Un tour qui émet un appel d'outil dont la requête n'arrive jamais (Vapi
       abandonne, l'appel se coupe) laisserait sa borne en place, et le PROCHAIN
       outil mesurerait son trajet depuis ce tour-là: des durées impossibles qui
       ont l'air de mesures, exactement la dérive de `llmFirstDeltaAt`. */
    callSessionStore.start(base);
    callSessionStore.markToolEmitted('rt_1', 1_000);
    expect(callSessionStore.takeToolEmittedAt('rt_1', 1_000 + 31_000)).toBeNull();
  });

  it('sans session, on ne conclut rien', () => {
    expect(callSessionStore.takeToolEmittedAt('inconnu', 5)).toBeNull();
    expect(callSessionStore.takeToolEmittedAt(null, 5)).toBeNull();
  });
});

describe('hopBreakdown — de quoi les deux secondes sont faites', () => {
  it('rend le trajet et notre overhead séparément', () => {
    const b = hopBreakdown(
      [
        { name: 'lookupBooking', dispatchMs: 700, handlerMs: 1_100 },
        { name: 'checkAvailability', dispatchMs: 900, handlerMs: 1_300 },
      ],
      [{ name: 'lookupBooking', ms: 900 }, { name: 'checkAvailability', ms: 1_100 }],
    );
    /* `median` du dépôt prend `sorted[floor(n/2)]`, sans interpoler: sur un
       nombre pair c'est la valeur HAUTE. Écrit ici parce que je l'avais
       supposée moyenne et que le test est tombé sur ma supposition. */
    expect(b).toEqual({ dispatchMs: 900, overheadMs: 200, samples: 2 });
  });

  it('sans borne d\'émission, le trajet est `null` et non zéro', () => {
    /* En parole-à-parole le modèle est chez Vapi: l'émission ne passe pas par
       nous et cette borne ne peut PAS exister. Rendre 0 se lirait « Vapi est à
       côté », c'est-à-dire l'inverse de ce qu'on sait. */
    const b = hopBreakdown(
      [{ name: 'lookupBooking', dispatchMs: null, handlerMs: 900 }],
      [{ name: 'lookupBooking', ms: 800 }],
    );
    expect(b!.dispatchMs).toBeNull();
    expect(b!.overheadMs).toBe(100);
  });

  it('un overhead NÉGATIF se tait au lieu de s\'afficher', () => {
    /* Soustraction de deux médianes sur des listes de longueurs différentes:
       négatif, le nombre ne veut rien dire, et un nombre qui ne veut rien dire
       a quand même l'air d'une mesure. */
    const b = hopBreakdown(
      [{ name: 'lookupBooking', dispatchMs: 50, handlerMs: 100 }],
      [{ name: 'lookupBooking', ms: 400 }],
    );
    expect(b!.overheadMs).toBeNull();
  });

  it('sans relevé du tout, rien', () => {
    expect(hopBreakdown(undefined, [{ name: 'x', ms: 1 }])).toBeNull();
    expect(hopBreakdown([], undefined)).toBeNull();
  });
});

/**
 * LA MESURE ATTEINT-ELLE UN APPEL RÉEL ?
 *
 * C'est le défaut que ce dépôt a payé le plus souvent: un mécanisme construit,
 * testé, et branché sur un chemin que personne n'emprunte. Une mesure dans ce
 * cas est pire qu'absente — elle rend `null` pour toujours, et on en conclut
 * que le phénomène n'existe pas.
 *
 * Les commentaires sont retirés AVANT de lire: celui qui explique un correctif
 * nomme forcément la forme fautive, et le test tomberait sur sa propre
 * explication.
 */
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (f: string) => stripComments(readFileSync(join(__dirname, f), 'utf8'));

describe('la décomposition est BRANCHÉE, des deux bouts', () => {
  it('`llm-stream` date le départ dans la boucle de flux', () => {
    const src = read('../llm-stream.service.ts');
    expect(src).toMatch(/hasToolCallDelta\(text\)/);
    expect(src).toMatch(/markToolEmitted/);
  });

  it('les DEUX routes passent l\'heure de réception', () => {
    /* La route dédiée ET la route générale: un outil qui arrive par la seconde
       (ligne partagée, assistant pas encore resynchronisé) est justement celui
       qui fait la queue derrière la télémétrie, donc le plus lent. Le mesurer
       sur un seul chemin laisserait l'autre dans le noir. */
    const src = read('../../../controllers/voice-webhook.controller.ts');
    expect(src).toMatch(/handleToolCalls\(clientId, req\.body as VapiEvent, started\)/);
    expect(src).toMatch(/handleToolCalls\(clientId, event, receivedAt\)/);
  });

  it('l\'orchestrateur consigne le relevé ET le fait voyager', () => {
    const src = read('../realtime-orchestrator.service.ts');
    expect(src).toMatch(/recordToolDispatch/);
    /* Consigné mais pas persisté, il meurt avec le processus et l'audit ne le
       voit jamais: c'est le même angle mort que `costBreakdown`, écrit en base
       et jamais ouvert par aucun lecteur. */
    expect(src).toMatch(/toolDispatch: session\.toolDispatch/);
  });

  it('la borne est consommée AVANT que la session puisse être refaite', () => {
    /* `handleToolCalls` recrée la session quand elle manque (appel qui a
       traversé un déploiement). Une session recréée naît sans borne: lire
       après rendrait `null` sur tous ces appels-là. */
    const src = read('../realtime-orchestrator.service.ts');
    const take = src.indexOf('takeToolEmittedAt');
    const recreate = src.indexOf('session recréée sur tool-calls');
    expect(take).toBeGreaterThan(-1);
    expect(recreate).toBeGreaterThan(-1);
    expect(take).toBeLessThan(recreate);
  });
});
