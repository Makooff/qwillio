/**
 * Demander à Vapi si l'assistant qu'on lui enverrait est acceptable.
 *
 *   npm run voice:validate            # interroge vraiment Vapi
 *   npm run voice:validate -- --dry   # imprime la charge, n'appelle personne
 *
 * ## Pourquoi ce script existe
 *
 * Un champ inconnu ne dégrade pas un appel: il fait refuser l'assistant
 * ENTIER, avec un 400 dont le message nomme le champ fautif. Tous les appels
 * de la flotte tombent alors d'un coup, et le seul endroit où l'on voit
 * pourquoi est la réponse de Vapi — qui n'est lue par personne, puisque le
 * code, lui, a l'air correct. C'est arrivé deux fois: `backchannelPlan` et
 * `voice.chunkPlan.punctuationBoundaries`.
 *
 * `vapi-schema.test.ts` fige les leçons déjà payées. Il ne peut pas prédire
 * la prochaine: il ne parle pas à Vapi. Ce script, si.
 *
 * ## Ce qu'il fait exactement
 *
 * Il POSTe un assistant jetable, vérifie la réponse, et le SUPPRIME. Un 400
 * ne crée rien (Vapi valide avant d'écrire), donc l'échec ne laisse aucune
 * trace; le succès en laisse une, effacée dans la foulée. Le nom porte un
 * préfixe reconnaissable et le script balaie au démarrage ce qu'un plantage
 * aurait pu laisser derrière lui.
 *
 * Il couvre les deux moteurs et les trois langues, parce que les plans
 * diffèrent selon les deux: le mode parole-à-parole retire le transcripteur et
 * la moitié des plans, et le champ de biasing dépend du modèle Deepgram, qui
 * dépend de la langue.
 */
import { env } from '../config/env';
import { buildRealtimePlans, buildVoice, type VoiceLanguage } from '../services/voice/speech-plans';
import { fitAssistantLabel } from '../services/voice/vapi-limits';

/* 13 caractères, et c'est un compte, pas un goût: le nom complet vaut
   `PREFIX-fr-classic-<Date.now()>`, soit 38 avec ce préfixe et 45 avec
   `__qwillio-validation`, que Vapi a refusé (« name must be shorter than or
   equal to 40 characters », 09/09/2026). Le balayage des assistants oubliés
   compare sur ce préfixe, qui est aussi un préfixe de l'ancien: un jeton laissé
   par une version précédente est donc ramassé lui aussi. */
const PREFIX = '__qwillio-val';
const LANGS: VoiceLanguage[] = ['fr', 'en', 'nl'];

/** Un assistant minimal mais COMPLET: les plans sont ce qu'on teste. */
function candidate(lang: VoiceLanguage, speechToSpeech: boolean) {
  return {
    name: fitAssistantLabel(`${PREFIX}-${lang}-${speechToSpeech ? 's2s' : 'classic'}-${Date.now()}`),
    model: {
      provider: 'openai',
      model: env.VAPI_MODEL,
      messages: [{ role: 'system', content: 'Validation.' }],
    },
    /* Une voix quelconque: ce qu'on teste est la FORME des plans, pas le
       timbre. Un identifiant ElevenLabs public suffit et évite de dépendre
       d'un réglage client. */
    voice: buildVoice({ voiceId: '21m00Tcm4TlvDq8ikWAM', lang }),
    firstMessage: 'Validation.',
    ...buildRealtimePlans(lang, speechToSpeech, {
      // Un vocabulaire NON VIDE: c'est justement le cas où le champ apparaît,
      // donc le seul qui teste quelque chose.
      vocabulary: ['Chez Marie', 'Vandenberghe', 'toiture'],
    }),
  };
}

async function vapi(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${env.VAPI_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.VAPI_PRIVATE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

/** Efface ce qu'un plantage antérieur aurait laissé. */
async function sweep(): Promise<number> {
  const res = await vapi('/assistant?limit=100', { method: 'GET' });
  if (!res.ok) return 0;
  const list = (await res.json()) as Array<{ id: string; name?: string }>;
  const stale = list.filter(a => typeof a.name === 'string' && a.name.startsWith(PREFIX));
  for (const a of stale) await vapi(`/assistant/${a.id}`, { method: 'DELETE' });
  return stale.length;
}

async function main() {
  const dry = process.argv.includes('--dry');

  if (dry) {
    console.log('\nCharge qui serait envoyée (français, mode classique):\n');
    console.log(JSON.stringify(candidate('fr', false), null, 2));
    console.log('\nRelancer sans --dry pour demander son avis à Vapi.\n');
    return;
  }

  if (!env.VAPI_PRIVATE_KEY) {
    console.error('\nVAPI_PRIVATE_KEY absente. Ce script ne sert à rien sans elle: son intérêt est');
    console.error("de poser la question à Vapi, pas de relire le code.\n");
    process.exitCode = 1;
    return;
  }

  const swept = await sweep();
  if (swept) console.log(`Nettoyage: ${swept} assistant(s) de validation oublié(s) supprimé(s).`);

  let refused = 0;
  for (const lang of LANGS) {
    for (const speechToSpeech of [false, true]) {
      const label = `${lang} / ${speechToSpeech ? 'temps réel' : 'classique'}`;
      const res = await vapi('/assistant', {
        method: 'POST',
        body: JSON.stringify(candidate(lang, speechToSpeech)),
      });

      if (res.ok) {
        const created = (await res.json()) as { id: string };
        await vapi(`/assistant/${created.id}`, { method: 'DELETE' });
        console.log(`  OK      ${label}`);
        continue;
      }

      refused++;
      /* Le corps de la réponse EST le diagnostic: il nomme le champ fautif,
         et c'est la seule chose que le code ne pouvait pas deviner. */
      const body = await res.text();
      console.error(`  REFUSÉ  ${label} — HTTP ${res.status}`);
      console.error(`          ${body.slice(0, 600)}`);
    }
  }

  if (refused) {
    console.error(`\n${refused} variante(s) refusée(s). NE PAS DÉPLOYER: un champ refusé fait tomber`);
    console.error('tous les appels de la flotte, pas seulement la variante testée.\n');
    process.exitCode = 1;
  } else {
    console.log('\nLes six variantes sont acceptées par Vapi.\n');
  }
}

main().catch(err => {
  console.error('Validation impossible:', err);
  process.exitCode = 1;
});
