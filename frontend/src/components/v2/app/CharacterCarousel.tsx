import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Mic, Pencil, Play, Square } from 'lucide-react';
import api from '../../../services/api';
import type { Character } from './CharacterPickerV2';

/* Carrousel de personnages, registre produit V2 « instrument ». Une seule bulle
   ronde au centre, nom au-dessus, voix en dessous, flèches de part et d'autre.
   La grille (CharacterPickerV2) reste en place dans l'onboarding : elle sert à
   comparer, ce carrousel sert à choisir une fois que le choix est fait. */

const ACCENT_LABEL: Record<string, string> = { FR: 'FR', BE: 'Belgique', US: 'EN' };

// Personnages sans portrait dans /public/characters. Les rendre directement en
// pastille évite le clignotement d'une image qui part en 404 à chaque montage.
const NO_PORTRAIT = new Set(['custom', 'ashley', 'ethan']);

// Aperçu TTS du navigateur. Repli grossier : l'appel réel utilise la voix
// ElevenLabs, ceci sert juste à entendre vite le ton et la réplique.
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

/**
 * Lecture d'aperçu, identique à celle de CharacterPickerV2.
 *
 * Web Audio plutôt qu'un élément <audio>, à cause d'iOS. Safari n'autorise le
 * démarrage audio que depuis un geste utilisateur, et tout `await` ferme cette
 * fenêtre : il faudrait créer et débloquer l'élément de façon synchrone au clic,
 * puis échanger sa source ensuite. C'est cet échange qui échoue en silence sur
 * iOS : `play()` se résout, aucune erreur ne part, et on n'entend jamais rien.
 * Un AudioContext débloqué dans le même geste continue de fonctionner après un
 * await, et decodeAudioData rend des échantillons ou lève : pas d'entre-deux
 * silencieux.
 */
function useVoicePreview(isFr: boolean) {
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
          // La taille est dans le message exprès : 0 ko veut dire que le serveur
          // n'a rien envoyé, une taille réelle veut dire que le fichier est là et
          // que l'appareil l'a refusé. Sans elle, cet échec est indiscernable du
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

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    tokenRef.current += 1;
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      try { sourceRef.current.stop(); } catch { /* déjà terminé */ }
      sourceRef.current = null;
    }
  }, []);

  return { playing, notice, preview };
}

/** Portrait rond. La voix clonée n'a pas de visage : elle porte l'icône micro,
    qui dit ce qu'elle est plutôt que d'emprunter un portrait. */
function Bubble({ id, name, big = false }: { id: string; name: string; big?: boolean }) {
  const [broken, setBroken] = useState(false);
  const size = big
    ? 'w-[120px] h-[120px] sm:w-[150px] sm:h-[150px]'
    : 'w-9 h-9';
  const shell = `${size} shrink-0 rounded-full bg-q2-obsidian border border-q2-graphite-d`;

  if (id === 'custom') {
    return (
      <span aria-hidden="true" className={`${shell} grid place-items-center`}>
        <Mic size={big ? 34 : 14} className="text-q2-lift" />
      </span>
    );
  }

  if (broken || NO_PORTRAIT.has(id)) {
    return (
      <span
        aria-hidden="true"
        className={`${shell} grid place-items-center font-light text-q2-lift ${big ? 'text-[44px]' : 'text-[13px]'}`}
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
      className={`${shell} object-cover`}
    />
  );
}

function voiceLabel(c: Character, isFr: boolean) {
  const accent = ACCENT_LABEL[c.accent] || c.accent;
  const gender = c.gender === 'f' ? (isFr ? 'Femme' : 'Female') : (isFr ? 'Homme' : 'Male');
  return `${c.name} · ${accent} · ${gender}`;
}

export default function CharacterCarousel({
  characters, value, onChange, isFr = true,
}: {
  characters: Character[];
  value: string;
  onChange: (id: string) => void;
  isFr?: boolean;
}) {
  const reduce = useReducedMotion();
  const { playing, notice, preview } = useVoicePreview(isFr);
  const [dir, setDir] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const index = Math.max(0, characters.findIndex(c => c.id === value));
  const current = characters[index];

  // Le menu se ferme au clic dehors et à Échap : il recouvre la bulle, le
  // laisser ouvert bloquerait la navigation par flèches.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (!characters.length || !current) return null;

  const go = (delta: number) => {
    if (characters.length < 2) return;
    setDir(delta);
    const next = (index + delta + characters.length) % characters.length;
    onChange(characters[next].id);
  };

  const tagline = isFr ? current.taglineFr : current.taglineEn;
  const offset = reduce ? 0 : 44;
  // `custom` sur AnimatePresence : sans lui, l'élément qui sort garde la
  // direction du rendu précédent et repart du mauvais côté.
  const slide = {
    enter: (d: number) => ({ opacity: 0, x: d >= 0 ? offset : -offset }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d >= 0 ? -offset : offset }),
  };

  return (
    <>
      {notice && (
        <p
          role="status"
          className="mb-3 rounded-lg border border-q2-indigo/30 bg-q2-indigo/10 px-3 py-2 text-[11.5px] leading-snug text-q2-lift"
        >
          {notice}
        </p>
      )}

      <div
        role="group"
        aria-roledescription={isFr ? 'carrousel de personnages' : 'character carousel'}
        aria-label={isFr ? 'Personnage de la réceptionniste' : 'Receptionist character'}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
          if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        }}
        className="rounded-xl border border-q2-graphite-d bg-q2-obsidian px-3 py-6 sm:px-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
      >
        <span className="sr-only" aria-live="polite">
          {current.name}, {voiceLabel(current, isFr)}. {tagline}
        </span>

        <div className="flex items-center justify-center gap-2 sm:gap-5">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={characters.length < 2}
            aria-label={isFr ? 'Personnage précédent' : 'Previous character'}
            className="w-9 h-9 shrink-0 rounded-full grid place-items-center border border-q2-graphite-d text-q2-mist hover:border-q2-smoke-d hover:text-white transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 disabled:opacity-30"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>

          <div className="flex-1 min-w-0 overflow-hidden">
            <AnimatePresence initial={false} mode="wait" custom={dir}>
              <motion.div
                key={current.id}
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center gap-3"
              >
                <p className="text-[16px] font-medium text-white text-center truncate max-w-full">
                  {current.name}
                </p>
                <Bubble id={current.id} name={current.name} big />
              </motion.div>
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => go(1)}
            disabled={characters.length < 2}
            aria-label={isFr ? 'Personnage suivant' : 'Next character'}
            className="w-9 h-9 shrink-0 rounded-full grid place-items-center border border-q2-graphite-d text-q2-mist hover:border-q2-smoke-d hover:text-white transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 disabled:opacity-30"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Voix courante et bascule vers le catalogue complet */}
        <div ref={menuRef} className="relative mt-4 flex items-center justify-center gap-2">
          <span className="text-[12.5px] text-q2-mist truncate">{voiceLabel(current, isFr)}</span>

          <button
            type="button"
            onClick={() => preview(current)}
            aria-label={isFr ? `Écouter ${current.name}` : `Preview ${current.name}`}
            className="w-7 h-7 shrink-0 rounded-full grid place-items-center bg-q2-indigo/15 text-q2-lift hover:bg-q2-indigo/25 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
          >
            {playing === current.id
              ? <Square size={12} aria-hidden="true" />
              : <Play size={12} aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            aria-label={isFr ? 'Changer de voix' : 'Change voice'}
            className="w-7 h-7 shrink-0 rounded-full grid place-items-center border border-q2-graphite-d text-q2-fog hover:text-white hover:border-q2-smoke-d transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
          >
            <Pencil size={12} aria-hidden="true" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: reduce ? 0 : -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduce ? 0 : -4 }}
                transition={{ duration: 0.15 }}
                role="listbox"
                aria-label={isFr ? 'Voix disponibles' : 'Available voices'}
                className="absolute top-full left-1/2 -translate-x-1/2 z-20 mt-2 w-[280px] max-h-[264px] overflow-y-auto rounded-xl border border-q2-graphite-d bg-q2-carbon p-1"
              >
                {characters.map(c => {
                  const sel = c.id === current.id;
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${sel ? 'bg-q2-indigo/10' : ''}`}
                    >
                      <Bubble id={c.id} name={c.name} />
                      <button
                        type="button"
                        role="option"
                        aria-selected={sel}
                        onClick={() => {
                          const target = characters.findIndex(x => x.id === c.id);
                          setDir(target >= index ? 1 : -1);
                          onChange(c.id);
                          setMenuOpen(false);
                        }}
                        className="flex-1 min-w-0 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                      >
                        <p className={`text-[12.5px] font-medium truncate ${sel ? 'text-q2-lift' : 'text-white'}`}>
                          {c.name}
                        </p>
                        <p className="text-[11px] text-q2-fog truncate">
                          {ACCENT_LABEL[c.accent] || c.accent} · {c.gender === 'f' ? 'F' : (isFr ? 'H' : 'M')}
                        </p>
                      </button>
                      {sel && <Check size={13} className="shrink-0 text-q2-lift" aria-hidden="true" />}
                      <button
                        type="button"
                        onClick={() => preview(c)}
                        aria-label={isFr ? `Écouter ${c.name}` : `Preview ${c.name}`}
                        className="w-7 h-7 shrink-0 rounded-full grid place-items-center bg-q2-indigo/15 text-q2-lift hover:bg-q2-indigo/25 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                      >
                        {playing === c.id
                          ? <Square size={12} aria-hidden="true" />
                          : <Play size={12} aria-hidden="true" />}
                      </button>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {tagline && (
          <p className="mt-2 text-center text-[11.5px] text-q2-fog q2-body-text">{tagline}</p>
        )}

        {/* Repères de position : lire « 3 sur 8 » sans compter les points */}
        {characters.length > 1 && (
          <div className="mt-4 flex items-center justify-center gap-1.5" aria-hidden="true">
            {characters.map((c, i) => (
              <span
                key={c.id}
                className={`h-1 rounded-full transition-colors duration-150 ${
                  i === index ? 'w-4 bg-q2-lift' : 'w-1 bg-q2-graphite-d'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
