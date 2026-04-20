import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RadioTower, RefreshCw } from 'lucide-react';
import { useEventsStore } from '@store/eventsStore';
import { EventCard } from '@components/EventCard';
import { EmptyState } from '@components/EmptyState';
import { syncService } from '@services/syncService';
import { SPORTS_POPULARITY_FR } from '@constants/sports';
import { SportId } from '@app-types/index';

/**
 * Écran Live : matches en cours.
 *
 * Auto-refresh toutes les 30 secondes pour garder les scores à jour.
 * L'auto-refresh est pausé quand l'onglet est en arrière-plan (économie d'énergie).
 */
const AUTO_REFRESH_MS = 30_000;

export function LiveScreen() {
  const navigate = useNavigate();
  const getLiveEvents = useEventsStore((s) => s.getLiveEvents);
  const events = useEventsStore((s) => s.events);
  const isSyncing = useEventsStore((s) => s.isSyncing);
  const lastSyncedAt = useEventsStore((s) => s.lastSyncedAt);

  const [tick, setTick] = useState(0);

  // Auto-refresh : relance une synchronisation toutes les 30s quand l'écran
  // est visible. On utilise Page Visibility API pour suspendre en background.
  useEffect(() => {
    let timerId: number | undefined;

    const scheduleNext = () => {
      if (document.hidden) return;
      timerId = window.setTimeout(async () => {
        try {
          await syncService.synchronize();
        } catch (err) {
          console.warn('[Live] Auto-refresh failed', err);
        }
        setTick((t) => t + 1);
        scheduleNext();
      }, AUTO_REFRESH_MS);
    };

    const handleVisibility = () => {
      if (timerId) window.clearTimeout(timerId);
      if (!document.hidden) scheduleNext();
    };

    // Premier refresh après le délai
    scheduleNext();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timerId) window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const liveEvents = useMemo(() => {
    const sportRank = (id: SportId) => {
      const idx = SPORTS_POPULARITY_FR.indexOf(id);
      return idx === -1 ? 999 : idx;
    };
    // Tri : tier S/A d'abord, puis popularité du sport, puis heure
    return [...getLiveEvents()].sort((a, b) => {
      const tierRank = (t: string) => (t === 'S' ? 0 : t === 'A' ? 1 : t === 'B' ? 2 : 3);
      const rt = tierRank(a.tier) - tierRank(b.tier);
      if (rt !== 0) return rt;
      const rs = sportRank(a.sportId) - sportRank(b.sportId);
      if (rs !== 0) return rs;
      return a.startDate.localeCompare(b.startDate);
    });
  }, [getLiveEvents, events, tick]);

  const handleSync = async () => {
    try { await syncService.synchronize(); } catch (err) { console.warn(err); }
  };

  const lastSyncLabel = lastSyncedAt
    ? `Màj il y a ${Math.max(1, Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 1000))}s`
    : 'Jamais synchronisé';

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-4 flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse-live" />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            En direct
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {lastSyncLabel} · Auto-refresh 30s
          </p>
        </div>
        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {liveEvents.length} match{liveEvents.length > 1 ? 'es' : ''}
        </span>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={`text-slate-600 dark:text-slate-300 ${isSyncing ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {liveEvents.length === 0 ? (
          <EmptyState
            icon={<RadioTower size={44} className="text-slate-400 dark:text-slate-500" />}
            title="Aucun match en direct"
            message="Revenez plus tard ou synchronisez pour actualiser les statuts."
            actionLabel="Actualiser"
            onAction={handleSync}
          />
        ) : (
          <div className="space-y-2 max-w-3xl mx-auto">
            {liveEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onClick={(e) => navigate(`/event/${encodeURIComponent(e.id)}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
