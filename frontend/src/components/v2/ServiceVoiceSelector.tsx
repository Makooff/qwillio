import { useEffect, useState } from 'react';
import { Mic, Play, Square } from '../icons';
import { useVoicePreview } from '../client/useVoicePreview';

const VOICES = [
  ['marie', 'Marie', 'Chaleureuse', 'Warm'], ['camille', 'Camille', 'Raffinée', 'Refined'],
  ['nour', 'Nour', 'Bienveillante', 'Caring'], ['lucas', 'Lucas', 'Professionnel', 'Professional'],
  ['theo', 'Théo', 'Énergique', 'Energetic'], ['hugo', 'Hugo', 'Décontracté', 'Casual'],
  ['lea', 'Léa', 'Efficace', 'Efficient'], ['sofia', 'Sofia', 'Posée', 'Composed'],
  ['adrien', 'Adrien', 'Direct', 'Direct'], ['julien', 'Julien', 'Cordial', 'Friendly'],
] as const;
const HEIGHTS = [12, 22, 34, 18, 42, 56, 30, 48, 68, 40, 24, 50, 64, 34, 18, 40, 54, 28, 16, 36, 46, 22, 12];

/** Real existing preview endpoint and hook, with no generated human portraits. */
export default function ServiceVoiceSelector({ isFr }: { isFr: boolean }) {
  const [active, setActive] = useState(0);
  const { playing, notice, line, toggle, stop } = useVoicePreview(isFr);
  const [id, name, fr, en] = VOICES[active];
  useEffect(() => { stop(); }, [id, isFr, stop]);
  const speaking = playing === id;
  return (
    <div>
      <div className="grid gap-6 rounded-[28px] bg-q2-band p-5 sm:p-9 lg:grid-cols-[0.9fr_1.2fr] lg:gap-12 lg:p-12">
        <div role="group" aria-label={isFr ? 'Choisir une voix' : 'Choose a voice'} className="grid grid-cols-2 content-center gap-2.5">
          {VOICES.map(([voiceId, voiceName, voiceFr, voiceEn], i) => (
            <button key={voiceId} type="button" aria-pressed={active === i} onClick={() => setActive(i)} className={`min-h-16 rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q2-indigo ${active === i ? 'border-q2-indigo bg-q2-canvas text-q2-ink' : 'border-transparent text-q2-body hover:bg-q2-canvas'}`}>
              <span className="block text-base font-medium">{voiceName}</span>
              <span className="text-[13px]">{isFr ? voiceFr : voiceEn}</span>
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-col justify-center rounded-[24px] border border-q2-plate bg-q2-canvas p-6 shadow-[0_18px_45px_-28px_rgba(29,24,45,0.35)] sm:p-9">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-3xl font-medium tracking-tight text-q2-ink">{name}</p><p className="mt-1 text-sm text-q2-body">{isFr ? fr : en} · {isFr ? 'Français & anglais' : 'French & English'}</p></div>
            <Mic size={24} className="shrink-0 text-q2-indigo" aria-hidden="true" />
          </div>
          <div className="my-9 flex h-20 items-center justify-center gap-1.5" aria-hidden="true">
            {HEIGHTS.map((height, i) => <span key={i} style={{ height, opacity: speaking ? 1 : 0.48 }} className="w-1.5 rounded-full bg-q2-indigo" />)}
          </div>
          <button type="button" onClick={() => toggle(id, `/public/characters/${id}/preview?lang=${isFr ? 'fr' : 'en'}&v=2`)} aria-label={speaking ? (isFr ? `Arrêter la voix de ${name}` : `Stop ${name}’s voice`) : (isFr ? `Écouter la voix de ${name}` : `Hear ${name}’s voice`)} className="inline-flex min-h-12 items-center justify-center gap-3 self-start rounded-full bg-q2-ink px-6 py-3 text-sm font-medium text-q2-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-q2-indigo">
            {speaking ? <Square size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
            {speaking ? (isFr ? 'Arrêter l’aperçu' : 'Stop preview') : (isFr ? 'Écouter cette voix' : 'Listen to this voice')}
          </button>
          <p className="mt-4 text-[13px] leading-relaxed text-q2-body">{isFr ? 'Aperçu audio de la voix proposée dans Qwillio.' : 'An audio preview of the voice available in Qwillio.'}</p>
        </div>
      </div>
      {line && <p className="mt-4 text-sm text-q2-body">{line}</p>}
      {notice && <p role="status" className="mt-4 text-sm text-q2-body">{notice}</p>}
      <p className="mt-5 flex items-start gap-3 text-[15px] leading-relaxed text-q2-body"><Mic size={18} className="mt-1 shrink-0 text-q2-indigo" aria-hidden="true" />{isFr ? 'Vous pouvez aussi utiliser votre propre voix, avec votre consentement explicite, depuis votre espace Qwillio.' : 'You can also use your own voice, with your explicit consent, from your Qwillio workspace.'}</p>
    </div>
  );
}
