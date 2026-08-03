import { useRef, useState } from 'react';
import { Play, Square, Mic } from 'lucide-react';
import api from '../../../services/api';

export interface Character {
  id: string;
  name: string;
  language: 'fr' | 'en';
  accent: 'FR' | 'BE' | 'US';
  gender: 'f' | 'm';
  personaKey: string;
  taglineFr: string;
  taglineEn: string;
  previewFr: string;
  previewEn: string;
}

// Aperçu TTS du navigateur. C'est un repli grossier : l'appel réel utilise la
// voix ElevenLabs, ceci sert juste à entendre vite le ton et la réplique.
function speak(text: string, lang: 'fr' | 'en', onEnd: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) { onEnd(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
  const match = window.speechSynthesis.getVoices().find(v => v.lang?.toLowerCase().startsWith(u.lang.toLowerCase().slice(0, 2)));
  if (match) u.voice = match;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.speak(u);
}

type AudioCtor = typeof AudioContext;
function audioContextCtor(): AudioCtor | null {
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext || w.webkitAudioContext || null;
}

const ACCENT_LABEL: Record<string, string> = { FR: 'FR', BE: 'Belgique', US: 'EN' };

// Personnages sans portrait dans /public/characters. Les rendre directement en
// pastille évite le clignotement d'une image qui part en 404 à chaque montage.
const NO_PORTRAIT = new Set(['custom', 'ashley', 'ethan']);

/**
 * Portrait rond 48px. La voix clonée du client n'a pas de visage : elle porte
 * l'icône micro, qui dit ce qu'elle est plutôt que d'emprunter un portrait.
 */
function CharacterAvatar({ id, name }: { id: string; name: string }) {
  const [broken, setBroken] = useState(false);

  if (id === 'custom') {
    return (
      <span
        aria-hidden="true"
        className="w-12 h-12 shrink-0 rounded-full bg-q2-obsidian border border-q2-graphite-d grid place-items-center"
      >
        <Mic size={16} className="text-q2-lift" />
      </span>
    );
  }

  if (broken || NO_PORTRAIT.has(id)) {
    return (
      <span
        aria-hidden="true"
        className="w-12 h-12 shrink-0 rounded-full bg-q2-obsidian border border-q2-graphite-d grid place-items-center text-[15px] font-medium text-q2-lift"
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={`/characters/${id}.webp`}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className="w-12 h-12 shrink-0 rounded-full object-cover bg-q2-obsidian border border-q2-graphite-d"
    />
  );
}

export default function CharacterPickerV2({
  characters, value, onChange, isFr = true,
}: {
  characters: Character[];
  value: string;
  onChange: (id: string) => void;
  isFr?: boolean;
}) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const tokenRef = useRef(0);

  const stopAll = () => {
    window.speechSynthesis?.cancel();
    tokenRef.current += 1;
    if (sourceRef.current) {
      // Sinon le gestionnaire remettrait à zéro l'état du bouton du clip qui
      // démarre, et non de celui qu'on arrête.
      sourceRef.current.onended = null;
      try { sourceRef.current.stop(); } catch { /* déjà terminé */ }
      sourceRef.current = null;
    }
  };

  /**
   * Joue le vrai clip ElevenLabs, avec repli sur le TTS du navigateur et un
   * message visible quand le serveur n'a pas de clé ou que la requête échoue.
   * Annoncer le repli compte : jouer en silence une voix robotique fait passer
   * un serveur mal configuré pour une mauvaise voix.
   *
   * Web Audio plutôt qu'un élément <audio>, à cause d'iOS. Safari n'autorise le
   * démarrage audio que depuis un geste utilisateur, et tout `await` ferme cette
   * fenêtre : il faudrait créer et débloquer l'élément de façon synchrone au
   * clic, puis échanger sa source ensuite. C'est cet échange qui échoue en
   * silence sur iOS : `play()` se résout, aucune erreur ne part, et on n'entend
   * jamais rien. Un AudioContext débloqué dans le même geste continue de
   * fonctionner après un await, et decodeAudioData rend des échantillons ou
   * lève : pas d'entre-deux silencieux.
   */
  const preview = (c: Character) => {
    if (playing === c.id) { stopAll(); setPlaying(null); return; }
    stopAll();
    setPlaying(c.id);

    const Ctor = audioContextCtor();
    if (!Ctor) {
      setNotice(isFr
        ? "Ce navigateur ne peut pas lire l'audio. Aperçu joué avec la voix du navigateur."
        : 'This browser cannot play audio. Playing the browser voice instead.');
      speak(isFr ? c.previewFr : c.previewEn, c.language, () => setPlaying(null));
      return;
    }

    // Créé et repris dans le clic. iOS démarre tout contexte suspendu et
    // n'autorise la reprise que depuis un geste ; le faire après le fetch
    // serait trop tard.
    const ctx = ctxRef.current ?? new Ctor();
    ctxRef.current = ctx;
    const resumed = ctx.state === 'suspended' ? ctx.resume().catch(() => undefined) : Promise.resolve();

    const token = ++tokenRef.current;

    void (async () => {
      // Sorti du try pour que le message d'échec puisse citer la taille reçue.
      let payload: ArrayBuffer | undefined;
      try {
        const { data } = await api.get(`/my-dashboard/characters/${c.id}/preview`, {
          responseType: 'arraybuffer',
        });
        payload = data as ArrayBuffer;
        await resumed;
        if (tokenRef.current !== token) return; // supplanté par un autre clic

        if (!payload.byteLength) throw new Error('empty_audio');

        // Lève sur tout ce qui n'est pas de l'audio décodable, exactement le
        // signal que l'élément <audio> refusait de donner.
        const buffer = await ctx.decodeAudioData(payload);
        if (tokenRef.current !== token) return;

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => {
          if (tokenRef.current === token) setPlaying(null);
        };
        sourceRef.current = source;
        setNotice(null);
        source.start();
      } catch (err) {
        if (tokenRef.current !== token) return;

        const message = (err as Error)?.message;
        if (message === 'empty_audio' || err instanceof DOMException) {
          // On attendait de l'audio décodable et il n'est pas arrivé. La taille
          // est dans le message exprès : 0 ko veut dire que le serveur n'a rien
          // envoyé, une taille réelle veut dire que le fichier est là et que
          // l'appareil l'a refusé. Sans elle, cet échec est indiscernable du
          // précédent.
          const ko = Math.round((payload?.byteLength ?? 0) / 1024);
          setNotice(isFr
            ? `Le fichier audio reçu n'a pas pu être décodé (${ko} ko). Aperçu joué avec la voix du navigateur.`
            : `The audio file could not be decoded (${ko} kB). Playing the browser voice instead.`);
          speak(isFr ? c.previewFr : c.previewEn, c.language, () => setPlaying(null));
          return;
        }

        const res = (err as { response?: { status?: number; data?: unknown } }).response;
        // La requête demande des octets bruts, donc un corps d'erreur arrive en
        // octets lui aussi et doit être décodé avant que le statut amont soit
        // lisible.
        let upstream: number | undefined;
        if (res?.data instanceof ArrayBuffer) {
          try { upstream = JSON.parse(new TextDecoder().decode(res.data))?.status; } catch { /* pas du JSON */ }
        }
        setNotice(
          res?.status === 503
            ? (isFr
              ? 'Voix réelles indisponibles : la clé ElevenLabs n\'est pas configurée sur le serveur. Aperçu joué avec la voix du navigateur.'
              : 'Real voices unavailable: the ElevenLabs key is not configured on the server. Playing the browser voice instead.')
            : (isFr
              ? `Aperçu ElevenLabs indisponible (ElevenLabs a répondu ${upstream ?? '?'}). Aperçu joué avec la voix du navigateur.`
              : `ElevenLabs preview unavailable (ElevenLabs replied ${upstream ?? '?'}). Playing the browser voice instead.`),
        );
        speak(isFr ? c.previewFr : c.previewEn, c.language, () => setPlaying(null));
      }
    })();
  };

  return (
    <>
      {notice && (
        <p
          role="status"
          className="mb-2 rounded-lg border border-q2-indigo/30 bg-q2-indigo/10 px-3 py-2 text-[11.5px] leading-snug text-q2-lift"
        >
          {notice}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {characters.map(c => {
          const sel = value === c.id;
          const tagline = isFr ? c.taglineFr : c.taglineEn;
          return (
            <div
              key={c.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors duration-150 ${
                sel
                  ? 'bg-q2-indigo/10 border-q2-indigo/55'
                  : 'bg-q2-obsidian border-q2-graphite-d'
              }`}
            >
              <CharacterAvatar id={c.id} name={c.name} />
              <button
                type="button"
                onClick={() => onChange(c.id)}
                aria-pressed={sel}
                className="flex-1 min-w-0 text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
              >
                <div className="flex items-center gap-2">
                  <p className={`text-[13px] font-medium truncate ${sel ? 'text-q2-lift' : 'text-white'}`}>{c.name}</p>
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-q2-graphite-d text-q2-fog">
                    {ACCENT_LABEL[c.accent] || c.accent} · {c.gender === 'f' ? 'F' : (isFr ? 'H' : 'M')}
                  </span>
                </div>
                <p className={`text-[11.5px] mt-0.5 ${sel ? 'text-q2-mist' : 'text-q2-fog'}`}>{tagline}</p>
              </button>
              <button
                type="button"
                onClick={() => { preview(c); }}
                aria-label={isFr ? `Écouter ${c.name}` : `Preview ${c.name}`}
                className="shrink-0 w-8 h-8 rounded-full grid place-items-center bg-q2-indigo/15 text-q2-lift hover:bg-q2-indigo/25 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
              >
                {playing === c.id
                  ? <Square size={13} aria-hidden="true" />
                  : <Play size={13} aria-hidden="true" />}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
