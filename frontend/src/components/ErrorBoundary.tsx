import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from './icons';
import { Sentry } from '../lib/sentry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Un morceau de route qui ne se charge pas veut presque toujours dire que
 * l'onglet tient un `index.html` d'avant le dernier déploiement: Vite renomme
 * les fichiers à chaque build, et les anciens ne sont plus servis. Recharger
 * ramène le nouvel index et les nouveaux noms.
 *
 * La liste couvre les DEUX familles de message, et c'est ce qui manquait:
 *  - l'échec de récupération, dit à peu près pareil partout;
 *  - l'échec de TYPE, quand le serveur répond bien mais avec du HTML. Une SPA
 *    réécrit tout vers `index.html`, donc un fichier `.js` disparu revient en
 *    page HTML, et le navigateur refuse de l'exécuter. WebKit dit alors
 *    « 'text/html' is not a valid JavaScript MIME type », Blink « Expected a
 *    JavaScript module script but the server responded with a MIME type of
 *    text/html ». Aucun des deux ne contient « dynamically imported module »,
 *    si bien que le rechargement automatique ne partait pas et que l'écran
 *    rouge s'affichait à sa place (retour utilisateur, sur iPhone).
 */
const CHUNK_ERROR_RE = new RegExp([
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Importing a module script failed',
  'Loading chunk [\\d]+ failed',
  'is not a valid JavaScript MIME type',
  'Expected a JavaScript module script',
  'Failed to load module script',
].join('|'), 'i');

function isChunkLoadError(error?: Error | null): boolean {
  return !!error && CHUNK_ERROR_RE.test(error.message || '');
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    // Report to Sentry when configured; chunk-load errors are known noise from
    // stale deploys and should not clutter the issue tracker.
    if (!isChunkLoadError(error)) {
      Sentry.withScope((scope) => {
        scope.setTag('boundary', 'root');
        if (errorInfo?.componentStack) {
          scope.setExtra('componentStack', errorInfo.componentStack);
        }
        Sentry.captureException(error);
      });
    }
    // Stale-chunk after a deploy: hard-reload once to pull the fresh build.
    // sessionStorage guard prevents an infinite reload loop if it persists.
    if (isChunkLoadError(error)) {
      const last = Number(sessionStorage.getItem('chunkReloadAt') || 0);
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem('chunkReloadAt', String(Date.now()));
        window.location.reload();
      }
    }
  }

  handleRetry = () => {
    // For chunk errors, only a real reload pulls the new bundle.
    if (isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const chunkError = isChunkLoadError(this.state.error);
      return (
        <div className="min-h-screen flex items-center justify-center bg-white px-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              {chunkError ? <RefreshCw size={28} className="text-[#7a5fff] animate-spin" /> : <AlertTriangle size={28} className="text-red-500" />}
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {chunkError ? 'Nouvelle version disponible' : 'Something went wrong'}
            </h2>
            <p className="text-sm text-[#86868b] mb-4">
              {chunkError
                ? 'Mise à jour de l\'application, rechargement en cours…'
                : (this.state.error?.message || 'An unexpected error occurred')}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#7a5fff] rounded-xl hover:bg-[#7349fe] transition-colors"
              >
                <RefreshCw size={14} />
                Try again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2.5 text-sm font-medium text-[#86868b] rounded-xl hover:bg-[#f5f5f7] transition-colors"
              >
                Go home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
