import { useEffect, useRef } from 'react';

/**
 * Hook qui relance périodiquement une action tant que le composant est monté
 * ET que l'onglet est visible.
 *
 * Utilisé pour garder les scores live à jour sur plusieurs écrans.
 *
 * @param action  fonction à appeler (généralement syncService.synchronize)
 * @param intervalMs  délai entre appels (par défaut 45 sec)
 * @param enabled  pour désactiver temporairement sans démonter
 */
export function useAutoRefresh(
  action: () => Promise<unknown> | void,
  intervalMs = 45_000,
  enabled = true
) {
  const actionRef = useRef(action);
  actionRef.current = action;

  useEffect(() => {
    if (!enabled) return;

    let timerId: number | undefined;

    const runNext = () => {
      if (document.hidden) return;
      timerId = window.setTimeout(async () => {
        try {
          await actionRef.current();
        } catch (err) {
          console.warn('[useAutoRefresh]', err);
        }
        runNext();
      }, intervalMs);
    };

    const handleVisibility = () => {
      if (timerId) window.clearTimeout(timerId);
      if (!document.hidden) runNext();
    };

    runNext();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timerId) window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [intervalMs, enabled]);
}
