import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, CalendarSearch, CalendarDays, Trophy } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useEventsStore } from '@store/eventsStore';
import { usePreferencesStore } from '@store/preferencesStore';
import { EventCard } from '@components/EventCard';
import { EmptyState } from '@components/EmptyState';
import { EventListSkeleton } from '@components/EventCardSkeleton';
import { syncService } from '@services/syncService';
import { useAutoRefresh } from '@hooks/useAutoRefresh';
import { SportEvent } from '@app-types/index';
import { groupByDay, formatLongDate } from '@utils/dateUtils';

type GroupMode = 'day' | 'competition';

/**
 * Écran "À venir" : 14 prochains jours, avec :
 *  - Toggle de regroupement : par jour OU par compétition
 *  - Auto-refresh toutes les 2 min
 *  - Skeleton de chargement pendant la sync initiale
 */
export function TodayScreen() {
  const navigate = useNavigate();
  const events = useEventsStore((s) => s.events);
  const isSyncing = useEventsStore((s) => s.isSyncing);
  const getUpcomingEvents = useEventsStore((s) => s.getUpcomingEvents);
  const { selectedSports } = usePreferencesStore((s) => s.preferences);

  const [groupMode, setGroupMode] = useState<GroupMode>('day');

  useEffect(() => {
    if (events.length === 0 && !isSyncing) {
      syncService.synchronize().catch(console.warn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAutoRefresh(() => syncService.synchronize(), 120_000);

  /**
   * Tri global : live d'abord, puis chronologique.
   */
  const windowedEvents = useMemo(() => {
    const upcoming = getUpcomingEvents(500).filter((e) => selectedSports.includes(e.sportId));
    const maxDate = addDays(new Date(), 14).toISOString();
    return upcoming
      .filter((e) => e.startDate <= maxDate)
      .sort((a, b) => {
        // Live toujours en premier
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (b.status === 'live' && a.status !== 'live') return 1;
        return a.startDate.localeCompare(b.startDate);
      });
  }, [events, selectedSports, getUpcomingEvents]);

  /**
   * Sections par jour (par défaut).
   */
  const sectionsByDay = useMemo(() => {
    const grouped = groupByDay(windowedEvents);
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, items]) => ({ key: day, title: relativeLabel(day), events: items }));
  }, [windowedEvents]);

  /**
   * Sections par compétition (mode alternatif).
   * Regroupe par nom de ligue, trie les ligues par nombre d'événements desc.
   */
  const sectionsByCompetition = useMemo(() => {
    const grouped = new Map<string, SportEvent[]>();
    windowedEvents.forEach((e) => {
      if (!grouped.has(e.league)) grouped.set(e.league, []);
      grouped.get(e.league)!.push(e);
    });
    return Array.from(grouped.entries())
      .sort(([, a], [, b]) => b.length - a.length)
      .map(([league, items]) => ({
        key: league,
        title: league,
        events: items,
      }));
  }, [windowedEvents]);

  const sections = groupMode === 'day' ? sectionsByDay : sectionsByCompetition;

  const handleSync = async () => {
    try { await syncService.synchronize(); } catch (err) { console.warn(err); }
  };

  const handleCardClick = (event: SportEvent) =>
    navigate(`/event/${encodeURIComponent(event.id)}`);

  const isInitialLoading = isSyncing && events.length === 0;

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

      {/* Toggle de regroupement */}
      <div className="px-4 mb-4">
        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
          <button
            onClick={() => setGroupMode('day')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
              groupMode === 'day'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <CalendarDays size={14} />
            Par jour
          </button>
          <button
            onClick={() => setGroupMode('competition')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
              groupMode === 'competition'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <Trophy size={14} />
            Par compétition
          </button>
        </div>
      </div>

      {/* Contenu */}
      {isInitialLoading ? (
        <div className="px-4">
          <EventListSkeleton count={4} />
        </div>
      ) : sections.length === 0 ? (
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
            <div key={section.key}>
              <div className="flex items-baseline justify-between mb-2 px-1">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 truncate">
                  {section.title}
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 ml-2">
                  {section.events.length} événement{section.events.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-2">
                {section.events.map((event) => (
                  <EventCard key={event.id} event={event} onClick={handleCardClick} showDate={groupMode === 'competition'} />
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
