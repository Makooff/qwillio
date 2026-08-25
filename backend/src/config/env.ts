import dotenv from 'dotenv';
import path from 'path';
import type { StringValue } from 'ms';
import { validateEnv } from './env-validation';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ─── Fix deleted VAPI assistant IDs (Render env var has stale value) ───
const DELETED_ASSISTANT_ID = 'd98364c2-8ca4-4efb-af00-8534af00fa06';
const CORRECT_ASSISTANT_ID_EN = 'e583a22d-0b73-4bb1-95c8-8de334f06089';
const CORRECT_ASSISTANT_ID_FR = '327fa4b1-e3b7-4de7-bd06-906d2d42d7dd';

function resolveAssistantId(envVal: string | undefined, correctVal: string): string {
  if (!envVal || envVal === DELETED_ASSISTANT_ID || !/^[0-9a-f]{8}-/.test(envVal)) return correctVal;
  return envVal;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  FRONTEND_URL: (process.env.FRONTEND_URL || 'http://localhost:5173,https://frontend-orcin-psi-81.vercel.app').replace(/\\n/g, '').trim(),
  API_BASE_URL: process.env.API_BASE_URL || 'https://qwillio.onrender.com',

  DATABASE_URL: process.env.DATABASE_URL!,

  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
  JWT_EXPIRES_IN: (process.env.JWT_EXPIRES_IN || '24h') as StringValue,
  JWT_REFRESH_EXPIRES_IN: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as StringValue,
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),

  VAPI_PUBLIC_KEY: process.env.VAPI_PUBLIC_KEY || '',
  VAPI_PRIVATE_KEY: process.env.VAPI_PRIVATE_KEY || '',
  VAPI_ASSISTANT_ID: resolveAssistantId(process.env.VAPI_ASSISTANT_ID, CORRECT_ASSISTANT_ID_EN),
  VAPI_ASSISTANT_ID_FR: resolveAssistantId(process.env.VAPI_ASSISTANT_ID_FR, CORRECT_ASSISTANT_ID_FR),
  VAPI_PHONE_NUMBER: process.env.VAPI_PHONE_NUMBER || '',
  VAPI_PHONE_NUMBER_ID: process.env.VAPI_PHONE_NUMBER_ID || '',
  VAPI_BASE_URL: process.env.VAPI_BASE_URL || 'https://api.vapi.ai',
  VAPI_MODEL: process.env.VAPI_MODEL || 'gpt-4o',
  VAPI_VOICE_ID: process.env.VAPI_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', // Rachel (ElevenLabs)
  VAPI_VOICE_ID_FR: process.env.VAPI_VOICE_ID_FR || 'pMsXgVXv3BLzUgSXRplE', // Amélie — French ElevenLabs voice
  // Optional Belgian-accent voice for BE prospects. Empty = fall back to the FR voice.
  VAPI_VOICE_ID_BE: process.env.VAPI_VOICE_ID_BE || '',
  // Optional: direct ElevenLabs key for in-dashboard voice previews (real voice
  // instead of the browser's robotic TTS). Empty = frontend falls back to TTS.
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
  /* Fish Audio, pour AUDITIONNER une autre voix, pas encore pour appeler.
   *
   * Le chemin d'appel passe par Vapi, qui ne connaît pas Fish Audio: l'y
   * brancher demande un endpoint `custom-voice` chez nous, donc un aller-retour
   * de plus DANS le chemin audio. Avant d'en payer le prix, il faut savoir si la
   * voix est meilleure EN FRANÇAIS, et la seule façon de le savoir est de
   * l'entendre. Ces variables servent exactement à ça: les aperçus du tableau
   * de bord, qui sont hors du chemin d'appel.
   *
   * Vide = rien ne change, les aperçus restent sur ElevenLabs. */
  FISH_AUDIO_API_KEY: process.env.FISH_AUDIO_API_KEY || '',
  /** `s2-pro` (payant), `s2.1-pro-free`, ou `s1`. Envoyé dans l'en-tête `model`. */
  FISH_AUDIO_MODEL: process.env.FISH_AUDIO_MODEL || 's2-pro',
  /**
   * Fournisseur des aperçus de voix. `fish` exige `FISH_AUDIO_API_KEY` et une
   * voix Fish pour le personnage écouté: à défaut l'aperçu ÉCHOUE en le disant,
   * il ne retombe pas sur ElevenLabs. Un repli silencieux transformerait
   * l'audition en mensonge — on croirait juger Fish en écoutant ElevenLabs.
   */
  VOICE_PREVIEW_PROVIDER: (process.env.VOICE_PREVIEW_PROVIDER === 'fish' ? 'fish' : '11labs') as '11labs' | 'fish',
  /**
   * Correspondance voix ElevenLabs → voix Fish (`reference_id`), sous la forme
   * `elevenId=fishId,elevenId=fishId`. Les deux catalogues sont étrangers l'un à
   * l'autre: un id ElevenLabs n'a aucun sens chez Fish.
   */
  FISH_AUDIO_VOICES: process.env.FISH_AUDIO_VOICES || '',
  /** Voix Fish utilisée pour tout personnage absent de la table ci-dessus. */
  FISH_AUDIO_DEFAULT_VOICE_ID: process.env.FISH_AUDIO_DEFAULT_VOICE_ID || '',
  VAPI_VOICE_FALLBACK_1: process.env.VAPI_VOICE_FALLBACK_1 || 'MF3mGyEYCl7XYWbV9V6O', // Elli
  VAPI_VOICE_FALLBACK_2: process.env.VAPI_VOICE_FALLBACK_2 || 'EXAVITQu4vr4xnSDxMaL', // Bella
  VAPI_STABILITY: parseFloat(process.env.VAPI_STABILITY || '0.45'),
  VAPI_SIMILARITY_BOOST: parseFloat(process.env.VAPI_SIMILARITY_BOOST || '0.82'),
  VAPI_STYLE: parseFloat(process.env.VAPI_STYLE || '0.35'),
  /**
   * `optimize_streaming_latency` d'ElevenLabs, et c'est un compromis, pas un
   * curseur de vitesse.
   *
   * À 3 et au-dessus, ElevenLabs COUPE le normaliseur de texte. Le modèle
   * reçoit alors le texte brut et doit deviner comment prononcer ce qui n'est
   * pas un mot: « 99 € », « +32 477 », « 14h30 », « Dr », « 1er ». C'est
   * exactement le symptôme rapporté, une voix qui fourche et dit des choses
   * bizarres, et il porte surtout sur les chiffres, dont un accueil
   * téléphonique est plein.
   *
   * On redescend à 2: on garde les optimisations de flux, on récupère le
   * normaliseur. Ça coûte quelques dizaines de millisecondes sur le premier
   * son, et ça évite qu'un prix soit annoncé de travers.
   */
  VAPI_OPTIMIZE_LATENCY: Math.min(2, parseInt(process.env.VAPI_OPTIMIZE_LATENCY || '2', 10)),
  VAPI_INTERRUPTION_THRESHOLD: parseInt(process.env.VAPI_INTERRUPTION_THRESHOLD || '200', 10),
  /**
   * Silence avant que la réceptionniste RACCROCHE.
   *
   * 10 secondes, et c'était trop court au point de ressembler à une panne. Le
   * message d'accueil en prend cinq ou six à lui seul (le prénom, l'entreprise,
   * l'annonce d'IA), et il ne reste alors que quelques secondes à l'appelant
   * pour trouver ses mots. Retour de terrain: « il s'arrête tout seul après
   * avoir dit son prénom et que c'est un assistant IA ».
   *
   * Un vrai standard laisse le temps de chercher une référence ou de faire
   * taire quelqu'un à côté. Trente secondes est ce qui se pratique, et ça reste
   * loin des huit minutes de durée maximale.
   */
  VAPI_SILENCE_TIMEOUT: Math.max(10, parseInt(process.env.VAPI_SILENCE_TIMEOUT || '30', 10)),
  /**
   * Le fond sonore de bureau, joué SOUS la voix.
   *
   * Il était posé en dur à six endroits, et censé rendre la scène crédible. En
   * pratique il fatigue, il masque les fins de mots, et sur un appel NAVIGATEUR
   * sans casque il sort du haut-parleur, revient par le micro, et la
   * réceptionniste s'entend elle-même. Demande explicite du propriétaire de le
   * retirer.
   *
   * 'off' coupe. Les valeurs que Vapi accepte par ailleurs: 'office'.
   */
  VOICE_BACKGROUND_SOUND: process.env.VOICE_BACKGROUND_SOUND || 'off',
  VAPI_MAX_DURATION: parseInt(process.env.VAPI_MAX_DURATION || '480', 10), // 8 minutes
  VAPI_WEBHOOK_SECRET: process.env.VAPI_WEBHOOK_SECRET || '',

  // ─── Real-time voice pipeline ───
  // Every value below trades perceived latency against a failure mode; the
  // defaults are the tuned pair. See services/voice/speech-plans.ts.
  /** Silence (ms) after speech before a final transcript is flushed. */
  VOICE_ENDPOINTING_MS: parseInt(process.env.VOICE_ENDPOINTING_MS || '150', 10),
  /** Hard floor before the assistant may answer. Smart endpointing sits on top. */
  VOICE_START_WAIT_SECONDS: parseFloat(process.env.VOICE_START_WAIT_SECONDS || '0.12'),
  /**
   * Audio VOISÉ exigé de l'appelant avant de couper la réceptionniste.
   *
   * C'est le seuil de BRUIT, et c'est le déclencheur qui restait ouvert.
   * `VOICE_BARGE_IN_WORDS` a été porté à 2 pour qu'il faille des mots
   * transcrits, mais les deux règles ne sont pas en série: celle-ci coupe
   * toute seule, sur l'énergie, sans passer par le transcripteur. À 0,2 s,
   * une porte, une toux ou une voix à côté suffisaient encore, et le défaut
   * signalé n'a donc pas disparu: « il s'arrête de parler alors que je ne
   * parle pas ».
   *
   * Vapi documente exactement ce curseur pour ce cas: monter `voiceSeconds`
   * « évite les interruptions causées par des bruits de fond, au prix d'un
   * léger retard sur la détection du début de parole ». 0,4 s est le premier
   * palier qui trie une syllabe d'un bruit, et le retard qu'il ajoute ne se
   * paie que sur l'interruption volontaire.
   *
   * À redescendre par variable d'environnement pour un lieu silencieux où
   * l'instantanéité prime.
   */
  VOICE_BARGE_IN_VOICE_SECONDS: parseFloat(process.env.VOICE_BARGE_IN_VOICE_SECONDS || '0.4'),
  /**
   * Mots TRANSCRITS exigés avant de couper la réceptionniste.
   *
   * 0 coupe sur la simple activité vocale, sans attendre un mot. C'était le
   * réglage, et il rendait l'interruption instantanée: excellent au calme,
   * intenable ailleurs. Retour de terrain: « elle arrête de parler dès qu'elle
   * entend un peu de bruit ». Une porte, une radio, une conversation à côté
   * valent tous une activité vocale, et la réceptionniste se taisait.
   *
   * 2 mots la font attendre le transcripteur: du BRUIT ne produit pas de mots,
   * une PHRASE en produit. Le prix est de 200 à 300 ms sur l'interruption
   * volontaire, ce qui reste sous le seuil où l'on se sent coupé.
   *
   * Remis à 0 par variable d'environnement si le lieu est silencieux et que
   * l'instantanéité prime.
   */
  VOICE_BARGE_IN_WORDS: Math.max(0, parseInt(process.env.VOICE_BARGE_IN_WORDS || '2', 10) || 0),
  /** Silence the assistant keeps after being interrupted, before speaking again. */
  VOICE_BARGE_IN_BACKOFF_SECONDS: parseFloat(process.env.VOICE_BARGE_IN_BACKOFF_SECONDS || '1.0'),
  /** First TTS chunk size — smaller means audio starts sooner. */
  /**
   * Taille du PREMIER morceau de texte envoyé au synthétiseur.
   *
   * 20 caractères faisaient partir le son très tôt, et c'était l'objectif
   * affiché. Le prix, jugé « marginal » dans le commentaire d'origine, ne l'est
   * pas: le synthétiseur reçoit des bouts de phrase sans contexte, donc il ne
   * sait pas où poser l'accent ni comment finir sa courbe. Retour de terrain:
   * « les agents parlent trop haché, articulent trop, sonnent pas naturel ».
   *
   * 60 caractères, c'est à peu près une proposition: assez pour que la phrase
   * ait une forme. Coût: quelques dizaines de millisecondes sur le premier son,
   * une seule fois par tour de parole.
   */
  VOICE_TTS_MIN_CHUNK_CHARS: parseInt(process.env.VOICE_TTS_MIN_CHUNK_CHARS || '60', 10),
  /**
   * Débit de la voix. 1 = le débit naturel du modèle.
   *
   * « Ils sont lents » revient dans les retours. Un cran au-dessus se remarque
   * à peine à l'oreille mais raccourcit chaque phrase; au delà de ~1,15 le
   * modèle Flash commence à manger des syllabes.
   */
  /* 1,0 est la vitesse à laquelle le modèle a été entraîné, et ElevenLabs
     prévient que s'en écarter dégrade la qualité. 1,05 avait été posé contre
     la lenteur; c'est peu, mais ça se paie exactement là où le défaut se
     plaint, sur la netteté des syllabes. Le débit se règle d'abord par la
     longueur des réponses (une à deux phrases par tour), pas en accélérant la
     bande. */
  VOICE_SPEECH_SPEED: Math.min(1.2, Math.max(0.8, parseFloat(process.env.VOICE_SPEECH_SPEED || '1.0') || 1.0)),
  /**
   * Plafond de l'exagération de style d'ElevenLabs.
   *
   * Les personnages portent des valeurs allant jusqu'à 0,7. C'est beaucoup: le
   * style élevé rend la diction théâtrale (le « articule trop » du retour),
   * ajoute de l'instabilité d'un tour à l'autre, et coûte de la latence. On
   * plafonne plutôt que d'éditer chaque personnage, pour qu'un seul réglage
   * décide du rendu de toute la flotte.
   */
  /**
   * Le modèle de synthèse d'ElevenLabs, en mode classique.
   *
   * `eleven_flash_v2_5` est le plus rapide (~75 ms avant le premier octet) et
   * c'est ce qui l'a fait choisir. C'est aussi le moins expressif de la
   * famille: il pose les mots proprement et sans relief, ce qui s'entend comme
   * « ça articule trop ». Les trois curseurs voisins (morceau, vitesse, style)
   * travaillent AUTOUR de ce défaut sans pouvoir le corriger, parce qu'il
   * tient au modèle.
   *
   * `eleven_turbo_v2_5` est le palier au dessus: nettement plus naturel, à
   * 200 à 300 ms de plus sur le premier son, une fois par tour de parole.
   * `eleven_multilingual_v2` est le plus naturel des trois et le plus lent, à
   * réserver à un essai.
   *
   * LE DÉFAUT A CHANGÉ, et il faut savoir pourquoi. Il est resté sur `flash`
   * un tour de plus, au motif que la lenteur avait été signalée une fois et
   * que l'arbitrage se jugeait à l'oreille. Le retour est venu deux fois de
   * suite, sur le même mot: « ça articule encore trop, pas assez naturel ».
   * Un curseur qu'il faut savoir tourner ne corrige rien.
   *
   * `turbo_v2_5` est aussi ce qui rapproche l'appel de l'APERÇU, qui lui a
   * toujours été synthétisé en `multilingual_v2`: la voix auditionnée dans le
   * sélecteur était plus vivante que celle des appels, et personne ne pouvait
   * le voir. Retour arrière: `VOICE_TTS_MODEL=eleven_flash_v2_5`, une variable
   * d'environnement, pas un déploiement.
   */
  VOICE_TTS_MODEL: process.env.VOICE_TTS_MODEL || 'eleven_turbo_v2_5',
  VOICE_TTS_STYLE_CAP: Math.min(1, Math.max(0, parseFloat(process.env.VOICE_TTS_STYLE_CAP || '0.4') || 0.4)),
  /* Parole-à-parole (le mode « voix de ChatGPT »).
   *
   * La chaîne classique transcrit, puis fait écrire un modèle, puis synthétise:
   * trois étapes, trois latences, et une voix qui lit un texte. Le modèle
   * temps réel d'OpenAI prend l'audio et rend l'audio, sans passer par le
   * texte: c'est de là que viennent à la fois le délai le plus court et les
   * intonations, les hésitations, le rire.
   *
   * Mis à 'off' dans Render, tout retombe sur ElevenLabs sans redéploiement:
   * c'est le seul interrupteur à connaître si le rendu déplaît ou si la minute
   * coûte trop cher. */
  VOICE_SPEECH_TO_SPEECH: (process.env.VOICE_SPEECH_TO_SPEECH || 'on').toLowerCase() !== 'off',
  /**
   * Supplément facturé à la minute pour le mode parole-à-parole, en euros.
   *
   * 0 (défaut) = l'option n'est PAS vendue: rien ne change, `auto` suit le
   * réglage global et aucune facture n'est produite.
   *
   * Dès qu'il est > 0, l'option devient payante, et une conséquence en
   * découle: `auto` cesse de résoudre en temps réel. Sans cela, tous les
   * clients existants — qui sont en `auto` — se retrouveraient facturés d'une
   * option qu'ils n'ont jamais demandée, à la fin du mois, sans avertissement.
   * Poser ce prix est donc l'unique interrupteur: il met l'option en vente ET
   * la rend explicitement choisie.
   */
  VOICE_REALTIME_SURCHARGE_EUR: Math.max(0, parseFloat(process.env.VOICE_REALTIME_SURCHARGE_EUR || '0') || 0),
  VOICE_REALTIME_MODEL: process.env.VOICE_REALTIME_MODEL || 'gpt-realtime-2025-08-28',
  /** Cap on a single assistant turn; long completions are long silences. */
  VOICE_MAX_COMPLETION_TOKENS: parseInt(process.env.VOICE_MAX_COMPLETION_TOKENS || '120', 10),
  /** How long a running tool waits before the second filler line fires. */
  VOICE_FILLER_DELAY_MS: parseInt(process.env.VOICE_FILLER_DELAY_MS || '1200', 10),
  /** Vapi-side tool timeout; the runtime's own ceiling is lower. */
  VOICE_TOOL_TIMEOUT_SECONDS: parseInt(process.env.VOICE_TOOL_TIMEOUT_SECONDS || '8', 10),
  /** Client profile cache TTL. Invalidated explicitly on config changes. */
  VOICE_CONTEXT_TTL_MS: parseInt(process.env.VOICE_CONTEXT_TTL_MS || '300000', 10),
  /** Cheap tier for conversational turns that still need a model. */
  VOICE_SMALL_MODEL: process.env.VOICE_SMALL_MODEL || 'gpt-4o-mini',
  /**
   * Assistant acknowledgements emitted while the caller is still talking.
   * Off makes the agent read as a machine even at perfect latency; too eager
   * makes it read as interrupting. The two delays below are the throttle.
   */
  VOICE_BACKCHANNEL_ENABLED: process.env.VOICE_BACKCHANNEL_ENABLED !== 'false',
  /** Caller must talk this long before the first acknowledgement. */
  VOICE_BACKCHANNEL_START_DELAY_SECONDS: parseFloat(process.env.VOICE_BACKCHANNEL_START_DELAY_SECONDS || '2.5'),
  /** Minimum gap between two acknowledgements. Lower sounds like a parrot. */
  VOICE_BACKCHANNEL_FREQUENCY_SECONDS: parseFloat(process.env.VOICE_BACKCHANNEL_FREQUENCY_SECONDS || '4'),
  /**
   * Silence avant que l'agent demande si l'appelant est toujours là. Distinct
   * de VAPI_SILENCE_TIMEOUT, qui est l'échéance du raccroché.
   *
   * Quatre secondes relançaient quelqu'un qui réfléchissait encore: un silence
   * de quatre secondes est NORMAL au téléphone, on y cherche un papier. Huit
   * laissent respirer, et il en reste largement avant le raccroché.
   */
  VOICE_IDLE_NUDGE_SECONDS: parseFloat(process.env.VOICE_IDLE_NUDGE_SECONDS || '8'),
  /** How many times to nudge before letting the silence timeout end the call. */
  VOICE_IDLE_NUDGE_COUNT: parseInt(process.env.VOICE_IDLE_NUDGE_COUNT || '2', 10),
  /* Conformité au décroché.
   *
   * L'AI Act (art. 50, applicable depuis le 02/08/2026) impose d'annoncer que
   * l'appelant parle à une IA; le RGPD (et l'art. 314bis en Belgique) impose
   * d'annoncer l'enregistrement avant qu'il ait lieu. Le premier message porte
   * donc les deux, et « off » n'existe que pour un déploiement hors UE — le
   * laisser actif est le seul réglage conforme sur le marché visé. */
  VOICE_COMPLIANCE_GREETING: (process.env.VOICE_COMPLIANCE_GREETING || 'on').toLowerCase() !== 'off',
  /* Le détecteur de fin de tour pour le FRANÇAIS.
   *
   * `vapi` est le choix documenté (le modèle LiveKit historique était
   * anglophone, voir speech-plans.ts). LiveKit a depuis publié un modèle de
   * tour multilingue: ce réglage permet de l'essayer sur de vrais appels sans
   * redéploiement, et de revenir en un set d'env si le français y perd. */
  VOICE_FR_ENDPOINTING_PROVIDER: (process.env.VOICE_FR_ENDPOINTING_PROVIDER === 'livekit' ? 'livekit' : 'vapi') as 'vapi' | 'livekit',
  /* Fallbacks fournisseurs (STT et LLM), VIDES par défaut.
   *
   * Un champ que Vapi ne reconnaît pas rejette l'assistant ENTIER — l'appel
   * test ET les vrais appels (déjà vécu avec backchannelPlan). Ces deux
   * variables ne doivent donc être posées qu'après validation sur un appel
   * réel. Vides, le comportement actuel est inchangé au bit près. */
  /** Ex: 'gpt-4o-mini' — modèles de secours du même provider, ordre de préférence. */
  VOICE_LLM_FALLBACK_MODELS: (process.env.VOICE_LLM_FALLBACK_MODELS || '')
    .split(',').map(s => s.trim()).filter(Boolean),
  /** Ex: 'google' — transcripteur de secours si Deepgram tombe. */
  VOICE_STT_FALLBACK_PROVIDER: process.env.VOICE_STT_FALLBACK_PROVIDER || '',
  /* Achat automatique d'un numéro entrant à l'onboarding quand la ligne
   * partagée est prise. '1' strict, comme ALLOW_DEGRADED_BOOT: chaque
   * activation ACHÈTE un numéro Twilio facturé au compte — c'est une décision
   * d'exploitation, jamais un défaut de code. */
  PHONE_AUTO_PROVISION: process.env.PHONE_AUTO_PROVISION || '',
  /** Indicatif souhaité pour l'achat (dépend du pays du compte Twilio). */
  PHONE_PROVISION_AREA_CODE: process.env.PHONE_PROVISION_AREA_CODE || '',
  /**
   * Custom-LLM path for every client. ON by default: it is what makes the
   * intent router actually skip the model instead of only counting the turns it
   * could have skipped, and what routes easy turns to the cheap tier.
   *
   * The cost is that this service sits in the audio path of every turn, so a
   * cold instance is an audible silence. That is mitigated externally by
   * pinging GET /ping every 5 minutes. Set this to "false" to fall straight
   * back to Vapi's own OpenAI path — no redeploy of the assistants needed, the
   * next call picks it up.
   */
  VOICE_CUSTOM_LLM_DEFAULT: process.env.VOICE_CUSTOM_LLM_DEFAULT !== 'false',
  /**
   * Semantic search over the knowledge base. The lexical score answers a small
   * base correctly and for free, so embeddings only engage above the threshold:
   * a client with a dozen FAQ entries must not pay a round-trip on a turn the
   * caller is waiting through.
   */
  VOICE_EMBEDDING_ENABLED: process.env.VOICE_EMBEDDING_ENABLED !== 'false',
  VOICE_EMBEDDING_MIN_ENTRIES: parseInt(process.env.VOICE_EMBEDDING_MIN_ENTRIES || '25', 10),
  /** Changing this re-embeds the base rather than mixing two vector spaces. */
  VOICE_EMBEDDING_MODEL: process.env.VOICE_EMBEDDING_MODEL || 'text-embedding-3-small',
  /** Optional shared cache. Absent = per-process in-memory cache. */
  REDIS_URL: process.env.REDIS_URL || '',

  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  /* Configuration du portail de facturation (`bpc_…`). Vide = configuration
     par défaut du compte Stripe, ce qui suffit tant qu'il n'y en a qu'une.
     La poser épingle explicitement CELLE qu'on a réglée, pour qu'une seconde
     configuration créée plus tard ne change pas le portail sans qu'on le
     sache. ⚠️ L'identifiant appartient à un MODE: un `bpc_` de test avec une
     clé live échoue. */
  STRIPE_PORTAL_CONFIGURATION_ID: process.env.STRIPE_PORTAL_CONFIGURATION_ID || '',
  STRIPE_LINK_BASIC: process.env.STRIPE_LINK_BASIC || '',
  STRIPE_LINK_PRO: process.env.STRIPE_LINK_PRO || '',
  STRIPE_LINK_ENTERPRISE: process.env.STRIPE_LINK_ENTERPRISE || '',
  STRIPE_PRICE_SOLO_MONTHLY: process.env.STRIPE_PRICE_SOLO_MONTHLY || '',
  STRIPE_PRICE_BASIC_SETUP: process.env.STRIPE_PRICE_BASIC_SETUP || '',
  STRIPE_PRICE_BASIC_MONTHLY: process.env.STRIPE_PRICE_BASIC_MONTHLY || '',
  STRIPE_PRICE_PRO_SETUP: process.env.STRIPE_PRICE_PRO_SETUP || '',
  STRIPE_PRICE_PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
  STRIPE_PRICE_ENTERPRISE_SETUP: process.env.STRIPE_PRICE_ENTERPRISE_SETUP || '',
  STRIPE_PRICE_ENTERPRISE_MONTHLY: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || '',

  // Agent AI modules (+$197/mo each, manual Stripe setup required)
  STRIPE_PRICE_MARKETING_AI: process.env.STRIPE_PRICE_MARKETING_AI || '',
  STRIPE_PRICE_REPUTATION_AI: process.env.STRIPE_PRICE_REPUTATION_AI || '',
  STRIPE_PRICE_SCHEDULING_AI: process.env.STRIPE_PRICE_SCHEDULING_AI || '',
  STRIPE_PRICE_SUPPORT_AI: process.env.STRIPE_PRICE_SUPPORT_AI || '',
  STRIPE_PRICE_CRM_AI: process.env.STRIPE_PRICE_CRM_AI || '',
  STRIPE_PRICE_DOCUMENT_AI: process.env.STRIPE_PRICE_DOCUMENT_AI || '',
  STRIPE_PRICE_LOCAL_SEO_AI: process.env.STRIPE_PRICE_LOCAL_SEO_AI || '',
  STRIPE_PRICE_LEAD_GEN_AI: process.env.STRIPE_PRICE_LEAD_GEN_AI || '',
  STRIPE_PRICE_ANALYTICS_AI: process.env.STRIPE_PRICE_ANALYTICS_AI || '',
  // Bundle all 13 modules — $1497/mo (saves $1064/mo)
  STRIPE_PRICE_ALL_AGENTS_BUNDLE: process.env.STRIPE_PRICE_ALL_AGENTS_BUNDLE || '',

  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  /* Soupape de secours: fait redescendre en avertissements les manques qui
     refusent normalement le démarrage en production, pour qu'un oubli ne puisse
     pas bloquer un déploiement d'urgence. À ne pas laisser posée. */
  ALLOW_DEGRADED_BOOT: process.env.ALLOW_DEGRADED_BOOT || '',
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'Qwillio <hello@qwillio.com>',
  RESEND_FROM_NAME: process.env.RESEND_FROM_NAME || 'Qwillio',
  RESEND_REPLY_TO: process.env.RESEND_REPLY_TO || 'contact@qwillio.com',

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_OAUTH_REDIRECT_URI: process.env.GOOGLE_OAUTH_REDIRECT_URI || 'https://qwillio.com/dashboard/receptionist',
  GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY || '',

  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL || '',

  // Twilio (SMS + Phone Validation + WhatsApp)
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_API_KEY_SID: process.env.TWILIO_API_KEY_SID || '',
  TWILIO_API_KEY_SECRET: process.env.TWILIO_API_KEY_SECRET || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
  TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER,
  /**
   * Les MODÈLES WhatsApp approuvés, par type de message.
   *
   * Hors d'une fenêtre de 24 h ouverte par le destinataire, WhatsApp n'accepte
   * pas de texte libre: il faut un modèle pré-approuvé par Meta, envoyé par son
   * identifiant de contenu (`HX…`). Or nos messages sont presque tous
   * business-initiated: une confirmation de rendez-vous part juste après un
   * APPEL, et l'appelant n'a jamais écrit sur WhatsApp.
   *
   * D'où cette table plutôt qu'un simple interrupteur: un type sans modèle
   * approuvé ne peut PAS partir sur WhatsApp, et le savoir avant d'essayer est
   * ce qui permet de retomber sur le SMS au lieu de perdre le message.
   *
   * Forme: {"booking_confirmed":"HX…","call_notification":"HX…"}
   * Une valeur illisible vaut table vide: aucun envoi WhatsApp, que du SMS.
   */
  WHATSAPP_TEMPLATE_SIDS: (() => {
    const raw = process.env.WHATSAPP_TEMPLATE_SIDS;
    if (!raw) return {} as Record<string, string>;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string' && v.trim()) out[k] = v.trim();
      }
      return out;
    } catch {
      return {} as Record<string, string>;
    }
  })(),
  SMS_ENABLED: process.env.SMS_ENABLED === 'true',
  // Opt-in signature verification for inbound Twilio webhooks. Leave false
  // until the public callback URL is confirmed, then set to 'true' on Render.
  TWILIO_VALIDATE_WEBHOOKS: process.env.TWILIO_VALIDATE_WEBHOOKS === 'true',

  // Master switch for the outbound prospection machinery (Google Places / Apify /
  // LinkedIn scraping, Twilio phone validation, outbound calling). Off by default
  // so a paused/unbilled account never hammers those paid APIs. Set 'true' in
  // Render to resume prospection.
  PROSPECTION_ENABLED: process.env.PROSPECTION_ENABLED === 'true',
  // Whether this process owns the scheduled jobs. Defaults to true so a
  // single-service deployment keeps behaving exactly as before; the split
  // is opted into by setting RUN_JOBS=false on the web service and true on
  // a dedicated worker, so a deploy of the API no longer kills jobs in flight.
  RUN_JOBS: process.env.RUN_JOBS !== 'false',
  CALLS_PER_DAY: parseInt(process.env.CALLS_PER_DAY || '50', 10),
  AUTOMATION_START_HOUR: parseInt(process.env.AUTOMATION_START_HOUR || '9', 10),
  AUTOMATION_END_HOUR: parseInt(process.env.AUTOMATION_END_HOUR || '19', 10),
  AUTOMATION_DAYS: (process.env.AUTOMATION_DAYS || '1,2,3,4,5').split(',').map(Number),
  CALL_INTERVAL_MINUTES: parseInt(process.env.CALL_INTERVAL_MINUTES || '5', 10),
  PROSPECTION_DAILY_QUOTA: parseInt(process.env.PROSPECTION_DAILY_QUOTA || '100', 10),
  PROSPECTION_RADIUS_METERS: parseInt(process.env.PROSPECTION_RADIUS_METERS || '5000', 10),
  PROSPECTION_CITIES: (process.env.PROSPECTION_CITIES || 'New York,Los Angeles,Chicago,Houston,Miami,San Francisco').split(','),

  SENTRY_DSN: process.env.SENTRY_DSN || '',

  TZ: process.env.TZ || 'Europe/Brussels',

  // ─── Apify (Google Maps scraping) ────────────────────────
  APIFY_API_KEY: process.env.APIFY_API_KEY || '',
  APIFY_ACTOR_ID: process.env.APIFY_ACTOR_ID || 'compass~crawler-google-places',

  // ─── Claude API (script self-learning) ───────────────────
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

  // ─── Discord multi-channel webhooks ──────────────────────
  DISCORD_WEBHOOK_CALLS: process.env.DISCORD_WEBHOOK_CALLS || '',
  DISCORD_WEBHOOK_LEADS: process.env.DISCORD_WEBHOOK_LEADS || '',
  DISCORD_WEBHOOK_SYSTEM: process.env.DISCORD_WEBHOOK_SYSTEM || '',
  DISCORD_WEBHOOK_ALERTS: process.env.DISCORD_WEBHOOK_ALERTS || '',
  // Dedicated errors channel (channel id 1458455361337167983 on the guild).
  // Falls back to DISCORD_WEBHOOK_ALERTS then DISCORD_WEBHOOK_URL if unset.
  DISCORD_WEBHOOK_ERRORS: process.env.DISCORD_WEBHOOK_ERRORS || '',

  // ─── Demo links (used in follow-up SMS/email) ────────────
  DEMO_LINK_EN: process.env.DEMO_LINK_EN || 'https://qwillio.com/demo',
  DEMO_LINK_FR: process.env.DEMO_LINK_FR || 'https://qwillio.com/demo-fr',

  // ─── Prospecting engine config ───────────────────────────
  MIN_PRIORITY_SCORE: parseInt(process.env.MIN_PRIORITY_SCORE || '10', 10),

  // ─── Admin access control ─────────────────────────────────
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'makho.off@gmail.com',
  ADMIN_SECRET: process.env.ADMIN_SECRET || '',
  // Password used to seed/reset the admin accounts on boot. No source-level
  // default: if unset, the seed is skipped and existing passwords are kept.
  ADMIN_SEED_PASSWORD: (process.env.ADMIN_SEED_PASSWORD || '').trim(),

  // ─── LinkedIn Outreach ────────────────────────────────────
  LINKEDIN_COOKIES: process.env.LINKEDIN_COOKIES || '', // JSON string of LinkedIn session cookies
  LINKEDIN_DAILY_LIMIT: parseInt(process.env.LINKEDIN_DAILY_LIMIT || '15', 10), // max connections/day
};

// ─── Boot-time validation ─────────────────────────────────
// Fail fast in production on missing/forgeable secrets; warn on money-critical
// keys that would otherwise fail silently. No-op in dev/test.
{
  const { errors, warnings } = validateEnv(env);
  for (const w of warnings) console.warn(`[env] WARNING: ${w}`);
  if (errors.length > 0) {
    console.error('[env] FATAL — refusing to boot:\n  - ' + errors.join('\n  - '));
    throw new Error('Invalid environment configuration. See errors above.');
  }
}
