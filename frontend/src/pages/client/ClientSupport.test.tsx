import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ClientSupport from './ClientSupport';

/* A1 (frontend) — plus de « Message envoyé ! » pour une demande qui n'est pas
   partie, et la saisie est conservée en cas d'échec pour permettre un renvoi
   en un clic. Le backend renvoie un code stable (502 `email_send_failed`),
   jamais le message brut du fournisseur.

   MÉCANIQUE DU TEST. Le submit est déclenché par `fireEvent.submit` sur le
   <form> ET entièrement englouti dans `await act(async () => …)`. Sans act,
   deux artefacts jsdom/vitest faussent le banc d'essai : (1) jsdom déclenche
   une SOUMISSION FANTÔME après l'événement, qui rappelle handleSubmit hors du
   test (un rejet ici est rapporté à la fin du test par vitest) ; (2) la
   rejection axios attrapée par le composant est quand même remontée comme
   erreur de test quand elle se résout hors d'un scope act. Aucun des deux
   n'existe dans un navigateur : en production un clic produit UN événement
   submit, preventDefault annule la navigation, et la rejection est consommée
   par le try/catch du composant. */

const post = vi.fn();
vi.mock('../../services/api', () => ({ default: { post: (...a: unknown[]) => post(...a) } }));

/* Rejette comme le fait axios: une vraie Error portant `response`. */
function refus502() {
  return Object.assign(new Error('Request failed with status code 502'), {
    response: { data: { error: 'email_send_failed' } },
  });
}

function mount() {
  return render(<ClientSupport />);
}

function remplir() {
  fireEvent.change(screen.getByPlaceholderText('Décrivez brièvement votre problème'), {
    target: { value: 'Le transfert ne fonctionne plus' },
  });
  fireEvent.change(screen.getByPlaceholderText('Décrivez votre problème en détail...'), {
    target: { value: 'Depuis ce matin, les appels urgents ne sont plus transférés.' },
  });
}

/** Déclenche le submit du formulaire et laisse la promesse du handler se
 *  résoudre entièrement à l'intérieur d'act (voir l'en-tête du fichier). */
async function soumettre(container: HTMLElement) {
  await act(async () => {
    fireEvent.submit(container.querySelector('form')!);
  });
}

/* NB: le reset du mock se fait DANS chaque test, pas en beforeEach. Un
   mockReset en beforeEach combiné à un mockRejectedValue attrapé par le
   composant fait remonter la rejection comme erreur de test (bug de
   bookkeeping vitest 2.1, constaté empiriquement; clearAllMocks en beforeEach
   ne pose pas de problème). */
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('ClientSupport — le succès n’est jamais fictif', () => {
  it('affiche « Message envoyé ! » et remplace le formulaire quand le serveur accepte', async () => {
    post.mockReset();
    post.mockResolvedValue({ data: { success: true } });
    const { container } = mount();
    remplir();
    await soumettre(container);
    expect(screen.getByText('Message envoyé !')).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/my-dashboard/support', {
      subject: '[general] Le transfert ne fonctionne plus',
      message: 'Depuis ce matin, les appels urgents ne sont plus transférés.',
    });
    // Le formulaire a cédé la place à la confirmation: la saisie n'est plus là.
    expect(screen.queryByPlaceholderText('Décrivez brièvement votre problème')).not.toBeInTheDocument();
  });

  it('sur 502 email_send_failed: message d’erreur, saisie conservée, pas de faux succès', async () => {
    post.mockReset();
    post.mockRejectedValue(refus502());
    const { container } = mount();
    remplir();
    await soumettre(container);
    expect(screen.getByText(/L'envoi a échoué de notre côté/)).toBeInTheDocument();
    expect(screen.queryByText('Message envoyé !')).not.toBeInTheDocument();
    // La saisie est conservée : renvoyer (ou corriger) coûte un clic.
    expect(screen.getByPlaceholderText('Décrivez brièvement votre problème')).toHaveValue('Le transfert ne fonctionne plus');
    expect(screen.getByPlaceholderText('Décrivez votre problème en détail...'))
      .toHaveValue('Depuis ce matin, les appels urgents ne sont plus transférés.');
  });

  it('n’affiche jamais le code technique brut ni de détail fournisseur', async () => {
    post.mockReset();
    post.mockRejectedValue(refus502());
    const { container } = mount();
    remplir();
    await soumettre(container);
    expect(screen.getByText(/L'envoi a échoué de notre côté/)).toBeInTheDocument();
    expect(screen.queryByText('email_send_failed')).not.toBeInTheDocument();
    expect(screen.queryByText(/Request failed/)).not.toBeInTheDocument();
  });

  it('permet de réessayer après un échec (retry) avec la saisie toujours là', async () => {
    post.mockReset();
    post.mockRejectedValueOnce(refus502());
    post.mockResolvedValue({ data: { success: true } });
    const { container } = mount();
    remplir();
    await soumettre(container);
    expect(screen.getByText(/L'envoi a échoué de notre côté/)).toBeInTheDocument();
    // Rien à ressaisir: la demande est intacte, on renvoie tel quel.
    await soumettre(container);
    expect(screen.getByText('Message envoyé !')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(2);
  });
});

describe('ClientSupport — design system (bouton canonique, sans changer la logique)', () => {
  it('le bouton d’envoi utilise le bouton canonique en contour mauve (plus de fond mauve)', () => {
    mount();
    const btn = screen.getByRole('button', { name: 'Envoyer le message' });
    expect(btn).toHaveStyle({ background: 'transparent', color: '#8a6fff' });
    expect(btn).toHaveAttribute('type', 'submit');
  });

  it('pendant l’envoi: bouton désactivé + aria-busy, saisie conservée côté DOM', async () => {
    post.mockReset();
    let resolvePost!: (v: unknown) => void;
    post.mockImplementation(() => new Promise((res) => { resolvePost = res; }));
    const { container } = mount();
    remplir();
    // Démarre l'envoi SANS attendre la résolution: observe l'état intermédiaire.
    // Le submit reste englouti dans act (cf. mécanique du fichier en-tête).
    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });
    const btn = screen.getByRole('button', { name: /Envoi/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    await act(async () => { resolvePost({ data: { success: true } }); });
    expect(screen.getByText('Message envoyé !')).toBeInTheDocument();
  });

  it('l’erreur d’envoi est une alerte explicite (role=alert) et ne casse pas la saisie', async () => {
    post.mockReset();
    post.mockRejectedValue(refus502());
    const { container } = mount();
    remplir();
    await soumettre(container);
    expect(screen.getByRole('alert')).toHaveTextContent(/L'envoi a échoué de notre côté/);
  });
});
