import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useEventsStore } from '@store/eventsStore';
import { usePreferencesStore } from '@store/preferencesStore';
import { EventCard } from '@components/EventCard';
import { FilterBar } from '@components/FilterBar';
import { EmptyState } from '@components/EmptyState';
import { CalendarGrid } from '@components/CalendarGrid';
import { syncService } from '@services/syncService';
import { EventTier, SportId } from '@app-types/index';
import { formatLongDate } from '@utils/dateUtils';

/**
 * Écran Calendrier : vue mensuelle + liste des événements du jour sélectionné.
 * Layout 2 colonnes sur tablette/desktop (lg:), empilement vertical sur mobile.
 */
export function CalendarScreen() {
  const navigate = useNavigate();
  const events = useEventsStore((s) => s.events);
  const isSyncing = useEventsStore((s) => s.isSyncing);
  const getFilteredEvents = useEventsStore((s) => s.getFilteredEvents);
  const { selectedSports: prefSports } = usePreferencesStore((s) => s.preferences);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeSports, setActiveSports] = useState<SportId[]>(prefSports);
  const [activeTiers, setActiveTiers] = useState<EventTier[]>(['S', 'A', 'B', 'C']);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { setActiveSports(prefSports); }, [prefSports]);

  useEffect(() => {
    if (events.length === 0 && !isSyncing) {
      syncService.synchronize().catch(console.warn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredEvents = useMemo(
    () => {
      // Quand une recherche est active, on ignore les filtres de sport
      // pour permettre à l'utilisateur de trouver une équipe même si
      // son sport n'est pas coché.
      if (searchQuery.trim()) {
        return getFilteredEvents({ tiers: activeTiers, searchQuery });
      }
      return getFilteredEvents({ sports: activeSports, tiers: activeTiers });
    },
    [getFilteredEvents, activeSports, activeTiers, searchQuery, events]
  );

  const dayEvents = useMemo(() => {
    const dayKey = selectedDate.toISOString().substring(0, 10);
    return filteredEvents
      .filter((e) => e.startDate.substring(0, 10) === dayKey)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [filteredEvents, selectedDate]);

  const handleSync = async () => {
    try { await syncService.synchronize(); } catch (err) { console.warn(err); }
  };

  const toggleSport = (sportId: SportId) =>
    setActiveSports((c) => c.includes(sportId) ? c.filter((s) => s !== sportId) : [...c, sportId]);
  const toggleTier = (tier: EventTier) =>
    setActiveTiers((c) => c.includes(tier) ? c.filter((t) => t !== tier) : [...c, tier]);

  return (
    <div className="flex flex-col h-full">
      <FilterBar
        availableSports={prefSports}
        selectedSports={activeSports}
        onToggleSport={toggleSport}
        onSetSports={setActiveSports}
        selectedTiers={activeTiers}
        onToggleTier={toggleTier}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:grid lg:grid-cols-[420px_1fr] lg:gap-6 max-w-7xl mx-auto">
          {/* Calendrier */}
          <div className="mb-4 lg:mb-0 lg:sticky lg:top-4 lg:self-start">
            <CalendarGrid
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              currentMonth={currentMonth}
              onChangeMonth={setCurrentMonth}
              events={filteredEvents}
            />
          </div>

          {/* Liste des événements du jour */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white capitalize">
                  {formatLongDate(selectedDate.toISOString())}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {dayEvents.length} événement{dayEvents.length > 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                title="Synchroniser"
              >
                <RefreshCw
                  size={18}
                  className={`text-slate-600 dark:text-slate-300 ${isSyncing ? 'animate-spin' : ''}`}
                />
              </button>
            </div>

            {dayEvents.length === 0 ? (
              <EmptyState
                title="Aucun événement"
                message="Aucun événement pour ce jour selon vos filtres actuels."
                actionLabel="Synchroniser"
                onAction={handleSync}
              />
            ) : (
              <div className="space-y-2">
                {dayEvents.map((event) => (
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
      </div>
    </div>
  );
}
