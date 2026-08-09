import { useEffect, useRef, useState } from 'react';
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
  // Last resort when the SDK gives no readable message: show the raw payload,
  // trimmed. Without devtools on a phone there is no other way to learn why a
  // call refuses to start, and a generic sentence has already proved useless
  // twice. Ugly on purpose, and only ever shown when nothing better exists.
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
  autoStart = false,
  onEnded,
}: {
  isFr?: boolean;
  endpoint?: string;
  body?: Record<string, unknown>;
  tone?: 'product' | 'site';
  onLevel?: (level: number, speaking: boolean) => void;
  showBars?: boolean;
  autoStart?: boolean;
  onEnded?: () => void;
}) {
  const [state, setState] = useState<CallState>('idle');
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const vapiRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const load = bodyKey
      ? api.post(endpoint, JSON.parse(bodyKey)).then(r => r.data)
      : api.get(endpoint).then(r => r.data);
    configRef.current = load;
    load.catch(() => undefined);
  }, [endpoint, bodyKey]);

  useEffect(() => {
    sdkRef.current = import('@vapi-ai/web').then(m => m.default);
    sdkRef.current.catch(() => undefined);
  }, []);

  useEffect(() => () => {
    // Cleanup on unmount: stop any active call.
    try { vapiRef.current?.stop?.(); } catch { /* noop */ }
    if (timerRef.current) clearInterval(timerRef.current);
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

  const start = async () => {
    setError(null);
    setState('connecting');
    try {
      // Already resolved in the common case, so this await returns on a
      // microtask and the click is still the current gesture when `vapi.start()`
      // asks for the microphone. Only a press during the very first seconds of
      // the page pays for the round-trip.
      if (!configRef.current) {
        configRef.current = bodyKey
          ? api.post(endpoint, JSON.parse(bodyKey)).then(r => r.data)
          : api.get(endpoint).then(r => r.data);
      }
      if (!sdkRef.current) sdkRef.current = import('@vapi-ai/web').then(m => m.default);
      const [data, Vapi] = await Promise.all([configRef.current, sdkRef.current]);
      if (!data?.publicKey) throw new Error('missing key');

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
          setState('active');
          setSecs(0);
          timerRef.current = setInterval(() => setSecs(s => s + 1), 1000);
        });
        vapi.on('call-end', () => {
          setState('idle');
          setSpeaking(false);
          if (timerRef.current) clearInterval(timerRef.current);
          onEnded?.();
        });
        vapi.on('speech-start', () => setSpeaking(true));
        vapi.on('speech-end', () => setSpeaking(false));
        vapi.on('volume-level', (l: number) => setLevel(l));
        vapi.on('error', (e: any) => {
          // Vapi routinely emits errors with no message. Saying "Erreur appel"
          // and nothing else sends the user looking in the wrong place.
          const stop = () => {
            setState('idle');
            if (timerRef.current) clearInterval(timerRef.current);
          };
          if (isMicDenied(e)) {
            setError(isFr
              ? 'Micro refusé. Autorisez le microphone pour ce site, puis relancez.'
              : 'Microphone denied. Allow the microphone for this site, then start again.');
            return stop();
          }
          if (isProviderFault(e)) {
            setError(providerFaultMessage);
            return stop();
          }
          // Le détail brut n'a de sens que sur le tableau de bord, où il a été
          // ajouté faute de devtools sur un téléphone. Sur le site public, le
          // lecteur est un prospect: il n'a rien à faire de notre charge JSON.
          const detail = onSite ? null : errorDetail(e);
          setError(errorText(e) || [
            isFr
              ? "L'appel s'est interrompu. Vérifiez le micro et la connexion, puis réessayez."
              : 'The call dropped. Check the microphone and connection, then try again.',
            detail,
          ].filter(Boolean).join(' — '));
          stop();
        });
      }

      await vapi.start(data.assistant);
    } catch (e: any) {
      // A rejected config must not be cached: the next press would fail on the
      // stale rejection instead of retrying the request.
      if (e?.response || e?.request) configRef.current = null;
      setError(
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
      setState('idle');
    }
  };

  useEffect(() => { onLevel?.(level, speaking); }, [level, speaking, onLevel]);

  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const active = state === 'active';

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
            ? <Loader2 size={18} className="animate-spin" />
            : active ? <PhoneOff size={18} /> : <PhoneCall size={18} />}
        </button>
      </span>

      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-semibold ${onSite ? 'text-q2-ink' : 'text-[#F2F2F2]'}`}>
          {active
            ? (isFr ? 'En ligne' : 'On the line')
            : state === 'connecting'
              ? (isFr ? 'Connexion…' : 'Connecting…')
              /* Le tableau de bord parle au gérant de SON agent; la carte
                 publique s'adresse a un visiteur qui n'en a pas encore. */
              : onSite
                ? (isFr ? 'Démarrer l’appel' : 'Start the call')
                : (isFr ? 'Tester en live (vraie voix)' : 'Test live (real voice)')}
        </p>
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
      </div>

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
