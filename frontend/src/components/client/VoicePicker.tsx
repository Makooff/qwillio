import { useEffect, useState } from 'react';
import { Play, Square, Check, Loader2, Trash2 } from '../icons';
import api from '../../services/api';
import { useVoicePreview } from './useVoicePreview';
import { previewUrl } from './CharacterPicker';

export interface CatalogVoice {
  voiceId: string;
  name: string;
  gender: string | null;
  accent: string | null;
  description: string | null;
  previewUrl: string | null;
  cloned: boolean;
  /** Absent = ElevenLabs. Voir le commentaire sur `SelectedVoice.provider`. */
  provider?: 'cartesia';
}

export interface SelectedVoice {
  voiceId: string;
  name: string;
  cloned?: boolean;
  /**
   * Le catalogue d'où vient l'identifiant, renvoyé tel quel à l'enregistrement.
   *
   * Un identifiant Cartesia ne désigne rien chez ElevenLabs: sans ce champ, le
   * choix serait enregistré nu et le serveur l'enverrait au mauvais catalogue.
   * Absent veut dire ElevenLabs, ce qu'étaient toutes les voix jusqu'ici.
   */
  provider?: 'cartesia';
}

/**
 * Swap the voice of the chosen character without changing the character.
 *
 * The character carries the face, the name and the personality; only how it
 * sounds is negotiable. The previous design made a custom voice a character of
 * its own, so a client who wanted a deeper voice lost the face and the tone they
 * had picked — three losses for one gain.
 *
 * Every entry is auditioned through the selected character, so the sample is
 * what the caller will hear, tuning included.
 */
export default function VoicePicker({
  characterId, characterVoiceName, value, onChange, sampleText, isFr = true,
}: {
  characterId: string;
  /** Name of the character whose default voice is on offer, for the first row. */
  characterVoiceName: string;
  value: SelectedVoice | null;
  onChange: (v: SelectedVoice | null) => void;
  sampleText: string;
  isFr?: boolean;
}) {
  const [voices, setVoices] = useState<CatalogVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /* Suppression d'un clone : une confirmation en ligne plutôt qu'une fenêtre.
     Un clic arme, le second efface, et cliquer ailleurs désarme. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  /* Séparé de `error`, qui remplace la liste entière: un échec de suppression
     ne doit pas faire disparaître les voix qu'on peut encore choisir. */
  const [removeError, setRemoveError] = useState<string | null>(null);
  const { playing, notice, toggle, debug } = useVoicePreview(isFr);

  useEffect(() => {
    let alive = true;
    api.get('/my-dashboard/voices')
      .then(({ data }) => { if (alive) setVoices(Array.isArray(data?.voices) ? data.voices : []); })
      .catch(err => {
        if (!alive) return;
        /* Le message nomme le fournisseur que le serveur a désigné: « la clé
           n'est pas configurée » sans dire laquelle envoie chercher au mauvais
           endroit, et les deux catalogues cohabitent maintenant. */
        const code = err?.response?.data?.error;
        setError(
          code === 'cartesia_key_missing'
            ? "Les voix ne sont pas disponibles : la clé Cartesia n'est pas configurée sur le serveur."
            : code === 'cartesia_list_failed'
              ? 'Cartesia ne répond pas. Réessayez dans un instant.'
              : err?.response?.status === 503
                ? "Les voix ne sont pas disponibles : la clé ElevenLabs n'est pas configurée sur le serveur."
                : "Impossible de charger la liste des voix. Réessayez dans un instant.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  /**
   * Effacer une voix clonée pour de bon.
   *
   * Le serveur ne sert au client que SES clones, donc toute ligne clonée
   * affichée ici lui appartient ; il revérifie quand même la propriété, le
   * compte ElevenLabs étant partagé. Si la voix effacée était celle en service,
   * la sélection retombe sur la voix d'origine du personnage : laisser pointer
   * vers une voix supprimée ferait taire la réceptionniste au prochain appel.
   */
  const remove = async (voiceId: string) => {
    setRemoving(voiceId);
    setRemoveError(null);
    try {
      await api.delete(`/my-dashboard/voices/${voiceId}`);
      setVoices(list => list.filter(v => v.voiceId !== voiceId));
      if (value?.voiceId === voiceId) onChange(null);
      setConfirming(null);
    } catch {
      setRemoveError(isFr
        ? "Impossible de supprimer cette voix. Réessayez dans un instant."
        : 'Could not delete this voice. Try again in a moment.');
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <p className="mt-3 flex items-center gap-2 text-[12px] text-[#8B8BA7]">
        <Loader2 size={13} />
        Chargement des voix…
      </p>
    );
  }

  if (error) return <p role="status" className="mt-3 text-[11px] text-[#f0a0a0]">{error}</p>;

  const rows: Array<{ key: string; label: string; sub: string; voice: SelectedVoice | null; cloned: boolean }> = [
    {
      key: 'default',
      label: isFr ? `Voix d'origine (${characterVoiceName})` : `Original voice (${characterVoiceName})`,
      sub: isFr ? 'La voix livrée avec ce personnage.' : 'The voice this character ships with.',
      voice: null,
      cloned: false,
    },
    ...voices.map(v => ({
      key: v.voiceId,
      label: v.name,
      sub: [v.cloned ? (isFr ? 'Voix clonée' : 'Cloned voice') : null, v.gender, v.accent, v.description]
        .filter(Boolean).join(' · ')
        // Le repli nomme le bon catalogue: écrire « voix ElevenLabs » sous une
        // voix Cartesia est faux, et c'est faux à l'endroit précis où le client
        // décide.
        || (v.provider === 'cartesia' ? 'Voix Cartesia' : isFr ? 'Voix ElevenLabs' : 'ElevenLabs voice'),
      voice: {
        voiceId: v.voiceId,
        name: v.name,
        ...(v.cloned ? { cloned: true } : {}),
        ...(v.provider ? { provider: v.provider } : {}),
      },
      cloned: v.cloned,
    })),
  ];

  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9AA5] mb-2">
        Voix du personnage
      </p>
      {notice && (
        <p
          role="status"
          // Scrolled to on purpose: the list is long enough that the banner sat
          // off-screen, so a failed preview looked like a dead button.
          ref={el => el?.scrollIntoView({ block: 'nearest' })}
          className="mb-2 rounded-lg px-3 py-2 text-[11px] leading-snug"
          style={{ background: 'rgba(221,147,252,0.10)', border: '1px solid rgba(221,147,252,0.30)', color: '#e7bafd' }}
        >
          {notice}
        </p>
      )}
      {removeError && (
        <p role="status" className="mb-2 text-[11px] text-[#f0a0a0]">{removeError}</p>
      )}
      <div className="rounded-xl border border-[rgba(255,255,255,0.08)] divide-y divide-[rgba(255,255,255,0.06)]">
        {rows.map(r => {
          const sel = (value?.voiceId ?? null) === (r.voice?.voiceId ?? null);
          const url = previewUrl(characterId, r.voice);
          return (
            <div key={r.key} className="flex items-center gap-2 px-3 py-2.5">
              <button
                type="button"
                onClick={() => onChange(r.voice)}
                aria-pressed={sel}
                className="flex-1 min-w-0 text-left flex items-center gap-2.5"
              >
                <span
                  aria-hidden
                  className="flex-shrink-0 w-4 h-4 rounded-full grid place-items-center transition-colors"
                  style={{
                    border: sel ? '1px solid rgba(122,95,255,0.85)' : '1px solid rgba(255,255,255,0.20)',
                    background: sel ? 'rgba(122,95,255,0.85)' : 'transparent',
                  }}
                >
                  {sel && <Check size={11} color="#0A0A0C" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold truncate" style={{ color: sel ? '#7349fe' : '#F2F2F2' }}>
                    {r.label}
                  </span>
                  <span className="block text-[11px] truncate" style={{ color: sel ? 'rgba(122,95,255,0.85)' : '#8B8BA7' }}>
                    {r.sub}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => toggle(`v:${r.key}`, url, sampleText)}
                aria-label={isFr ? `Écouter ${r.label}` : `Preview ${r.label}`}
                className="flex-shrink-0 w-8 h-8 rounded-full grid place-items-center transition-colors"
                style={{ background: 'rgba(122,95,255,0.14)', color: '#b9a8ff' }}
              >
                {playing === `v:${r.key}` ? <Square size={13} /> : <Play size={13} />}
              </button>
              {/* Seules les voix clonées se suppriment : celles de la
                  bibliothèque sont communes à toute la flotte. */}
              {r.cloned && (
                confirming === r.key ? (
                  <button
                    type="button"
                    onClick={() => remove(r.key)}
                    onBlur={() => setConfirming(c => (c === r.key ? null : c))}
                    disabled={removing === r.key}
                    autoFocus
                    className="flex-shrink-0 h-8 px-2.5 rounded-full text-[11px] font-semibold transition-colors"
                    style={{ background: 'rgba(240,160,160,0.16)', color: '#f0a0a0' }}
                  >
                    {removing === r.key
                      ? (isFr ? 'Suppression…' : 'Deleting…')
                      : (isFr ? 'Confirmer' : 'Confirm')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(r.key)}
                    aria-label={isFr ? `Supprimer ${r.label}` : `Delete ${r.label}`}
                    className="flex-shrink-0 w-8 h-8 rounded-full grid place-items-center transition-colors"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#8B8BA7' }}
                  >
                    <Trash2 size={13} />
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
      {/*
        On iPhone the side switch mutes the browser's audio without any error,
        so a working preview and a muted phone look identical. Saying it once,
        here, costs a line and answers the question before it is asked.
      */}
      <p className="mt-2 text-[10px] leading-snug text-[#6D6D7A]">
        Pas de son ? Sur iPhone, l'interrupteur silence coupe l'audio du navigateur, et le volume média se règle pendant la lecture.
        {debug && <span className="block mt-0.5 font-mono">{debug}</span>}
      </p>
    </div>
  );
}
