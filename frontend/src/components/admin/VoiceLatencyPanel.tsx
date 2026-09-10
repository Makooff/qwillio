import { pro } from '../../styles/pro-theme';
import { Card as ProCard, SectionHead as ProSectionHead } from '../pro/ProBlocks';

/**
 * p50 / p95 / p99 par ÉTAGE de la chaîne vocale (LAT-9).
 *
 * Les percentiles étaient calculés et publiés depuis longtemps, mais sur le
 * point de santé des webhooks, que personne n'ouvre. Ils ne servaient donc à
 * rien: le chiffre existait et personne ne le regardait.
 *
 * Deux partis pris de lecture. Le p95 est mis en avant, pas la médiane: un
 * appel fait trente à soixante tours, donc il touche plusieurs fois la queue de
 * distribution, et une médiane flatteuse cohabite très bien avec un appel sur
 * cinq qui traîne. Et le découpage par étage est ce qui rend le chiffre
 * actionnable — il dit QUI est lent, la transcription, le modèle ou la
 * synthèse. Un total lent sans coupable ne se corrige pas.
 *
 * La donnée arrive par `props`: `/admin/system` est déjà appelé par l'onglet,
 * et une seconde requête pour le même objet ferait diverger les deux moitiés
 * de l'écran au premier rechargement.
 */

interface Stat { count: number; p50: number; p95: number; p99: number }

export interface VoiceLatency {
  windowStartedAt: string;
  calls: number;
  latency: Partial<Record<'stt' | 'llm' | 'tts' | 'ttfa' | 'total', Stat>>;
  voiceToVoiceObjectiveMs: number;
  meetsObjective: boolean | null;
}

const STAGES: Array<[keyof VoiceLatency['latency'], string]> = [
  ['stt', 'Transcription'],
  ['llm', 'Modèle'],
  ['tts', 'Synthèse'],
  ['ttfa', 'Premier son'],
  ['total', 'Voix à voix'],
];

export default function VoiceLatencyPanel({ data }: { data: VoiceLatency | null | undefined }) {
  const rows = data ? STAGES.filter(([key]) => data.latency[key]) : [];

  return (
    <>
      <ProSectionHead title="Latence vocale par étage" />
      <ProCard>
        {/* Zéro appel n'est pas une panne, c'est l'état réel tant qu'aucun appel
            entrant n'a eu lieu. Le dire vaut mieux qu'un tableau de tirets, qui
            se lit comme une mesure ratée. */}
        {rows.length === 0 ? (
          <p className="px-4 py-3 text-[12px]" style={{ color: pro.textSec }}>
            Aucun appel mesuré sur cette instance. La fenêtre se remplit au premier appel.
          </p>
        ) : (
          <div className="px-4 py-3">
            <p className="text-[11px] mb-3" style={{ color: pro.textSec }}>
              {data!.calls} appels depuis le {new Date(data!.windowStartedAt).toLocaleString('fr-FR')}.
              {data!.meetsObjective === false
                && ` Objectif voix à voix de ${data!.voiceToVoiceObjectiveMs} ms non tenu au p95.`}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider" style={{ color: pro.textSec }}>
                    <th className="text-left font-medium pb-2">Étage</th>
                    <th className="text-right font-medium pb-2">p50</th>
                    {/* Celui qui décide, donc celui qu'on souligne. */}
                    <th className="text-right font-medium pb-2" style={{ color: pro.text }}>p95</th>
                    <th className="text-right font-medium pb-2">p99</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([key, label]) => {
                    const s = data!.latency[key]!;
                    const slow = key === 'total' && s.p95 > data!.voiceToVoiceObjectiveMs;
                    return (
                      <tr key={key} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                        <td className="py-2" style={{ color: pro.textSec }}>{label}</td>
                        <td className="py-2 text-right tabular-nums" style={{ color: pro.textSec }}>{s.p50} ms</td>
                        <td
                          className="py-2 text-right tabular-nums font-semibold"
                          style={{ color: slow ? pro.bad : pro.text }}
                        >
                          {s.p95} ms
                        </td>
                        <td className="py-2 text-right tabular-nums" style={{ color: pro.textSec }}>{s.p99} ms</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ProCard>
    </>
  );
}
