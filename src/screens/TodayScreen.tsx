import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, CalendarSearch } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useEventsStore } from '@store/eventsStore';
import { usePreferencesStore } from '@store/preferencesStore';
import { EventCard } from '@components/EventCard';
import { EmptyState } from '@components/EmptyState';
import { syncService } from '@services/syncService';
import { groupByDay, formatLongDate } from '@utils/dateUtils';

/**
 * Écran "À venir" : 14 prochains jours, regroupés par date.
 */
export function TodayScreen() {
  const navigate = useNavigate();
  const events = useEventsStore((s) => s.events);
  const isSyncing = useEventsStore((s) => s.isSyncing);
  const getUpcomingEvents = useEventsStore((s) => s.getUpcomingEvents);
  const { selectedSports } = usePreferencesStore((s) => s.preferences);

  // Synchronisation initiale
  useEffect(() => {
    if (events.length === 0 && !isSyncing) {
      syncService.synchronize().catch(console.warn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sections = useMemo(() => {
    const upcoming = getUpcomingEvents(200).filter((e) => selectedSports.includes(e.sportId));
    const maxDate = addDays(new Date(), 14).toISOString();
    const windowed = upcoming.filter((e) => e.startDate <= maxDate);
    const grouped = groupByDay(windowed);
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, items]) => ({ day, title: relativeLabel(day), events: items }));
  }, [events, selectedSports, getUpcomingEvents]);

  const handleSync = useCallback(async () => {
    try { await syncService.synchronize(); } catch (err) { console.warn(err); }
  }, []);

  return (
    <div className="pb-4">
      {/* Hero */}
      <div className="px-4 pt-6 pb-3 md:pt-10 flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase">
            {format(new Date(), 'EEEE d MMMM', { locale: fr })}
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white mt-1">
            Vos 14 prochains jours
          </h1>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="shrink-0 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
          title="Synchroniser"
        >
          <RefreshCw
            size={20}
            className={`text-slate-600 dark:text-slate-300 ${isSyncing ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* Liste */}
      {sections.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<CalendarSearch size={44} className="text-slate-400 dark:text-slate-500" />}
            title="Aucun événement à venir"
            message="Synchronisez ou ajustez vos sports dans les paramètres."
            actionLabel="Synchroniser maintenant"
            onAction={handleSync}
          />
        </div>
      ) : (
        <div className="px-4 space-y-6 mt-2">
          {sections.map((section) => (
            <div key={section.day}>
              <div className="flex items-baseline justify-between mb-2 px-1">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {section.title}
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {section.events.length} événement{section.events.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-2">
                {section.events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onClick={(e) => navigate(`/event/${encodeURIComponent(e.id)}`)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function relativeLabel(dayKey: string): string {
  const target = new Date(`${dayKey}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  return formatLongDate(`${dayKey}T00:00:00Z`);
}
