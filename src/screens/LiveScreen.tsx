import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, RadioTower, RefreshCw } from 'lucide-react';
import { useEventsStore } from '@store/eventsStore';
import { EventCard } from '@components/EventCard';
import { EmptyState } from '@components/EmptyState';
import { syncService } from '@services/syncService';

export function LiveScreen() {
  const navigate = useNavigate();
  const getLiveEvents = useEventsStore((s) => s.getLiveEvents);
  const events = useEventsStore((s) => s.events);
  const isSyncing = useEventsStore((s) => s.isSyncing);
  const [tick, setTick] = useState(0);

  // Rafraîchissement automatique du statut toutes les 60s
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const liveEvents = useMemo(() => getLiveEvents(), [getLiveEvents, events, tick]);

  const handleSync = async () => {
    try { await syncService.synchronize(); } catch (err) { console.warn(err); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-4 flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse-live" />
        <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white flex-1">
          En direct
        </h1>
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
