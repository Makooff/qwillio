import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PhoneCall, PhoneOff, Loader2 } from '../icons';
import api from '../../services/api';

type CallState = 'idle' | 'connecting' | 'active' | 'ending';

/**
 * Pull a displayable string out of whatever Vapi threw.
 *
 * Its error events are not a stable shape: sometimes `{ message: string }`,
 * sometimes `{ message: { message, error, ... } }`, sometimes an Error. Passing
 * that straight to state and then into JSX renders an object as a React child,
 * which throws React #31 and takes the whole dashboard down with it — an
 * unreadable crash screen in place of a call that merely failed.
 *
 * Anything that is not a usable string becomes null, and the caller supplies
 * wording the user can act on.
 */
export function errorDetail(e: unknown): string | null {
  // The raw payload, trimmed. Without devtools on a phone there is no other way
  // to learn why a call refuses to start, and a generic sentence has already
  // proved useless twice. It no longer rides along in the sentence though: it
  // sits behind a folded « Détails techniques », because 220 characters of JSON
  // pushed the one useful line (Vapi's endedReason) off the card on iPhone.
  try {
    const seen = new WeakSet();
    const json = JSON.stringify(e, (_k, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[circular]';
        seen.add(v);
      }
      return v;
    });
    if (!json || json === '{}' || json === 'null') return null;
    return json.length > 220 ? `${json.slice(0, 220)}…` : json;
  } catch {
    return null;
  }
}

/**
 * Whether this failure is the user (or the OS) withholding the microphone.
 *
 * Now that the SDK asks for the device itself, the refusal arrives as whatever
 * the SDK chose to wrap the DOMException in, so the name is matched wherever it
 * can hide. Getting this wrong costs the one sentence that tells the user what
 * to actually do, so it errs on the side of recognising too much: every string
 * below only ever appears on a permission failure.
 */
const MIC_DENIED = /notallowed|permission\s*denied|notfound|notreadable|mic_denied|microphone/i;

export function isMicDenied(e: unknown): boolean {
  if (!e) return false;
  if (typeof e === 'string') return MIC_DENIED.test(e);
  if (typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  // An HTTP failure is never a microphone failure, whatever its body says.
  if (o.response || o.request) return false;
  for (const candidate of [o.name, o.message, o.errorMsg, (o.error as Record<string, unknown> | undefined)?.name, (o.error as Record<string, unknown> | undefined)?.message, o.error]) {
    if (typeof candidate === 'string' && MIC_DENIED.test(candidate)) return true;
  }
  return false;
}

/**
 * Cet échec vient-il de NOTRE compte chez le fournisseur, et non de l'appareil ?
 *
 * Vapi répond « Your Wallet Balance is 0 » avec un 400 quand le crédit est
 * épuisé. Sans ce tri, le message générique envoyait l'utilisateur vérifier son
 * micro et sa connexion pour un problème de facturation qui ne le concerne pas,
 * et le détail brut affichait notre état de compte, en clair, y compris sur la
 * page d'essai publique où le lecteur est un prospect.
 */
const PROVIDER_FAULT = /wallet\s*balance|purchase more credits|upgrade your plan|insufficient (funds|credits)|out of credits|quota exceeded/i;

export function isProviderFault(e: unknown): boolean {
  if (!e) return false;
  // Le message utile est parfois imbriqué sous `message.message`, ce que
  // `errorText` refuse de lire par sécurité: on inspecte donc la charge entière.
  try {
    const seen = new WeakSet();
    const json = JSON.stringify(e, (_k, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[circular]';
        seen.add(v);
      }
      return v;
    });
    if (json && PROVIDER_FAULT.test(json)) return true;
  } catch { /* charge non sérialisable */ }
  return typeof e === 'string' && PROVIDER_FAULT.test(e);
}

/**
 * À la réception de `call-end`, faut-il annoncer un échec de connexion ?
 *
 * Le même événement couvre deux situations opposées, et les confondre est le
 * défaut signalé depuis un iPhone: « ça fait chargement puis ça disparaît ».
 *  - `answered` (on a eu `call-start`): l'appel a bien eu lieu, sa fin est
 *    normale, il n'y a rien à dire.
 *  - sinon: l'appel n'a jamais décroché. Se taire laisse un bouton qui tourne
 *    puis s'efface, sans un mot à lire ni rien à corriger.
 *  - `reported`: une raison PRÉCISE vient déjà d'être affichée (« Micro
 *    refusé »). L'écraser par une phrase générique retirerait à l'utilisateur
 *    la seule ligne qui lui disait quoi faire.
 */
export function shouldReportConnectFailure(answered: boolean, reported: boolean): boolean {
  return !answered && !reported;
}

/**
 * Cette « erreur » est-elle en fait la fin normale de l'appel ?
 *
 * Sur Vapi web, la couche Daily annonce la fermeture de la salle par un
 * ÉVÉNEMENT D'ERREUR: `{"type":"ejected","msg":"Meeting has ended"}`. Elle
 * l'émet aussi bien quand l'assistant raccroche que quand la connexion tombe:
 * le texte est le même, seul le contexte les sépare.
 *
 * D'où le contexte: si l'appel avait DÉCROCHÉ (`call-start` reçu), cette
 * fermeture est le raccroché, pas une panne. La peindre en rouge, c'est
 * annoncer un échec à quelqu'un dont l'appel vient de se dérouler normalement,
 * et c'est ce que l'écran faisait.
 *
 * Avant `call-start`, la même charge signifie l'inverse: la salle s'est fermée
 * sans que l'appel ait commencé. Là, c'est bien un échec.
 */
export function isNormalTeardown(e: unknown, answered: boolean): boolean {
  if (!answered) return false;
  try {
    const seen = new WeakSet();
    const json = JSON.stringify(e, (_k, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[circular]';
        seen.add(v);
      }
      return v;
    });
    return !!json && /ejected|meeting has ended|meeting ended|left the meeting/i.test(json);
  } catch {
    return false;
  }
}

export function errorText(e: unknown): string | null {
  if (typeof e === 'string') return e.trim() || null;
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  for (const candidate of [o.message, o.errorMsg, (o.error as Record<string, unknown> | undefined)?.message, o.error]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  return null;
}

/**
 * La raison de Vapi, dite en français.
 *
 * `endedReason` est un identifiant machine (`pipeline-error-openai-voice-failed`),
 * et c'est la SEULE information de valeur quand un appel se ferme: le navigateur,
 * lui, ne connaît que « Meeting has ended ». Le montrer brut à un gérant ne lui
 * dit pas s'il doit rappeler, changer un réglage, ou nous prévenir.
 *
 * La table est volontairement courte et ORDONNÉE du plus précis au plus général:
 * `pipeline-error-openai-401-unauthorized` parle d'une clé refusée, pas d'un
 * modèle en panne, et les deux motifs se croiseraient si l'ordre s'inversait.
 *
 * Une raison inconnue rend `null`, et l'appelant affiche alors l'identifiant tel
 * quel. Une explication approximative serait pire que pas d'explication: elle
 * enverrait chercher la panne au mauvais endroit.
 */
const ENDED_REASONS: Array<[RegExp, string, string]> = [
  [/unauthorized|\b401\b|invalid[-_ ]?api[-_ ]?key/i,
    "Une clé fournisseur a été refusée. C'est chez nous, pas chez vous.",
    'A provider key was rejected. That is on our side, not yours.'],
  [/quota|\b429\b|insufficient|wallet|balance|credit/i,
    "Le crédit d'un fournisseur est épuisé. C'est chez nous, pas chez vous.",
    'A provider ran out of credit. That is on our side, not yours.'],
  [/voice[-_ ]?(not[-_ ]?found|failed|unavailable)/i,
    "La voix n'a pas répondu. Choisissez-en une autre, ou réessayez dans une minute.",
    'The voice did not respond. Pick another one, or try again in a minute.'],
  [/deepgram|transcriber/i,
    "La transcription n'a pas démarré. Elle ne sert qu'au mode classique.",
    'Transcription failed to start. It is only used by classic mode.'],
  [/eleven[-_ ]?labs|11labs/i,
    "Le synthétiseur de voix n'a pas démarré.",
    'The speech synthesiser failed to start.'],
  [/openai|llm[-_ ]?failed|custom[-_ ]?llm/i,
    "Le modèle vocal a refusé l'appel.",
    'The voice model refused the call.'],
  [/assistant[-_ ]?(not[-_ ]?valid|request)/i,
    "La configuration de l'agent a été refusée par Vapi.",
    'The agent configuration was rejected by Vapi.'],
  [/microphone/i,
    "Le micro n'a pas été autorisé.",
    'The microphone was not allowed.'],
  [/silence[-_ ]?timed[-_ ]?out/i,
    "Personne n'a parlé: l'appel s'est fermé après le délai de silence.",
    'Nobody spoke: the call closed after the silence timeout.'],
  [/exceeded[-_ ]?max[-_ ]?duration/i,
    "L'appel a atteint sa durée maximale.",
    'The call reached its maximum duration.'],
  [/(customer|assistant)[-_ ]?ended[-_ ]?call/i,
    "L'appel a été raccroché normalement.",
    'The call was hung up normally.'],
];

export function explainEndedReason(reason: unknown, isFr: boolean): string | null {
  if (typeof reason !== 'string' || !reason.trim()) return null;
  for (const [pattern, fr, en] of ENDED_REASONS) {
    if (pattern.test(reason)) return isFr ? fr : en;
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────────────
   LE PRÉCHAUFFAGE, HORS DU COMPOSANT.

   Le composant préchargeait déjà le SDK et la config « au montage ». Sauf
   qu'il n'est monté qu'à l'OUVERTURE du panneau, et avec `autoStart`: le
   montage et la pression sont donc le même instant. Les deux chargements
   tombaient ainsi en plein sur le chemin critique, et c'est ce qui se voit
   comme cinq à dix secondes avant que ça décroche: 764 ko de SDK WebRTC, plus
   un aller-retour serveur qui construit le prompt (et qui paie le réveil du
   serveur s'il dormait).

   Sortis du composant, ces deux chargements peuvent commencer bien avant, dès
   que la conversation est à l'écran. À la pression, il ne reste plus qu'à
   ouvrir la salle.

   Le cache de config est volontairement COURT. Cette réponse porte la voix et
   le prompt: la garder longtemps ferait parler l'agent avec un réglage que
   l'utilisateur vient de changer. Soixante secondes couvrent « j'ouvre le
   panneau puis j'appelle », pas « je modifie ma voix puis j'appelle ». */
const CONFIG_TTL_MS = 60_000;
let sdkPromise: Promise<any> | null = null;
const configCache = new Map<string, { at: number; promise: Promise<any> }>();

export function loadVapiSdk(): Promise<any> {
  if (!sdkPromise) {
    sdkPromise = import('@vapi-ai/web').then(m => m.default);
    // Un échec ne doit pas rester collé: la tentative suivante doit repartir.
    sdkPromise.catch(() => { sdkPromise = null; });
  }
  return sdkPromise;
}

export function loadLiveConfig(endpoint: string): Promise<any> {
  const hit = configCache.get(endpoint);
  if (hit && Date.now() - hit.at < CONFIG_TTL_MS) return hit.promise;
  const promise = api.get(endpoint).then(r => r.data);
  promise.catch(() => configCache.delete(endpoint));
  configCache.set(endpoint, { at: Date.now(), promise });
  return promise;
}

/**
 * À appeler dès que l'appel devient PLAUSIBLE, pas au moment où il est demandé.
 *
 * Sans argument, ne prépare que le SDK: c'est un fichier statique, il ne coûte
 * rien au serveur. Avec un point d'accès, prépare aussi la config, ce qui
 * absorbe le réveil éventuel du serveur.
 */
/**
 * Le moteur d'appel de Daily, mis en cache avant le clic.
 *
 * Mesure relevée sur iPhone: préparation 0,1 s, création 2,4 s, liaison 4,3 s.
 * La liaison est la plus lourde, et une part en est à nous: daily-js ne
 * contient pas son moteur, il le TÉLÉCHARGE depuis `c.daily.co` au moment
 * d'ouvrir la salle. Ce téléchargement tombe donc en plein dans l'attente, à
 * chaque cache vidé et à chaque premier appel d'un appareil.
 *
 * L'URL est déterministe et versionnée; la version est lue sur la
 * bibliothèque elle-même plutôt qu'écrite ici, sinon une mise à jour de
 * dépendance ferait précharger un fichier que personne n'utilise, sans que
 * rien ne le signale.
 *
 * Échec silencieux et volontaire: ce n'est qu'une mise en cache. Si elle ne
 * marche pas, l'appel se déroule exactement comme avant.
 */
async function prewarmDailyEngine() {
  try {
    const daily: any = await import('@daily-co/daily-js');
    const version = daily?.default?.version?.();
    if (typeof version !== 'string' || !version) return;
    await fetch(
      `https://c.daily.co/call-machine/versioned/${version}/static/call-machine-object-bundle.js`,
      { credentials: 'omit', cache: 'force-cache' },
    );
  } catch { /* une mise en cache ratée ne coûte que son absence */ }
}

export function prewarmLiveCall(endpoint?: string) {
  void loadVapiSdk().then(prewarmDailyEngine).catch(() => undefined);
  if (endpoint) void loadLiveConfig(endpoint).catch(() => undefined);
}

/**
 * Live in-browser voice call with THIS client's receptionist (real ElevenLabs
 * voice + their config), via the Vapi Web SDK — the same tech as the public
 * home-page demo, but personalized. Config (public key + assistant) comes from
 * GET /my-dashboard/voice/live-config.
 */
export default function VapiLiveCall({
  isFr = true,
  /**
   * Which assistant to dial. Defaults to the receptionist; the setup assistant
   * passes its own endpoint. Same transport, same component — the difference
   * between the two agents belongs on the server, not in two copies of this.
   */
  endpoint = '/my-dashboard/voice/live-config',
  /**
   * Corps de requête. Absent, la config se lit en GET (le cas du tableau de
   * bord, où le serveur connaît déjà le client). Présent, elle se demande en
   * POST et se REDEMANDE à chaque changement: c'est le cas de la démo
   * publique, où le visiteur choisit son personnage et son entreprise juste
   * avant d'appeler.
   */
  body,
  /**
   * Le registre visuel. `product` est celui du tableau de bord, en dur et
   * sombre; `site` prend les tokens q2, donc il suit le thème clair comme
   * sombre. Sans ce choix, poser ce composant sur une page marketing y
   * plantait un rectangle noir au milieu du crème.
   */
  tone = 'product',
  /**
   * Le niveau de la voix de l'agent, remonté au parent.
   *
   * La carte d'essai dessine son propre diagramme, bien plus grand que les
   * cinq barres d'ici. Plutôt que de lui faire refaire le branchement du SDK
   * (et de rouvrir le piège du geste utilisateur), elle reçoit le niveau que
   * ce composant reçoit déjà de `volume-level`.
   */
  onLevel,
  /** Les petites barres n'ont pas lieu d'être quand le parent en dessine. */
  showBars = true,
  /**
   * La FORME du composant, pas son thème (c'est `tone` qui porte le thème).
   *
   * `card` est la carte historique: un rond de 44 px, un titre, un sous-titre.
   * Elle a un défaut quand elle vit dans un en-tête déjà occupé: appuyer sur
   * « Appel test live » faisait APPARAÎTRE une seconde carte qui redisait
   * « Parlez à votre agent comme un client au téléphone », c'est-à-dire qui
   * reposait la question à laquelle le clic venait de répondre.
   *
   * `pill` est le même composant réduit à un bouton: le bouton EST l'appel. Il
   * change d'étiquette et de couleur au lieu d'ouvrir quoi que ce soit, donc
   * rien ne bouge autour de lui.
   */
  variant = 'card',
  autoStart = false,
  onEnded,
}: {
  isFr?: boolean;
  endpoint?: string;
  body?: Record<string, unknown>;
  tone?: 'product' | 'site';
  onLevel?: (level: number, speaking: boolean) => void;
  showBars?: boolean;
  variant?: 'card' | 'pill';
  autoStart?: boolean;
  onEnded?: () => void;
}) {
  const [state, setState] = useState<CallState>('idle');
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /* La charge brute de l'erreur, SÉPARÉE du message.
     Elle était collée à la suite de la phrase, dans le même paragraphe de 11 px:
     sur iPhone, 220 caractères de JSON poussaient hors de la carte la seule
     ligne utile, la raison rendue par Vapi. Elle reste accessible (il n'y a pas
     de devtools sur un téléphone), mais repliée, sous le message. */
  const [payload, setPayload] = useState<string | null>(null);
  /* L'étape en cours pendant la connexion, et le décompte une fois établie.
     Trois choses très différentes se succèdent: préparer (SDK et config),
     créer l'appel chez Vapi, puis ouvrir la liaison audio. Les nommer, c'est
     déjà répondre à « pourquoi j'attends ». */
  const [phase, setPhase] = useState<'prep' | 'creating' | 'joining' | null>(null);
  const [timing, setTiming] = useState<string | null>(null);

  const vapiRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /* L'appel a-t-il DÉCROCHÉ ? Sans ce drapeau, `call-end` est traité de la même
     façon qu'il arrive après une conversation ou à la place de celle-ci, et
     c'est exactement le défaut signalé: « ça fait chargement puis ça disparaît »
     (retour utilisateur, iPhone). Un `call-end` reçu alors qu'on n'a jamais eu
     `call-start` n'est pas une fin d'appel, c'est un ÉCHEC de connexion, et il
     doit se dire. */
  const answeredRef = useRef(false);
  /* Une raison PRÉCISE a-t-elle déjà été affichée pour cette tentative ?
     `error` et `call-end` arrivent souvent l'un derrière l'autre pour un seul
     échec. Sans ce drapeau, le second remplacerait « Micro refusé », qui dit
     quoi faire, par la phrase générique, qui ne dit rien. */
  const reportedRef = useRef(false);
  /* Le garde-temps de la connexion. Si ni `call-start` ni `call-end` ni `error`
     n'arrivent, rien ne ramenait le composant au repos: le bouton restait rouge
     indéfiniment, sans rien à lire ni rien à faire. */
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* L'identifiant de l'appel chez Vapi, rendu par `start()`.
     Quand Vapi met fin à la session, le navigateur ne voit qu'une salle fermée
     (« Meeting has ended »): c'est le symptôme, jamais la cause. La cause
     n'existe que dans l'enregistrement d'appel, et cet identifiant est le seul
     moyen d'aller la chercher. */
  const callIdRef = useRef<string | null>(null);
  /* Le numéro de la tentative en cours. Le diagnostic revient en différé: sans
     ce jeton, la raison d'un appel abandonné viendrait écraser l'écran d'un
     appel relancé depuis. */
  const attemptRef = useRef(0);
  /* OÙ PASSENT LES SECONDES.
     « Toujours un chargement de 7 secondes »: trois étapes se cachent derrière
     un unique « Connexion… », et rien ne disait laquelle coûte. Elles sont
     donc marquées, affichées pendant l'attente, et récapitulées une fois en
     ligne. Sans ces repères, on optimise au hasard, ce qui a déjà coûté un
     aller-retour. */
  const marksRef = useRef<{ t0: number; ready: number; created: number }>({ t0: 0, ready: 0, created: 0 });

  const onSite = tone === 'site';

  /* Deux publics, deux messages. Le gérant peut agir sur le crédit Vapi, donc
     on le lui dit; le visiteur du site n'a aucune prise dessus et ne doit pas
     lire l'état de notre compte. */
  const providerFaultMessage = onSite
    ? (isFr
      ? "L'essai en direct est momentanément indisponible. Réessayez dans un moment."
      : 'The live trial is temporarily unavailable. Please try again shortly.')
    : (isFr
      ? 'Appel impossible : le crédit Vapi est épuisé. Rechargez le solde du compte Vapi.'
      : 'Call unavailable: the Vapi credit is exhausted. Top up the Vapi account balance.');

  /**
   * The dial config, fetched on mount rather than on press.
   *
   * This is what removes the microphone probe. The probe existed because
   * `api.get(endpoint)` sat between the press and `vapi.start()`, and an await
   * closes the gesture window the browser needs to grant the microphone. So the
   * component asked for the device itself, first thing, then released it — on
   * the belief that the grant outlives the track. It does on Chrome. It does NOT
   * on iOS Safari, which releases the permission with the track, so every call
   * prompted again, and the probe and the SDK ended up fighting over the device
   * ("Micro indisponible").
   *
   * With the config already in hand there is nothing to await: `vapi.start()`
   * runs inside the click and the SDK asks for the microphone once, itself, and
   * keeps the stream for as long as the call lasts.
   */
  const configRef = useRef<Promise<any> | null>(null);
  /* La VALEUR, une fois la promesse tenue, et pas seulement la promesse.
     C'est ce qui permet à la pression de partir sans un seul `await`. Attendre
     une promesse DÉJÀ tenue coûte quand même une microtâche, et Safari sur iOS
     ne garantit le jeton de geste utilisateur que sur la pile synchrone du
     `click`: passée cette microtâche, la demande de micro du SDK n'est plus
     rattachée au geste et le navigateur peut la refuser sans rien afficher.
     C'est la piste la plus probable du « ça charge puis ça disparaît » sur
     iPhone, et de toute façon le chemin synchrone est le bon. */
  const configValueRef = useRef<any>(null);
  const sdkValueRef = useRef<any>(null);

  /**
   * Le SDK, importé à la demande et préchargé au montage.
   *
   * `import Vapi from '@vapi-ai/web'` en tête de fichier tirait daily-js, sa
   * couche WebRTC, dans le paquet d'entrée: 764 ko que TOUT visiteur de la
   * page d'accueil téléchargeait avant le premier pixel, pour un appel que la
   * plupart ne lanceront jamais.
   *
   * Préchargé ici et non au clic, pour la même raison que la config: au
   * moment de la pression le module est déjà résolu, donc l'`await` rend la
   * main sur une microtâche et le geste tient encore quand le SDK demande le
   * micro. Un import dynamique fait AU clic rouvrirait le défaut qu'on vient
   * de fermer.
   */
  const sdkRef = useRef<Promise<any> | null>(null);

  /* Sérialisé pour servir de dépendance: un objet littéral change d'identité à
     chaque rendu du parent et relancerait la requête en boucle. */
  const bodyKey = body ? JSON.stringify(body) : '';

  useEffect(() => {
    // Failures are swallowed here: `start()` awaits the same promise and reports
    // the reason where the user can see it. A red banner on a page nobody has
    // pressed anything on would be noise.
    configValueRef.current = null;
    /* Le POST de la démo publique n'est pas mutualisable: son corps change avec
       le personnage choisi. Le GET du tableau de bord, si, et c'est celui qui
       peut avoir été préparé avant l'ouverture du panneau. */
    const load = bodyKey
      ? api.post(endpoint, JSON.parse(bodyKey)).then(r => r.data)
      : loadLiveConfig(endpoint);
    configRef.current = load;
    load.then(d => { configValueRef.current = d; }).catch(() => undefined);
  }, [endpoint, bodyKey]);

  useEffect(() => {
    sdkRef.current = loadVapiSdk();
    sdkRef.current.then(m => { sdkValueRef.current = m; }).catch(() => undefined);
  }, []);

  useEffect(() => () => {
    // Cleanup on unmount: stop any active call.
    try { vapiRef.current?.stop?.(); } catch { /* noop */ }
    if (timerRef.current) clearInterval(timerRef.current);
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
  }, []);

  // Opened deliberately (the composer's voice button), so dial immediately
  // rather than asking the user to press a second button for the same intent.
  useEffect(() => {
    if (autoStart) void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const stop = () => {
    try { vapiRef.current?.stop?.(); } catch { /* noop */ }
  };

  /* Retour au repos, d'où que vienne l'échec, avec le compteur et le garde-temps
     arrêtés. Il y avait trois copies de ces lignes et chacune en oubliait une. */
  const settle = (message?: string | null, detail?: string | null) => {
    if (message) { setError(message); reportedRef.current = true; }
    /* Toujours posé, y compris à null: un détail laissé d'une tentative
       précédente se lirait comme celui de l'échec qu'on affiche. */
    setPayload(detail ?? null);
    setPhase(null);
    setState('idle');
    setSpeaking(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
  };

  /**
   * REMPLACER le message par la raison que SEUL Vapi connaît.
   *
   * Le navigateur reçoit « Meeting has ended » quel que soit le motif: voix
   * indisponible, crédit épuisé, modèle refusé. Le motif vit dans
   * l'enregistrement d'appel, sous `endedReason`, et il faut le demander.
   *
   * Il était jusqu'ici AJOUTÉ à la fin d'une phrase générique elle-même suivie
   * du JSON brut. Deux défauts, tous deux constatés sur iPhone: la ligne utile
   * arrivait hors de la carte, et la phrase générique (« vérifiez le micro et la
   * connexion ») envoyait chercher au mauvais endroit une panne dont on
   * connaissait désormais la vraie cause. Dès qu'une raison est connue, elle
   * prend donc toute la place.
   *
   * Silencieux en cas d'échec, et réservé au tableau de bord: la route est
   * authentifiée côté client, et sur le site public le lecteur est un prospect
   * à qui `pipeline-error-...` ne dirait rien.
   */
  const applyEndedReason = async (base: string) => {
    if (onSite || !endpoint.startsWith('/my-dashboard')) return;
    /* Ne PAS exiger l'identifiant. C'est ce qui rendait ce diagnostic muet à
       son premier essai: l'événement d'erreur devance la promesse de `start()`,
       donc l'identifiant était encore nul et la requête était abandonnée.
       Sans lui, le serveur retrouve l'appel dans les récents; avec lui, il va
       droit au but. */
    const attempt = attemptRef.current;
    /* Et NE PAS interroger tout de suite: Vapi écrit `endedReason` après avoir
       clos l'appel, si bien qu'une première lecture immédiate le trouve encore
       « in-progress », sans raison à lire. Trois essais espacés, puis on
       renonce en laissant le message de base. */
    for (const wait of [900, 2500, 5000]) {
      await new Promise(r => setTimeout(r, wait));
      // L'utilisateur a relancé un appel entre-temps: ce diagnostic-ci parle
      // d'un appel qui n'est plus à l'écran, il n'a plus rien à écrire.
      if (attempt !== attemptRef.current) return;
      try {
        const id = callIdRef.current;
        const { data } = await api.get(`/my-dashboard/voice/live-diagnosis${id ? `/${id}` : ''}`);
        if (data?.endedReason && attempt === attemptRef.current) {
          const said = explainEndedReason(data.endedReason, isFr);
          /* L'identifiant brut reste entre parenthèses même quand il est
             traduit: c'est lui qu'on nous citera au support, et une phrase
             française ne se recherche pas dans une documentation. */
          const head = said ? `${said} (${data.endedReason})` : `Vapi : ${data.endedReason}`;
          /* Le mode EFFECTIF vient du serveur, pas du réglage local: une voix
             clonée force le classique par-dessus « direct », et proposer de
             rebasculer un mode qui n'a jamais servi ferait perdre un essai. */
          const hint = data.voiceMode === 'realtime'
            ? (isFr
              ? ' Le moteur est réglé sur Direct : repassez-le sur Classique dans Réceptionniste IA pour voir si le reste fonctionne.'
              : ' The engine is set to Direct: switch it back to Classic in AI Receptionist to see whether the rest works.')
            : '';
          setError(`${head}${hint}`);
          return;
        }
      } catch { /* on retente; le message de base reste en attendant */ }
    }
    /* Après trois essais, le dire. Rester muet est ce qui a coûté deux
       allers-retours: on ne savait pas distinguer « la raison n'est pas
       arrivée » de « le code n'a même pas demandé ». */
    if (attempt === attemptRef.current) setError(`${base} (Vapi : raison indisponible)`);
  };

  const connectFailed = isFr
    ? "L'appel n'a pas pu s'établir. Autorisez le micro pour ce site, puis réessayez ; sur iPhone, ouvrez la page dans Safari plutôt que dans un navigateur intégré."
    : 'The call could not connect. Allow the microphone for this site, then try again; on iPhone, open the page in Safari rather than an in-app browser.';

  const start = async () => {
    setError(null);
    setPayload(null);
    setTiming(null);
    setPhase('prep');
    marksRef.current = { t0: performance.now(), ready: 0, created: 0 };
    answeredRef.current = false;
    reportedRef.current = false;
    callIdRef.current = null;
    attemptRef.current += 1;
    setState('connecting');
    /* Le SDK peut ne JAMAIS rien émettre: sur iOS, une demande de micro qui
       arrive hors du geste est parfois refusée en silence. Sans ce garde-temps,
       le bouton tourne alors sans fin. */
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    connectTimeoutRef.current = setTimeout(() => {
      if (answeredRef.current) return;
      stop();
      settle(connectFailed);
      void applyEndedReason(connectFailed);
    }, 25000);
    try {
      // Already resolved in the common case, so this await returns on a
      // microtask and the click is still the current gesture when `vapi.start()`
      // asks for the microphone. Only a press during the very first seconds of
      // the page pays for the round-trip.
      if (!configRef.current) {
        configRef.current = bodyKey
          ? api.post(endpoint, JSON.parse(bodyKey)).then(r => r.data)
          : loadLiveConfig(endpoint);
      }
      if (!sdkRef.current) sdkRef.current = loadVapiSdk();
      /* LE CAS COURANT NE PASSE PLUS PAR `await`. Les deux valeurs sont là
         depuis le montage: les lire dans les refs garde la pile synchrone du
         clic, donc le geste utilisateur est encore valide quand le SDK demande
         le micro. Le `await` ne reste que pour la pression lancée dans les
         toutes premières secondes de la page, quand il n'y a rien d'autre à
         faire que d'attendre le réseau. */
      const [data, Vapi] = (configValueRef.current && sdkValueRef.current)
        ? [configValueRef.current, sdkValueRef.current]
        : await Promise.all([configRef.current, sdkRef.current]);
      if (!data?.publicKey) throw new Error('missing key');
      marksRef.current.ready = performance.now();
      setPhase('creating');

      /* UNE seule instance pour toute la vie du composant.
       *
       * Elle était recréée à chaque appel, et l'ancienne n'était que
       * `stop()`ée: le SDK garde alors son objet Daily vivant, si bien que le
       * second essai en fabriquait un deuxième et que WebRTC refusait —
       * « Duplicate DailyIframe instances are not allowed » (retour
       * utilisateur, systématique au deuxième appel). Un appel n'a pas besoin
       * d'un SDK neuf: `start()` et `stop()` suffisent, et les écouteurs se
       * posent donc une fois, avec l'instance.
       */
      let vapi = vapiRef.current;
      const isNew = !vapi;
      if (!vapi) {
        vapi = new Vapi(data.publicKey);
        vapiRef.current = vapi;
      }

      if (isNew) {
        vapi.on('call-start', () => {
          const { t0, ready, created } = marksRef.current;
          if (t0) {
            const s = (a: number, b: number) => `${Math.max(0, (b - a) / 1000).toFixed(1)}s`;
            setTiming(`${isFr ? 'préparation' : 'prep'} ${s(t0, ready || t0)} · ${isFr ? 'création' : 'create'} ${s(ready || t0, created || ready || t0)} · ${isFr ? 'liaison' : 'link'} ${s(created || ready || t0, performance.now())}`);
          }
          setPhase(null);
          answeredRef.current = true;
          if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
          setState('active');
          setSecs(0);
          timerRef.current = setInterval(() => setSecs(s => s + 1), 1000);
        });
        vapi.on('call-end', () => {
          /* Deux événements portent le même nom et ne veulent pas dire la même
             chose. Après `call-start`, c'est une fin d'appel: on retourne au
             repos sans rien dire, c'est normal. AVANT `call-start`, l'appel n'a
             jamais décroché: le taire, c'est le bug signalé, un chargement qui
             s'efface sans laisser un mot à lire ni rien à corriger. */
          const answered = answeredRef.current;
          answeredRef.current = false;
          const report = shouldReportConnectFailure(answered, reportedRef.current);
          settle(report ? connectFailed : null);
          if (report) void applyEndedReason(connectFailed);
          if (answered) onEnded?.();
        });
        vapi.on('speech-start', () => setSpeaking(true));
        vapi.on('speech-end', () => setSpeaking(false));
        vapi.on('volume-level', (l: number) => setLevel(l));
        vapi.on('error', (e: any) => {
          // Vapi routinely emits errors with no message. Saying "Erreur appel"
          // and nothing else sends the user looking in the wrong place.
          /* Une fin normale ressemble à une erreur sur ce transport. Le tri se
             fait AVANT tout le reste, sinon le raccroché d'un appel réussi
             s'affiche en rouge comme une panne. */
          if (isNormalTeardown(e, answeredRef.current)) {
            /* On revient au repos, mais SANS retomber `answeredRef`: le
               `call-end` qui suit cette éjection y lirait alors « l'appel n'a
               jamais décroché » et repeindrait en rouge la fin qu'on vient
               d'accepter. C'est lui qui préviendra le parent, une seule fois. */
            settle(null);
            return;
          }
          answeredRef.current = false;
          if (isMicDenied(e)) {
            return settle(isFr
              ? 'Micro refusé. Autorisez le microphone pour ce site, puis relancez.'
              : 'Microphone denied. Allow the microphone for this site, then start again.');
          }
          if (isProviderFault(e)) return settle(providerFaultMessage);
          // Le détail brut n'a de sens que sur le tableau de bord, où il a été
          // ajouté faute de devtools sur un téléphone. Sur le site public, le
          // lecteur est un prospect: il n'a rien à faire de notre charge JSON.
          const detail = onSite ? null : errorDetail(e);
          const message = errorText(e) || (isFr
            ? "L'appel s'est interrompu. Vérifiez le micro et la connexion, puis réessayez."
            : 'The call dropped. Check the microphone and connection, then try again.');
          /* Le détail part dans son propre tiroir au lieu de rallonger la
             phrase: c'est ce qui rendait la raison de Vapi illisible. */
          settle(message, detail);
          void applyEndedReason(message);
        });
      }

      /* `start()` rend l'appel créé chez Vapi. On le garde AVANT toute suite:
         si la session est fermée dans la foulée, c'est le seul fil qui reste
         pour en apprendre la raison. */
      const call: any = await vapi.start(data.assistant);
      if (typeof call?.id === 'string') callIdRef.current = call.id;
      marksRef.current.created = performance.now();
      setPhase('joining');
    } catch (e: any) {
      // A rejected config must not be cached: the next press would fail on the
      // stale rejection instead of retrying the request.
      if (e?.response || e?.request) {
        configRef.current = null;
        configValueRef.current = null;
        configCache.delete(endpoint);
      }
      settle(
        isMicDenied(e)
          ? (isFr
            ? 'Micro refusé. Autorisez le microphone pour ce site, puis relancez.'
            : 'Microphone denied. Allow the microphone for this site, then start again.')
          : e?.response?.status === 429
            /* Quota de demo epuise. Ce n'est pas une panne: le dire comme tel,
               sinon le visiteur reessaie en boucle. */
            ? (e?.response?.data?.error === 'demo_daily_quota'
              ? (isFr
                ? 'Vous avez utilisé vos deux minutes d’essai du jour. Revenez demain, ou créez un compte pour appeler sans limite.'
                : 'You have used your two trial minutes for today. Come back tomorrow, or create an account to call without limits.')
              : (isFr
                ? 'Trop d’essais coup sur coup. Patientez une minute, puis réessayez.'
                : 'Too many attempts in a row. Wait a minute, then try again.'))
          : isProviderFault(e)
            ? providerFaultMessage
            : e?.response?.status === 503
            ? (isFr ? 'Appel live non configuré (clé Vapi).' : 'Live call not configured (Vapi key).')
            : (errorText(e) || (isFr ? 'Impossible de démarrer l’appel.' : 'Could not start the call.')),
      );
    }
  };

  useEffect(() => { onLevel?.(level, speaking); }, [level, speaking, onLevel]);

  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const active = state === 'active';
  const busy = active || state === 'connecting';

  /* LA PILULE: le bouton EST l'appel.
   *
   * Rien ne s'ouvre, rien ne pousse le reste de la page vers le bas. L'étiquette
   * traverse les états au même endroit (« Appel test live » → l'étape en cours →
   * le décompte), et la couleur passe de l'indigo au rouge quand il y a quelque
   * chose à raccrocher.
   *
   * L'erreur, elle, sort du bouton: un échec doit se lire en toutes lettres, et
   * une pilule de 9 unités de haut ne peut pas porter une phrase. */
  if (variant === 'pill') {
    const label = active
      ? `${mm}:${ss}`
      : state === 'connecting'
        ? (phase === 'creating'
            ? (isFr ? 'Création…' : 'Creating…')
            : phase === 'joining'
              ? (isFr ? 'Liaison…' : 'Linking…')
              : (isFr ? 'Préparation…' : 'Preparing…'))
        : (isFr ? 'Appel test live' : 'Live test call');

    return (
      <div className="flex flex-col items-end gap-1.5 min-w-0">
        <button
          type="button"
          onClick={busy ? stop : start}
          disabled={state === 'ending'}
          aria-label={active
            ? (isFr ? 'Raccrocher' : 'Hang up')
            : (isFr ? 'Appeler ma réceptionniste' : 'Call my receptionist')}
          className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[12.5px] font-medium transition-colors duration-150 active:scale-[0.97] disabled:opacity-60"
          style={busy
            ? { background: 'rgba(220,38,38,0.16)', color: '#F5A5A5' }
            : { background: 'rgba(122,95,255,0.16)', color: '#b9a8ff' }}
        >
          {state === 'connecting'
            ? <Loader2 size={14} aria-hidden="true" />
            : active
              ? <PhoneOff size={14} aria-hidden="true" />
              : <PhoneCall size={14} aria-hidden="true" />}
          {/* L'étiquette seule change, jamais la pilule: une largeur qui saute
              à chaque étape ferait bouger tout l'en-tête. `mode="popLayout"`
              retire l'ancienne du flux pendant que la nouvelle entre, donc les
              deux ne se chevauchent pas en largeur. */}
          <span className="hidden sm:inline overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={label}
                className="inline-block tabular-nums whitespace-nowrap"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              >
                {label}
              </motion.span>
            </AnimatePresence>
          </span>
          {/* Qui parle, réduit à un point. Pendant un appel c'est la seule
              chose qu'on cherche des yeux, et elle tient dans 6 px. */}
          {active && (
            <span
              aria-hidden="true"
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: speaking ? '#F5A5A5' : 'rgba(245,165,165,0.35)',
                transform: `scale(${1 + Math.min(level, 1) * 0.6})`,
                transition: 'transform 90ms linear, background-color 120ms linear',
              }}
            />
          )}
        </button>

        {error && (
          <div className="max-w-[min(20rem,70vw)] text-right">
            <p className="text-[11px] leading-snug" style={{ color: '#dc2626' }}>{error}</p>
            {payload && (
              <details className="mt-0.5">
                <summary className="text-[10.5px] cursor-pointer" style={{ color: '#8B8BA7' }}>
                  {isFr ? 'Détails techniques' : 'Technical details'}
                </summary>
                <p className="mt-1 text-[10px] break-all" style={{ color: '#6E6E85' }}>{payload}</p>
              </details>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border p-3 flex items-center gap-3 ${
        onSite ? 'bg-q2-band border-q2-plate' : ''
      }`}
      style={onSite
        ? (active ? { borderColor: 'color-mix(in srgb, var(--q2-indigo) 50%, transparent)' } : undefined)
        : { borderColor: active ? 'rgba(20,184,166,0.5)' : 'rgba(255,255,255,0.10)', background: '#0D0D10' }}
    >
      {/* Le bouton, et l'anneau qui respire avec la voix.
          Le turquoise a disparu des deux registres: il n'appartient pas à la
          marque (indigo + violet), et l'icône y était vert foncé sur vert, donc
          peu lisible. Fond indigo, icône blanche. */}
      <span className="relative flex-shrink-0 w-11 h-11">
        {/* L'anneau suit `volume-level`, que le SDK émet pour la voix de
            l'AGENT: il grossit quand elle parle et retombe quand elle écoute.
            Rien d'aléatoire ici — une animation décorative jouée « pendant
            l'appel » ne dirait pas qui parle, ce qui est la seule chose que
            cet anneau a à raconter. `scale` et `opacity` seulement: les deux
            se composent, donc rien ne déclenche de mise en page. */}
        {active && (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: onSite ? 'var(--q2-indigo)' : '#dc2626',
              transform: `scale(${1 + Math.min(level, 1) * 0.85})`,
              opacity: 0.10 + Math.min(level, 1) * 0.3,
              transition: 'transform 90ms linear, opacity 90ms linear',
            }}
          />
        )}
        <button
          type="button"
          onClick={active || state === 'connecting' ? stop : start}
          disabled={state === 'ending'}
          aria-label={active ? (isFr ? 'Raccrocher' : 'Hang up') : (isFr ? 'Appeler ma réceptionniste' : 'Call my receptionist')}
          className="relative w-11 h-11 rounded-full grid place-items-center transition-colors"
          /* Fond BLANC, icône noire (demande utilisateur). Le filet n'est pas
             décoratif: sur la bande crème du thème clair, un rond blanc sans
             bord n'a plus de contour du tout. Raccrocher reste rouge, c'est
             la seule couleur qui doit se distinguer d'un coup d'oeil. */
          style={active || state === 'connecting'
            ? { background: '#dc2626', color: '#fff' }
            : { background: '#fff', color: '#0B0B0D', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.10)' }}
        >
          {state === 'connecting'
            ? <Loader2 size={18} />
            : active ? <PhoneOff size={18} /> : <PhoneCall size={18} />}
        </button>
      </span>

      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-semibold ${onSite ? 'text-q2-ink' : 'text-[#F2F2F2]'}`}>
          {active
            ? (isFr ? 'En ligne' : 'On the line')
            : state === 'connecting'
              /* Trois étapes derrière un seul mot. Les nommer répond déjà à
                 « pourquoi j'attends », et dit laquelle coûte quand elle
                 traîne. */
              ? (phase === 'creating'
                  ? (isFr ? 'Création de l’appel…' : 'Creating the call…')
                  : phase === 'joining'
                    ? (isFr ? 'Liaison audio…' : 'Linking audio…')
                    : (isFr ? 'Préparation…' : 'Preparing…'))
              /* Le tableau de bord parle au gérant de SON agent; la carte
                 publique s'adresse a un visiteur qui n'en a pas encore. */
              : onSite
                ? (isFr ? 'Démarrer l’appel' : 'Start the call')
                : (isFr ? 'Tester en live (vraie voix)' : 'Test live (real voice)')}
        </p>
        {/* Le message d'abord, la charge brute seulement si on la demande.
            Voir `payload`: les deux vivaient dans ce paragraphe, et le JSON y
            poussait la raison de Vapi hors de l'écran sur un téléphone. */}
        <p
          className={`text-[11px] ${onSite && !error ? 'text-q2-body' : ''}`}
          style={error ? { color: '#dc2626' } : onSite ? undefined : { color: '#8B8BA7' }}
        >
          {error
            ? error
            : active
              ? `${mm}:${ss} · ${speaking ? (isFr ? 'elle parle…' : 'she’s speaking…') : (isFr ? 'à vous' : 'your turn')}`
              : onSite
                ? (isFr ? 'Elle décroche, parlez-lui normalement.' : 'She picks up, just talk to her.')
                : (isFr ? 'Parlez à votre agent comme un client au téléphone.' : 'Talk to your agent like a caller.')}
        </p>
        {error && payload && (
          <details className="mt-1">
            <summary
              className={`text-[11px] cursor-pointer ${onSite ? 'text-q2-faint' : ''}`}
              style={onSite ? undefined : { color: '#8B8BA7' }}
            >
              {isFr ? 'Détails techniques' : 'Technical details'}
            </summary>
            <p
              className={`mt-1 text-[10px] break-all ${onSite ? 'text-q2-faint' : ''}`}
              style={onSite ? undefined : { color: '#6E6E85' }}
            >
              {payload}
            </p>
          </details>
        )}
      </div>

      {/* Le détail des étapes, une fois en ligne et sur le tableau de bord
          seulement. C'est ce qui permet de dire OÙ passent les secondes au lieu
          de le supposer: préparation (SDK et config, normalement nulle grâce au
          préchauffage), création chez Vapi, puis ouverture de la liaison. */}
      {active && timing && !onSite && (
        <p className="text-[10px] tabular-nums shrink-0 hidden sm:block" style={{ color: '#6B6B84' }}>
          {timing}
        </p>
      )}

      {active && showBars && (
        <div className="flex items-end gap-0.5 h-6 flex-shrink-0" aria-hidden="true">
          {/* Les barres portaient un `Math.random()`: elles s'agitaient dès que
              quelqu'un parlait, quelle que soit l'intensité, donc elles ne
              montraient rien. Chacune a maintenant un poids FIXE appliqué au
              niveau réel: le profil reste stable, seule la hauteur bouge, et
              elle bouge avec la voix. */}
          {[0.55, 0.8, 1, 0.8, 0.55].map((weight, i) => (
            <span
              key={i}
              className="w-0.5 rounded-full"
              style={{
                height: `${Math.max(12, Math.min(100, level * 150 * weight))}%`,
                background: 'var(--q2-indigo)',
                transition: 'height 90ms linear',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
