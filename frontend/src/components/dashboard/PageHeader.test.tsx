import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PageHeader from './PageHeader';

afterEach(cleanup);

describe('PageHeader', () => {
  it('affiche le titre, le sous-titre et l’action de la page', () => {
    render(
      <PageHeader
        title="Appels"
        subtitle="12 appels au total"
        action={<button type="button">Exporter</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Appels' })).toBeInTheDocument();
    expect(screen.getByText('12 appels au total')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exporter' })).toBeInTheDocument();
  });

  it('rend la rangée standard à partir des chiffres', () => {
    render(<PageHeader title="Appels" kpis={[{ label: 'Total appels', value: 42 }]} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Total appels')).toBeInTheDocument();
  });

  /* Une page dont les chiffres FILTRENT (le pipeline des leads, les statuts du
     CRM) passe sa propre rangée: la standard ne sait pas cliquer. */
  it('laisse une page fournir sa propre rangée', () => {
    render(<PageHeader title="Leads" stats={<button type="button">Nouveau</button>} />);
    expect(screen.getByRole('button', { name: 'Nouveau' })).toBeInTheDocument();
  });

  it('remonte la saisie de recherche', () => {
    const onChange = vi.fn();
    render(
      <PageHeader
        title="Appels"
        search={{ value: '', onChange, placeholder: 'Chercher…', label: 'Rechercher dans les appels' }}
      />,
    );
    fireEvent.change(screen.getByLabelText('Rechercher dans les appels'), { target: { value: 'dupont' } });
    expect(onChange).toHaveBeenCalledWith('dupont');
  });

  /* Le panneau ne doit pas exister tant qu'il est fermé: le laisser monté
     rendrait ses champs atteignables au clavier derrière une carte invisible. */
  it('ne monte le panneau de filtres qu’une fois ouvert', () => {
    const { rerender } = render(
      <PageHeader
        title="Appels"
        filters={{ open: false, onToggle: () => {}, count: 2, children: <p>Sentiment</p> }}
      />,
    );
    expect(screen.queryByText('Sentiment')).not.toBeInTheDocument();
    // Le compte de filtres actifs se lit sans ouvrir le panneau.
    expect(screen.getByLabelText('2 filtre(s) actif(s)')).toBeInTheDocument();

    rerender(
      <PageHeader
        title="Appels"
        filters={{ open: true, onToggle: () => {}, count: 2, children: <p>Sentiment</p> }}
      />,
    );
    expect(screen.getByText('Sentiment')).toBeInTheDocument();
  });

  it('bascule les filtres au clic', () => {
    const onToggle = vi.fn();
    render(
      <PageHeader title="Appels" filters={{ open: false, onToggle, children: null }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Filtres avancés' }));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
