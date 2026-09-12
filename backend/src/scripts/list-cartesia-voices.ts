/**
 * Les voix Cartesia du compte, telles que Cartesia les déclare.
 *
 *   npm run voice:cartesia                 # les voix françaises
 *   npm run voice:cartesia -- --lang=nl    # une autre langue
 *   npm run voice:cartesia -- --try=<id>   # synthétise une phrase avec cette voix
 *   npm run voice:cartesia -- --raw        # la première entrée telle que Cartesia la rend
 *
 * ## Pourquoi un script, et pas une réponse
 *
 * Un identifiant de voix ne se DÉDUIT jamais, pas plus qu'un identifiant de
 * modèle (6quinvicies): il se lit chez le fournisseur qui le sert. Trois
 * valeurs fausses ont déjà été posées dans `VOICE_REALTIME_MODEL` avant la
 * bonne, chacune venue d'ailleurs que de l'API qui reçoit la charge — un
 * catalogue public, un message d'erreur tronqué, un nom d'écran de tableau de
 * bord. Écrire ici une liste de voix « françaises et bonnes » referait
 * exactement ça, et le symptôme serait une voix qui n'existe pas.
 *
 * ## Ce que ça débloque
 *
 * `CARTESIA_DEFAULT_VOICE_ID` absent est un défaut SILENCIEUX: `VOICE_TTS_PROVIDER`
 * peut valoir `cartesia`, la traduction depuis le catalogue ElevenLabs rend
 * alors `null`, et toute la flotte reste chez ElevenLabs sans une ligne de
 * journal. Relevé en production le 12/09/2026, sur un compte qui se croyait
 * passé chez Cartesia depuis des jours.
 *
 * ## L'essai, qui est la moitié du script
 *
 * `--try` POSTe vraiment une synthèse avec `CARTESIA_MODEL`. C'est le seul
 * geste qui distingue « cette voix existe » de « cette voix existe ET ce modèle
 * l'accepte »: chez Cartesia, une voix inconnue et un modèle inconnu rendent
 * tous les deux un 400, et seul le corps de la réponse les sépare. Le corps est
 * donc affiché ENTIER, jamais tronqué — couper une réponse d'API, c'est
 * fabriquer une déduction fausse qui a l'air d'une lecture.
 */
import { env } from '../config/env';
import { listCartesiaVoices, synthesiseWithCartesia, CartesiaError, API_VERSION } from '../services/voice/cartesia.service';
import type { VoiceLanguage } from '../services/voice/speech-plans';

const arg = (name: string): string | null => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

function isLang(v: string | null): v is VoiceLanguage {
  return v === 'fr' || v === 'en' || v === 'nl';
}

async function main() {
  if (!env.CARTESIA_API_KEY) {
    console.error('\nCARTESIA_API_KEY absente. Rien à demander.\n');
    process.exit(1);
  }

  const langArg = arg('lang');
  const lang: VoiceLanguage = isLang(langArg) ? langArg : 'fr';

  console.log(`\nCARTESIA_MODEL: ${env.CARTESIA_MODEL}`);
  console.log(`CARTESIA_DEFAULT_VOICE_ID: ${env.CARTESIA_DEFAULT_VOICE_ID || 'ABSENTE — la flotte reste chez ElevenLabs'}`);
  console.log(`CARTESIA_VOICES: ${env.CARTESIA_VOICES || '(aucune correspondance par personnage)'}`);

  const tryId = arg('try');
  if (tryId) {
    console.log(`\nEssai de synthèse avec ${tryId}...`);
    try {
      const audio = await synthesiseWithCartesia({
        voiceId: tryId,
        lang,
        text: lang === 'fr'
          ? 'Bonjour, cabinet dentaire, que puis-je faire pour vous ?'
          : 'Hello, how can I help you today?',
      });
      console.log(`OK  ${audio.length} octets rendus par ${env.CARTESIA_MODEL}.`);
      console.log(`    Cette voix ET ce modèle fonctionnent ensemble. Pose-la dans CARTESIA_DEFAULT_VOICE_ID.`);
    } catch (error) {
      const e = error as CartesiaError;
      console.error(`NON ${e.message}${e.upstream ? ` (HTTP ${e.upstream})` : ''}`);
      // Le corps ENTIER: c'est lui qui dit si la voix est inconnue ou le modèle.
      if (e.reason) console.error(`    ${e.reason}`);
      process.exitCode = 1;
    }
    return;
  }

  /* `--raw`: l'objet ENTIER de la première voix, tel que Cartesia le rend.
     La documentation n'est pas atteignable d'ici, et le portail veut trier par
     genre: c'est ce champ-là qu'on cherche, sous le nom exact qu'il porte, et
     non sous celui qu'on lui suppose. Lire la réponse plutôt que deviner sa
     forme est toute la raison de ce script. */
  if (process.argv.includes('--raw')) {
    const r = await fetch('https://api.cartesia.ai/voices/?limit=1', {
      headers: { 'X-API-Key': env.CARTESIA_API_KEY, 'Cartesia-Version': API_VERSION },
    });
    console.log(`\nHTTP ${r.status}\n`);
    console.log(await r.text());
    return;
  }

  const voices = await listCartesiaVoices(lang);
  if (!voices.length) {
    console.log(`\nAucune voix ${lang} sur ce compte Cartesia.\n`);
    return;
  }

  console.log(`\n${voices.length} voix « ${lang} » sur ce compte:\n`);
  for (const v of voices) {
    console.log(`  ${v.voiceId}`);
    console.log(`    ${v.name}${v.gender ? ` · ${v.gender === 'male' ? 'homme' : 'femme'}` : ''}${v.language ? ` · ${v.language}` : ''}`);
    if (v.description) console.log(`    ${v.description}`);
  }

  console.log('\nPour en essayer une avant de la poser:');
  console.log(`  npm run voice:cartesia -- --try=${voices[0].voiceId}\n`);
}

main()
  .catch(error => {
    const e = error as CartesiaError;
    console.error(`\nÉchec: ${e.message}${e.upstream ? ` (HTTP ${e.upstream})` : ''}`);
    if (e.reason) console.error(e.reason);
    process.exit(1);
  });
