import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2, Upload, Loader2 } from '../icons';
import api from '../../services/api';

export interface CustomVoice {
  voiceId: string;
  name: string;
  /** Set by the server. Absent on a voice just picked from the list. */
  createdAt?: string;
  /** Cloned from the owner's recording, which drops style at call time. */
  cloned?: boolean;
}

/** ElevenLabs wants a real sample; under this a clone sounds like a stranger. */
const MIN_SECONDS = 20;
/** Past a minute the clone stops improving and the upload starts to hurt. */
const MAX_SECONDS = 90;

const ERRORS: Record<string, string> = {
  consent_required: "Il faut confirmer que la voix enregistrée est bien la vôtre.",
  elevenlabs_key_missing: "Le clonage n'est pas disponible : la clé ElevenLabs n'est pas configurée sur le serveur.",
  sample_too_short: "Enregistrement trop court. Parlez au moins 20 secondes d'affilée.",
  sample_too_large: "Enregistrement trop long. Une minute suffit largement.",
  voice_clone_failed: "Le clonage a échoué. Réessayez dans un instant.",
};

/**
 * Record once, and the receptionist answers in the owner's own voice.
 *
 * Deliberately not a modal: this sits under the character grid because a cloned
 * voice is one more choice among the others, not a separate ceremony.
 */
export default function VoiceCloner({
  voice, onChange, isFr = true,
}: {
  voice: CustomVoice | null;
  onChange: (v: CustomVoice | null) => void;
  isFr?: boolean;
}) {
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // The counter drives the stop button's own label, so it has to keep ticking
  // even while the user is not looking at the tab.
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  useEffect(() => {
    if (recording && seconds >= MAX_SECONDS) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, recording]);

  // A live microphone left open after unmount keeps the browser's recording
  // indicator on, which reads as spyware.
  useEffect(() => () => {
    recorderRef.current?.stream.getTracks().forEach(t => t.stop());
  }, []);

  const upload = async (blob: Blob, mimeType: string) => {
    setBusy(true);
    setError(null);
    try {
      const buf = await blob.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buf);
      // Chunked: String.fromCharCode(...) on a megabyte-long array overflows
      // the argument stack and throws.
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      const { data } = await api.post('/my-dashboard/voice-clone', {
        audio: btoa(binary),
        mimeType,
        label: isFr ? 'Ma voix' : 'My voice',
        consent: true,
      });
      onChange(data.voice);
      setConsent(false);
    } catch (err) {
      const res = (err as { response?: { status?: number; data?: { error?: string; upstream?: number } } }).response;
      const code = res?.data?.error || '';
      // A 401 from ElevenLabs on this endpoint is almost always a free plan:
      // the same key works for the voice previews on the cards above.
      setError(
        res?.data?.upstream === 401
          ? "ElevenLabs refuse le clonage sur ce compte. Le clonage instantané demande un plan payant."
          : ERRORS[code] || "Le clonage a échoué. Réessayez dans un instant."
      );
    } finally {
      setBusy(false);
      setSeconds(0);
    }
  };

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        void upload(blob, rec.mimeType || 'audio/webm');
      };
      recorderRef.current = rec;
      rec.start();
      setSeconds(0);
      setRecording(true);
    } catch {
      setError("Micro inaccessible. Autorisez le microphone dans votre navigateur.");
    }
  };

  const stop = () => {
    setRecording(false);
    if (seconds < MIN_SECONDS) {
      // Discard rather than send: the server would reject it anyway, and a
      // round-trip to be told "too short" is a worse way to learn it.
      recorderRef.current?.stream.getTracks().forEach(t => t.stop());
      recorderRef.current = null;
      setSeconds(0);
      setError(ERRORS.sample_too_short);
      return;
    }
    recorderRef.current?.stop();
    recorderRef.current = null;
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete('/my-dashboard/voice-clone');
      onChange(null);
    } catch {
      setError("Suppression impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  if (voice) {
    return (
      <div className="mt-3 rounded-xl border border-[rgba(221,147,252,0.30)] bg-[rgba(221,147,252,0.06)] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#e7bafd]">Votre voix est clonée</p>
            <p className="text-[11px] text-[#8B8BA7] mt-0.5">
              Elle est sélectionnée dans la liste des voix ci-dessus. Le personnage, lui, ne change pas.
            </p>
          </div>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.12)] px-2.5 py-1.5 text-[12px] text-[#9A9AA5] transition-colors hover:text-[#e7bafd] disabled:opacity-50 active:scale-[0.97]"
          >
            {busy ? <Loader2 size={13} /> : <Trash2 size={13} />}
            Supprimer
          </button>
        </div>
        {error && <p role="status" className="mt-2 text-[11px] text-[#f0a0a0]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] px-3 py-3">
      <p className="text-[13px] font-semibold text-[#E8E8F0]">Ou clonez votre propre voix</p>
      <p className="text-[11px] text-[#8B8BA7] mt-0.5 leading-relaxed">
        Lisez un texte à voix haute pendant {MIN_SECONDS} à {MAX_SECONDS} secondes, dans un endroit calme.
        La réceptionniste répondra avec votre voix.
      </p>

      <label className="mt-3 flex items-start gap-2 text-[11px] leading-snug text-[#9A9AA5]">
        <input
          type="checkbox"
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
          className="mt-0.5 accent-[#dd93fc]"
        />
        <span>
          Je confirme que cette voix est la mienne, ou que j'ai l'accord écrit de la personne enregistrée.
        </span>
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!recording ? (
          <button
            type="button"
            onClick={start}
            disabled={!consent || busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[rgba(221,147,252,0.14)] px-3 py-2 text-[12px] font-semibold text-[#e7bafd] transition-opacity disabled:opacity-40 active:scale-[0.97]"
          >
            {busy ? <Loader2 size={14} /> : <Mic size={14} />}
            {busy ? 'Clonage en cours…' : 'Enregistrer ma voix'}
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-2 rounded-lg bg-[rgba(255,90,90,0.14)] px-3 py-2 text-[12px] font-semibold text-[#ffb0b0] transition-colors active:scale-[0.97]"
          >
            <Square size={13} />
            Arrêter — {seconds}s
            <span
              aria-hidden
              className="ml-1 inline-block h-2 w-2 rounded-full bg-[#ff6b6b] motion-safe:animate-pulse"
            />
          </button>
        )}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!consent || busy || recording}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.12)] px-2.5 py-2 text-[12px] text-[#9A9AA5] transition-colors hover:text-[#E8E8F0] disabled:opacity-40 active:scale-[0.97]"
        >
          <Upload size={13} />
          Importer un fichier
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={e => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void upload(f, f.type || 'audio/mpeg');
          }}
        />
      </div>

      {recording && seconds < MIN_SECONDS && (
        <p className="mt-2 text-[11px] text-[#8B8BA7]">
          Encore {MIN_SECONDS - seconds}s avant que l'enregistrement soit utilisable.
        </p>
      )}
      {error && <p role="status" className="mt-2 text-[11px] text-[#f0a0a0]">{error}</p>}
    </div>
  );
}
