import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// A lazily-imported route chunk failing to load almost always means the user
// has a stale index.html from before a deploy (Vite renames hashed chunks each
// build). Reloading fetches the fresh index.html and the new chunk names.
const CHUNK_ERROR_RE = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk [\d]+ failed/i;

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
              {chunkError ? <RefreshCw size={28} className="text-[#6366f1] animate-spin" /> : <AlertTriangle size={28} className="text-red-500" />}
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
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#6366f1] rounded-xl hover:bg-[#4f46e5] transition-colors"
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
