import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Calendar } from 'lucide-react';
import { useEventsStore } from '@store/eventsStore';
import { usePreferencesStore } from '@store/preferencesStore';
import { EventCard } from '@components/EventCard';
import { EmptyState } from '@components/EmptyState';
import { syncService } from '@services/syncService';

export function FavoritesScreen() {
  const navigate = useNavigate();
  const events = useEventsStore((s) => s.events);
  const { favoriteTeams, favoriteLeagues } = usePreferencesStore((s) => s.preferences);

  const filtered = useMemo(() => {
    if (favoriteTeams.length === 0 && favoriteLeagues.length === 0) return [];
    return events
      .filter((e) => {
        if (favoriteLeagues.includes(e.league)) return true;
        const teamIds = [e.homeTeam?.id, e.awayTeam?.id].filter(Boolean) as string[];
        const teamNames = [e.homeTeam?.name, e.awayTeam?.name].filter(Boolean) as string[];
        return (
          teamIds.some((id) => favoriteTeams.includes(id)) ||
          teamNames.some((name) => favoriteTeams.includes(name))
        );
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [events, favoriteTeams, favoriteLeagues]);

  const hasFavorites = favoriteTeams.length > 0 || favoriteLeagues.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-4">
        <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
          Vos favoris
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {filtered.length} événement{filtered.length > 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!hasFavorites ? (
          <EmptyState
            icon={<Heart size={44} className="text-slate-400 dark:text-slate-500" />}
            title="Pas encore de favoris"
            message="Ajoutez une équipe ou une ligue favorite depuis la fiche détaillée d'un événement."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Calendar size={44} className="text-slate-400 dark:text-slate-500" />}
            title="Aucun événement pour vos favoris"
            message="Vérifiez votre sélection ou synchronisez à nouveau."
            actionLabel="Synchroniser"
            onAction={() => syncService.synchronize().catch(console.warn)}
          />
        ) : (
          <div className="space-y-2 max-w-3xl mx-auto">
            {filtered.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                showDate
                onClick={(e) => navigate(`/event/${encodeURIComponent(e.id)}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
