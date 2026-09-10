import { useEffect, useState } from 'react';
import { HelpCircle, Check, X } from '../icons';
import api from '../../services/api';

/**
 * Ce que l'agent n'a pas su répondre, posé au gérant.
 *
 * C'est la moitié visible d'une boucle qui n'en avait qu'une: l'agent
 * promettait déjà à l'appelant de « faire remonter la question », et la
 * question s'arrêtait là. Personne ne l'apprenait, la base ne grossissait pas,
 * et l'appelant suivant reposait la même. Ici elle est posée à la seule
 * personne qui connaît la réponse, et cette réponse devient une entrée servie
 * dès l'appel suivant.
 *
 * Ce que ce bloc affiche et que rien d'autre ne peut inventer: la question dans
 * les MOTS DE L'APPELANT, et le nombre de fois qu'elle a été posée. Le second
 * est ce qui décide de l'ordre — une question posée six fois a coûté six
 * appels, une question posée une fois peut attendre.
 *
 * Il ne s'affiche pas quand il n'y a rien: un bloc « aucune lacune » occuperait
 * la place au-dessus de la FAQ pour ne rien dire, et le silence dit déjà que
 * l'agent s'en sort.
 */

interface Gap {
  id: string;
  question: string;
  askedCount: number;
}

export default function KnowledgeGaps({ onAnswered }: { onAnswered?: () => void }) {
  const [gaps, setGaps] = useState<Gap[]>([]);
  /* Une réponse en cours par question, et non un seul champ partagé: le gérant
     peut commencer à répondre à l'une, hésiter, et répondre à l'autre. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    api.get('/my-dashboard/knowledge/gaps')
      .then(r => setGaps(r.data.gaps ?? []))
      .catch(() => { /* Silencieux: c'est un supplément, pas la page. */ });
  }, []);

  const save = async (gap: Gap) => {
    const answer = (drafts[gap.id] ?? '').trim();
    if (!answer) return;
    setBusy(gap.id);
    setProblem('');
    try {
      await api.post(`/my-dashboard/knowledge/gaps/${gap.id}/answer`, { answer });
      setGaps(list => list.filter(g => g.id !== gap.id));
      onAnswered?.();
    } catch {
      setProblem("La réponse n'a pas pu être enregistrée.");
    } finally {
      setBusy(null);
    }
  };

  const dismiss = async (gap: Gap) => {
    // Optimiste: écarter est sans conséquence, et le rendre ne l'est pas non
    // plus — la question réapparaît au prochain chargement si l'appel échoue.
    setGaps(list => list.filter(g => g.id !== gap.id));
    try {
      await api.post(`/my-dashboard/knowledge/gaps/${gap.id}/dismiss`);
    } catch {
      setGaps(list => [...list, gap]);
    }
  };

  if (gaps.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#9A9AA5]">
          <HelpCircle size={12} /> Ce que l'IA n'a pas su répondre
        </label>
        <span className="text-[11px] text-[#6B6B75]">
          {gaps.length} question{gaps.length > 1 ? 's' : ''}
        </span>
      </div>
      <p className="text-[11.5px] text-[#6B6B75] mb-3 leading-relaxed">
        De vrais appelants ont posé ces questions, et l'IA n'avait pas la réponse.
        Répondez une fois : elle la donnera dès le prochain appel.
      </p>

      <div className="space-y-2">
        {gaps.map(gap => (
          <div key={gap.id} className="rounded-xl border border-[#7349fe]/20 bg-[#7349fe]/[0.04] p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] font-medium text-[#F8F8FF] leading-snug">{gap.question}</p>
              <span className="shrink-0 rounded-lg bg-white/[0.06] px-2 py-0.5 text-[11px] text-[#9A9AA5]">
                {gap.askedCount}×
              </span>
            </div>
            <textarea
              value={drafts[gap.id] ?? ''}
              onChange={e => setDrafts(d => ({ ...d, [gap.id]: e.target.value }))}
              rows={2}
              placeholder="Votre réponse, telle que l'IA doit la dire"
              className="mt-2.5 w-full resize-y rounded-xl border border-white/[0.08] bg-[#0A0A0C] px-4 py-2.5 text-sm leading-relaxed text-[#F8F8FF] placeholder-[#6B6B75] focus:border-[#7349fe]/50 focus:outline-none transition-colors"
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => save(gap)}
                disabled={busy === gap.id || !(drafts[gap.id] ?? '').trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#7349fe] px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-40 hover:bg-[#8f6dff] transition-colors"
              >
                <Check size={13} />
                {busy === gap.id ? 'Enregistrement' : 'Apprendre'}
              </button>
              <button
                type="button"
                onClick={() => dismiss(gap)}
                className="inline-flex items-center gap-1.5 text-[12.5px] text-[#6B6B75] hover:text-[#F8F8FF] transition-colors"
              >
                <X size={13} />
                Sans objet
              </button>
            </div>
          </div>
        ))}
      </div>
      {problem && <p className="mt-2 text-[12px] text-[#EF4444]">{problem}</p>}
    </div>
  );
}
