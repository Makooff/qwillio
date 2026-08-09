import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ErrorBoundary from './ErrorBoundary';

vi.mock('../lib/sentry', () => ({ Sentry: { withScope: () => {}, captureException: () => {} } }));

function Boom({ message }: { message: string }) {
  throw new Error(message);
  /* Inatteignable, mais `tsc -b` type un composant par son RETOUR: sans lui la
     fonction rend `void`, qui n'est pas un `ReactNode`, et le build de
     production échoue là où les tests passaient. */
  // eslint-disable-next-line no-unreachable
  return null;
}

const reload = vi.fn();

beforeEach(() => {
  reload.mockClear();
  sessionStorage.clear();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload },
  });
  // React logs the caught error; the test asserts behaviour, not the noise.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ErrorBoundary et les morceaux périmés', () => {
  /* La régression que ce test tient: après un déploiement, un onglet ouvert
     demande un fichier qui n'existe plus. La SPA réécrit tout vers
     `index.html`, donc le navigateur reçoit du HTML à la place d'un module et
     refuse de l'exécuter. WebKit et Blink le disent chacun à leur façon, et
     AUCUN des deux ne parle de « dynamically imported module »: le
     rechargement automatique ne partait pas, l'écran rouge s'affichait. */
  it.each([
    ["'text/html' is not a valid JavaScript MIME type.", 'WebKit'],
    ['Expected a JavaScript module script but the server responded with a MIME type of "text/html".', 'Blink'],
    ['Failed to fetch dynamically imported module: https://qwillio.com/assets/x.js', 'récupération'],
    ['Failed to load module script', 'chargement'],
  ])('recharge sur « %s » (%s)', (message) => {
    render(<ErrorBoundary><Boom message={message} /></ErrorBoundary>);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('ne recharge pas sur une vraie erreur applicative', () => {
    render(<ErrorBoundary><Boom message="Cannot read properties of undefined" /></ErrorBoundary>);
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText(/Something went wrong|Une erreur/i)).toBeInTheDocument();
  });

  /* Sans ce garde-fou, un morceau réellement absent boucle: recharger, échouer,
     recharger. Mieux vaut une page d'erreur qu'un téléphone qui clignote. */
  it('ne recharge qu’une fois dans la même fenêtre de dix secondes', () => {
    const msg = "'text/html' is not a valid JavaScript MIME type.";
    render(<ErrorBoundary><Boom message={msg} /></ErrorBoundary>);
    cleanup();
    render(<ErrorBoundary><Boom message={msg} /></ErrorBoundary>);
    expect(reload).toHaveBeenCalledOnce();
  });
});
