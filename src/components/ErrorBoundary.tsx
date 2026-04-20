import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

/**
 * ErrorBoundary React : attrape les erreurs non gérées et affiche
 * une page d'erreur au lieu d'un écran blanc.
 *
 * Propose 2 actions de récupération :
 *  - Recharger l'app
 *  - Vider le localStorage + recharger (réinitialisation totale,
 *    utile si les données persistées sont corrompues)
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: '' };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.setState({
      hasError: true,
      error,
      errorInfo: errorInfo.componentStack ?? '',
    });
  }

  handleReload = () => {
    // Désenregistre d'abord le service worker pour forcer le rechargement
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  handleReset = () => {
    if (!confirm('Effacer toutes les données locales et recharger ? (chaînes IPTV, favoris, préférences)')) return;

    const doReload = () => window.location.reload();

    try {
      localStorage.clear();
    } catch {}

    // Unregister SW puis supprimer les caches puis recharger
    const cleanup = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {}
      doReload();
    };

    cleanup();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-900 p-6 shadow-lg">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={28} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Oups — l'application a rencontré une erreur
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Cela arrive parfois après une mise à jour. Rechargez, ou en
                  dernier recours réinitialisez vos données locales.
                </p>
              </div>
            </div>

            <details className="mb-4 text-xs">
              <summary className="cursor-pointer text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                Détails techniques
              </summary>
              <div className="mt-2 p-2.5 rounded bg-slate-100 dark:bg-slate-900 font-mono text-[10px] text-red-700 dark:text-red-400 whitespace-pre-wrap break-all max-h-40 overflow-auto">
                {this.state.error?.message}
                {this.state.errorInfo && '\n\n' + this.state.errorInfo.slice(0, 500)}
              </div>
            </details>

            <div className="space-y-2">
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm"
              >
                <RefreshCw size={14} />
                Recharger l'application
              </button>
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-white dark:bg-slate-700 border-2 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold text-sm"
              >
                <Trash2 size={14} />
                Réinitialiser et recharger
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
