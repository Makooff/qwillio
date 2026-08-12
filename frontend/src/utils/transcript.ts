/**
 * Relecture du transcript d'appel.
 *
 * Vapi le rend en TEXTE PLAT: une réplique par ligne, préfixée du locuteur
 * (« AI: », « User: », et selon les versions « Assistant », « Bot »,
 * « Customer »). Affiché tel quel, c'est un mur de texte où l'on ne sait plus
 * qui parle; d'où cette relecture, qui rend des répliques attribuées.
 *
 * Une ligne dont le préfixe n'est pas reconnu reste une ligne entière, sans
 * locuteur: on ne lui en invente pas un, et on ne perd pas son texte.
 */
export type TranscriptLine = { who: 'agent' | 'caller' | null; text: string };

const SPEAKER = /^(AI|Assistant|Bot|Agent|User|Human|Customer|Caller)\s*:\s*(.*)$/i;
const IS_CALLER = /^(user|human|customer|caller)$/i;

export function parseTranscript(raw: string): TranscriptLine[] {
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const m = SPEAKER.exec(line);
      if (!m) return { who: null, text: line };
      return { who: IS_CALLER.test(m[1]) ? 'caller' : 'agent', text: m[2] } as TranscriptLine;
    })
    .filter(r => r.text.length > 0);
}
