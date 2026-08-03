import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2, Upload, Loader2 } from 'lucide-react';
import api from '../../../services/api';
import { PrimaryBtn, GhostBtn, DangerBtn, Pill } from './Blocks';

export interface CustomVoice {
  voiceId: string;
  name: string;
  createdAt: string;
}

/** ElevenLabs veut un vrai échantillon ; en dessous, le clone sonne comme un inconnu. */
const MIN_SECONDS = 20;
/** Passé une minute le clone ne s'améliore plus et l'envoi commence à peser. */
const MAX_SECONDS = 90;

const ERRORS: Record<string, string> = {
  consent_required: "Il faut confirmer que la voix enregistrée est bien la vôtre.",
  elevenlabs_key_missing: "Le clonage n'est pas disponible : la clé ElevenLabs n'est pas configurée sur le serveur.",
  sample_too_short: "Enregistrement trop court. Parlez au moins 20 secondes d'affilée.",
  sample_too_large: "Enregistrement trop long. Une minute suffit largement.",
  voice_clone_failed: "Le clonage a échoué. Réessayez dans un instant.",
};

/**
 * Enregistrer une fois, et la réceptionniste répond avec la voix du patron.
 *
 * Volontairement pas une modale : ce bloc vit sous la grille des personnages
 * parce qu'une voix clonée est un choix parmi les autres, pas une cérémonie
 * séparée. Registre produit V2 : surfaces obsidian, hairline graphite.
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

  // Le compteur porte le libellé du bouton d'arrêt, il doit continuer à tourner
  // même quand l'onglet n'est pas regardé.
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  useEffect(() => {
    if (recording && seconds >= MAX_SECONDS) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, recording]);

  // Un micro laissé ouvert après démontage garde l'indicateur d'enregistrement
  // du navigateur allumé, ce qui se lit comme un mouchard.
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
      // Par tranches : String.fromCharCode(...) sur un tableau d'un mégaoctet
      // fait déborder la pile d'arguments et lève.
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
      // Un 401 d'ElevenLabs sur cet endpoint est presque toujours un compte
      // gratuit : la même clé fait marcher les aperçus des cartes au-dessus.
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
      // Jeter plutôt qu'envoyer : le serveur refuserait de toute façon, et faire
      // l'aller-retour pour s'entendre dire « trop court » est une pire façon
      // de l'apprendre.
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
      <div className="mt-3 rounded-xl border border-q2-graphite-d bg-q2-obsidian px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-medium text-white">Votre voix est clonée</p>
              <Pill tone="ok">Prête</Pill>
            </div>
            <p className="text-[11.5px] text-q2-fog mt-1">
              Sélectionnez la carte « Ma voix » ci-dessus pour l'utiliser en appel.
            </p>
          </div>
          <DangerBtn type="button" onClick={remove} disabled={busy} className="shrink-0">
            {busy
              ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              : <Trash2 size={13} aria-hidden="true" />}
            Supprimer
          </DangerBtn>
        </div>
        {error && (
          <p role="status" className="mt-2 text-[11.5px]" style={{ color: 'var(--q2p-bad)' }}>{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-q2-graphite-d bg-q2-obsidian px-4 py-3.5">
      <p className="text-[13px] font-medium text-white">Ou clonez votre propre voix</p>
      <p className="text-[11.5px] text-q2-fog mt-1 leading-relaxed q2-body-text">
        Lisez un texte à voix haute pendant {MIN_SECONDS} à {MAX_SECONDS} secondes, dans un endroit calme.
        La réceptionniste répondra avec votre voix.
      </p>

      <label className="mt-3 flex items-start gap-2 text-[11.5px] leading-snug text-q2-mist">
        <input
          type="checkbox"
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
          className="mt-0.5 accent-q2-indigo focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
        />
        <span>
          Je confirme que cette voix est la mienne, ou que j'ai l'accord écrit de la personne enregistrée.
        </span>
      </label>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {!recording ? (
          <PrimaryBtn type="button" onClick={start} disabled={!consent || busy}>
            {busy
              ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              : <Mic size={14} aria-hidden="true" />}
            {busy ? 'Clonage en cours…' : 'Enregistrer ma voix'}
          </PrimaryBtn>
        ) : (
          <DangerBtn type="button" onClick={stop}>
            <Square size={13} aria-hidden="true" />
            Arrêter ({seconds}s)
            <span
              role="status"
              aria-label="Enregistrement en cours"
              className="ml-1 inline-block h-2 w-2 rounded-full motion-safe:animate-pulse"
              style={{ background: 'var(--q2p-bad)' }}
            />
          </DangerBtn>
        )}

        <GhostBtn
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!consent || busy || recording}
        >
          <Upload size={13} aria-hidden="true" />
          Importer un fichier
        </GhostBtn>
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
        <p className="mt-2 text-[11.5px] text-q2-fog tabular-nums">
          Encore {MIN_SECONDS - seconds}s avant que l'enregistrement soit utilisable.
        </p>
      )}
      {error && (
        <p role="status" className="mt-2 text-[11.5px]" style={{ color: 'var(--q2p-bad)' }}>{error}</p>
      )}
    </div>
  );
}
