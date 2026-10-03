import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import SentimentBadge from './SentimentBadge';

/* La colonne Sentiment d'un appel EN COURS.

   Demande du 02/10 : « je veux que les appels apparaissent dans la liste en
   live, pas besoin d'actualiser la page, et qu'ils apparaissent avec le statut
   "en cours" là où il y a le sentiment ».

   Le piège que ce fichier verrouille : la ligne existe en base dès le décroché,
   avec `sentiment = null`. Sans branche dédiée, la pastille retombait sur son
   défaut et affichait « Neutre » — un jugement rendu sur une conversation qui
   n'a pas encore eu lieu, et le gérant croyait l'appel terminé. */

afterEach(cleanup);

describe('SentimentBadge', () => {
  it('annonce un appel en cours au lieu de lui prêter un sentiment', () => {
    render(<SentimentBadge sentiment="in-progress" />);
    expect(screen.getByText('En cours')).toBeInTheDocument();
    expect(screen.queryByText('Neutre')).toBeNull();
  });

  it('garde la pastille vivante, pour qu\'on voie que la liste bouge seule', () => {
    const { container } = render(<SentimentBadge sentiment="in-progress" />);
    // L'anneau qui pulse : c'est le seul repère visuel qui distingue une ligne
    // en cours d'une ligne figée, puisque ni durée ni sentiment ne la trahissent.
    expect(container.querySelector('.animate-ping')).not.toBeNull();
  });

  it('affiche les sentiments en français, pas la valeur brute de la base', () => {
    render(<SentimentBadge sentiment="positive" />);
    expect(screen.getByText('Positif')).toBeInTheDocument();
    expect(screen.queryByText('positive')).toBeNull();
  });

  it('retombe sur « Neutre » quand le sentiment est absent et l\'appel fini', () => {
    // Un appel terminé sans sentiment analysé reste neutre : c'est le seul cas
    // où ce défaut est honnête.
    render(<SentimentBadge sentiment={null} />);
    expect(screen.getByText('Neutre')).toBeInTheDocument();
  });

  it('ne confond pas « in_progress » avec un sentiment', () => {
    // La casse du serpent vient du backend selon les chemins d'écriture.
    render(<SentimentBadge sentiment="in_progress" />);
    expect(screen.getByText('En cours')).toBeInTheDocument();
  });
});
