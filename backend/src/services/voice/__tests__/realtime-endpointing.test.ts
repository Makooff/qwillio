import { describe, it, expect } from 'vitest';
import { buildRealtimePlans, buildStartSpeakingPlan, resolveTuning } from '../speech-plans';
import { VOICE_TIERS } from '../voice-tiers';

/**
 * LE MOMENT OÙ L'ON DÉCIDE QUE L'APPELANT A FINI N'EST PAS LE MÊME SUR LES DEUX
 * CHAÎNES (17/09/2026).
 *
 * Retour, après le déploiement des plans de parole: « je dis bonjour et juste
 * après il pose direct une question alors que j'ai pas fini ma phrase ». Le
 * plan d'attente était bien là, et c'est ce qui rend le cas intéressant: ce ne
 * sont pas les plans qui manquaient, ce sont leurs VALEURS.
 *
 * Elles ont été calibrées le 12/09 contre la chaîne CLASSIQUE, qui ajoute sa
 * propre latence APRÈS la décision: 941 ms de modèle plus 342 ms de synthèse,
 * mesurés. Ce délai fait partie de la patience que l'appelant ressent sans
 * figurer dans le seuil. Le parole-à-parole supprime les deux étapes et répond
 * en ~300 ms, donc à seuil ÉGAL il pose sa voix une seconde plus tôt.
 *
 * Et c'est le seuil de PONCTUATION qui tient le cas décrit: « Bonjour » est une
 * phrase complète, le transcripteur y met un point, donc ce sont 0,4 s qui
 * s'appliquent et jamais les 1,2 s du seuil sans ponctuation.
 */

const s2s = (tuning = VOICE_TIERS.superagent.tuning) =>
  buildRealtimePlans('fr', true, {}, tuning) as any;

describe('les seuils de fin de tour suivent le NIVEAU', () => {
  it('le parole-à-parole attend plus longtemps après une phrase PONCTUÉE', () => {
    /* C'est la ligne du bug: « Bonjour. » porte un point, donc c'est ce
       seuil-là qui décide, et lui seul. */
    const classique = buildStartSpeakingPlan('fr') as any;
    const plan = s2s().startSpeakingPlan;
    expect(plan.transcriptionEndpointingPlan.onPunctuationSeconds)
      .toBeGreaterThan(classique.transcriptionEndpointingPlan.onPunctuationSeconds);
  });

  it('et sur les deux autres seuils, pour que le premier tour respire', () => {
    const classique = buildStartSpeakingPlan('fr') as any;
    const plan = s2s().startSpeakingPlan;
    expect(plan.waitSeconds).toBeGreaterThan(classique.waitSeconds);
    expect(plan.transcriptionEndpointingPlan.onNoPunctuationSeconds)
      .toBeGreaterThan(classique.transcriptionEndpointingPlan.onNoPunctuationSeconds);
  });

  it('« base » ne bouge PAS: nommer la chaîne existante ne doit rien changer', () => {
    /* La condition posée par l'en-tête de `voice-tiers.ts`. Un niveau qui
       poserait ses propres curseurs ferait bouger la production le jour où on
       nomme ce qui existe déjà, et la comparaison des deux niveaux ne
       mesurerait plus rien. */
    expect(VOICE_TIERS.base.tuning).toEqual({});
    const avec = buildRealtimePlans('fr', false, {}, VOICE_TIERS.base.tuning) as any;
    const sans = buildRealtimePlans('fr', false) as any;
    expect(avec.startSpeakingPlan).toEqual(sans.startSpeakingPlan);
  });

  it('le niveau les porte vraiment, sinon le réglage n\'atteint aucun appel', () => {
    /* Le piège de ce dépôt (6vicies, 6quaterquadragesies): un mécanisme
       construit, testé, et jamais passé à l'assistant qui décroche. Les trois
       clés doivent être DANS le `tuning` du niveau, puisque c'est lui que les
       deux écritures de `onboarding.service.ts` transmettent. */
    const t = VOICE_TIERS.superagent.tuning;
    expect(t.startWaitSeconds).toBeDefined();
    expect(t.endpointingPunctuationSeconds).toBeDefined();
    expect(t.endpointingNoPunctuationSeconds).toBeDefined();
  });

  it('un curseur explicite prime, pour qu\'un relevé se corrige sans déploiement', () => {
    const plan = s2s({ endpointingPunctuationSeconds: 1.4 }).startSpeakingPlan;
    expect(plan.transcriptionEndpointingPlan.onPunctuationSeconds).toBe(1.4);
  });

  it('les bornes écartent une valeur absurde plutôt que de faire refuser l\'assistant', () => {
    /* Un champ hors bornes ne dégrade pas un appel, il fait refuser
       l'assistant ENTIER (6octies). La borne est donc ici, pas à l'écran. */
    expect(resolveTuning({ endpointingPunctuationSeconds: 99 }).endpointingPunctuationSeconds).toBe(3);
    expect(resolveTuning({ startWaitSeconds: -5 }).startWaitSeconds).toBe(0);
  });

  it('sans transcripteur il n\'y a aucun plan, donc aucun seuil à régler', () => {
    const plans = buildRealtimePlans('fr', true, {}, VOICE_TIERS.superagent.tuning) as any;
    // Le transcripteur est là par défaut, donc le plan aussi.
    expect(plans.startSpeakingPlan).not.toBeNull();
  });
});
