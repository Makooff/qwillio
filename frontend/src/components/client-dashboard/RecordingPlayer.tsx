import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Play, Pause, RefreshCw } from '../icons';
import api from '../../services/api';

/* Un seul bouton, qui s'allonge. Avant (12/09/2026) : une pilule « Écouter »
   ET un lecteur natif du navigateur en dessous, deux commandes pour un geste.
   Maintenant : le bouton de lecture est la pilule, et au clic elle s'étire
   vers la droite pour révéler la timeline et le temps. Le lecteur natif est
   remplacé par un <audio> muet piloté d'ici.

   L'enregistrement est LU PAR NOUS, avec le jeton, et joué depuis un blob :
   l'URL Vapi posée telle quelle en `src` donnait 0:00 / 0:00, signature
   expirée ou origine refusée, sans qu'on puisse le voir.

   L'étirement est un `layout` Framer (FLIP, donc transform), pas une
   transition de largeur : la largeur change d'un coup au rendu, et c'est le
   transform qui fait le trajet. Les enfants portent aussi `layout` pour ne
   pas être déformés pendant le trajet. */

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  callId: string;
}

export default function RecordingPlayer({ callId }: Props) {
  const reduce = useReducedMotion();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  /* Le blob est libéré quand le composant part (le parent le remonte par
     `key` à chaque appel sélectionné) ou quand une autre adresse le remplace. */
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.get(`/my-dashboard/calls/${callId}/recording`, { responseType: 'blob', timeout: 60_000 });
      setSrc(URL.createObjectURL(res.data as Blob));
      setPlaying(true);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 404
        ? 'Aucun enregistrement pour cet appel.'
        : `L'enregistrement n'a pas pu être chargé${status ? ` (${status})` : ''}.`);
    } finally {
      setLoading(false);
    }
  }, [callId]);

  /* `playing` est l'intention ; l'élément la suit. Un `play()` refusé par
     le navigateur (autoplay bloqué) remet l'intention à faux au lieu de
     laisser un bouton « Pause » sur un son qui ne joue pas. */
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !src) return;
    if (playing) {
      el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
  }, [playing, src]);

  const toggle = () => {
    if (loading) return;
    if (!src) { void load(); return; }
    setPlaying((p) => !p);
  };

  const seek = (value: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = value;
    setTime(value);
  };

  const open = src !== null;
  const progress = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;
  const label = loading ? 'Chargement de l’enregistrement'
    : !open ? 'Écouter l’enregistrement'
      : playing ? 'Mettre en pause' : 'Reprendre la lecture';

  return (
    <div>
      <motion.div
        layout={!reduce}
        transition={{ layout: { duration: 0.34, ease: EASE } }}
        style={{ borderRadius: 22 }}
        className={`flex h-11 items-center bg-white ${open ? 'w-full' : 'w-fit'}`}
      >
        {/* Le bouton garde la même forme fermé et ouvert : rond de 44 px, encre
            pleine. Fermé, il est la pilule entière, avec son libellé. */}
        <motion.button
          layout={!reduce ? 'position' : false}
          type="button"
          onClick={toggle}
          disabled={loading}
          aria-label={label}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full pl-4 pr-5 text-sm font-medium text-[#0a0a0a] transition-opacity hover:opacity-80 active:scale-[0.97] disabled:opacity-60"
        >
          {loading
            ? <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
            : playing
              ? <Pause size={14} aria-hidden="true" />
              : <Play size={14} aria-hidden="true" />}
          {!open && <span>{loading ? 'Chargement…' : 'Écouter'}</span>}
        </motion.button>

        {open && (
          <motion.div
            layout={!reduce ? 'position' : false}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, delay: reduce ? 0 : 0.14 }}
            className="flex min-w-0 flex-1 items-center gap-3 pr-4"
          >
            {/* La timeline : un rail, un remplissage, et la vraie glissière
                par-dessus, invisible mais focusable, pour le clavier et le
                lecteur d'écran. */}
            <div className="relative h-5 min-w-0 flex-1">
              <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#0a0a0a]/15">
                <div
                  className="h-full rounded-full bg-[#0a0a0a]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div
                className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0a0a0a]"
                style={{ left: `${progress}%` }}
              />
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(time, duration || 0)}
                onChange={(e) => seek(Number(e.target.value))}
                aria-label="Position dans l’enregistrement"
                aria-valuetext={`${clock(time)} sur ${clock(duration)}`}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-[#0a0a0a]/70">
              {clock(time)} / {clock(duration)}
            </span>
          </motion.div>
        )}
      </motion.div>

      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setTime(0); }}
          onError={() => setError("Le navigateur n'a pas pu lire cet enregistrement.")}
        />
      )}

      {error && (
        <p className="mt-2 text-xs text-[#A1A1A8]" role="alert">{error}</p>
      )}
    </div>
  );
}
