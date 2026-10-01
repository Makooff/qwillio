import { useEffect, useRef, useState } from 'react';
import { fetchLive } from '../../services/liveData';

/**
 * L'appel pendant qu'il a lieu.
 *
 * La fiche existait déjà : `POST /api/voice-core/calls/start` écrit un
 * `ClientCall` en `in-progress` au décroché, et la liste ne filtre pas sur le
 * statut. Mais la page se charge UNE fois et ne se rafraîchit jamais, et la
 * fiche est vide tant que l'appel dure. Résultat : le gérant apprenait qu'un
 * appel avait eu lieu une fois qu'il était fini — c'est-à-dire au moment où il
 * ne peut plus rien en faire.
 *
 * DEUX SECONDES, ET C'EST UN CHOIX. Plus lent, l'affichage traîne derrière la
 * conversation et le mot « direct » devient un mensonge. Plus rapide, on paie
 * une requête par onglet ouvert pour un gain que l'œil ne voit pas — une
 * réplique dure plus de deux secondes.
 *
 * ET RIEN DU TOUT QUAND L'ONGLET EST CACHÉ. Un tableau de bord reste ouvert
 * toute la journée dans un onglet que personne ne regarde : sonder dans le
 * vide, c'est une requête toutes les deux secondes, par client, pour afficher
 * une page invisible.
 */

interface Ligne {
  role: 'user' | 'assistant';
  text: string;
  at: number;
}

interface AppelEnCours {
  id: string;
  callerNumber: string | null;
  startedAt: string;
  lines: Ligne[];
}

const CADENCE_MS = 2000;

/** La durée qui tourne, remise à jour par le sondage lui-même. */
function duree(depuis: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(depuis).getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function LiveCalls() {
  const [appels, setAppels] = useState<AppelEnCours[]>([]);
  const bas = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let vivant = true;

    const sonder = async () => {
      if (document.hidden) return;
      try {
        const r = await fetchLive<{ data?: AppelEnCours[] }>(
          '/my-dashboard/calls/live', { force: true },
        );
        if (vivant) setAppels(r.data || []);
      } catch {
        /* Le direct n'est jamais load-bearing. Une panne ici laisse la liste
           des appels terminés intacte, et la prochaine tentative est dans
           deux secondes. */
      }
    };

    sonder();
    const t = window.setInterval(sonder, CADENCE_MS);
    /* Revenir sur l'onglet rafraîchit tout de suite, sans attendre le tic
       suivant : sinon on retrouve un transcript figé sur ce qui se disait au
       moment où on est parti. */
    document.addEventListener('visibilitychange', sonder);
    return () => {
      vivant = false;
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', sonder);
    };
  }, []);

  /* On suit le bas du transcript, parce qu'on lit ce qui se dit MAINTENANT —
     et le remonter soi-même pendant que l'appel continue est une bagarre
     perdue d'avance. */
  useEffect(() => { bas.current?.scrollIntoView({ block: 'nearest' }); }, [appels]);

  // Un encart qui n'a rien à dire ne dit rien. Pas de « aucun appel en cours ».
  if (appels.length === 0) return null;

  return (
    <section className="mb-6 space-y-3" aria-live="polite">
      {appels.map(appel => (
        <div
          key={appel.id}
          className="rounded-2xl border border-[#7349FE]/30 bg-[#7349FE]/[0.06] p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="relative flex h-2.5 w-2.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7349FE] opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#7349FE]" />
            </span>
            <span className="text-[13px] font-semibold text-[#F2F2F2]">En cours</span>
            <span className="text-[13px] text-[#C8C8D0] tabular-nums">
              {appel.callerNumber || 'Numéro masqué'}
            </span>
            <span className="ml-auto text-[12px] text-[#9A9AA5] tabular-nums">
              {duree(appel.startedAt)}
            </span>
          </div>

          {appel.lines.length === 0 ? (
            /* Entre le décroché et la première réplique il s'écoule une
               seconde ou deux. Dire « ça commence » vaut mieux qu'un cadre
               vide qu'on prend pour une panne. */
            <p className="text-[12px] text-[#9A9AA5] italic">La conversation commence…</p>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {appel.lines.map((l, i) => (
                <p key={i} className="text-[12px] leading-relaxed">
                  <span className={l.role === 'user' ? 'text-[#9A9AA5]' : 'text-[#7349FE]'}>
                    {l.role === 'user' ? 'Appelant' : 'IA'}
                  </span>
                  <span className="text-[#C8C8D0]"> — {l.text}</span>
                </p>
              ))}
              <div ref={bas} />
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
