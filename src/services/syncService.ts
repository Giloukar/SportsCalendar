import { addDays } from 'date-fns';
import { SportProvider, SportId, SportEvent } from '@app-types/index';
import { sportsDbProvider } from './sportsDbProvider';
import { esportsProvider } from './esportsProvider';
import { mockDataProvider } from './mockDataProvider';
import { SPORTS_CATALOG } from '@constants/sports';
import { useEventsStore } from '@store/eventsStore';
import { usePreferencesStore } from '@store/preferencesStore';
import { notificationService } from './notificationService';

/**
 * Orchestre les providers pour agréger les événements.
 */
class SyncService {
  private providers: SportProvider[] = [sportsDbProvider, esportsProvider, mockDataProvider];

  async synchronize(options?: { sports?: SportId[]; days?: number }): Promise<{ added: number; total: number }> {
    const store = useEventsStore.getState();
    const prefs = usePreferencesStore.getState().preferences;

    store.setSyncing(true);
    store.setError(null);

    try {
      const days = options?.days ?? 60;
      const from = addDays(new Date(), -7);
      const to = addDays(new Date(), days);

      const requestedSports = options?.sports ?? prefs.selectedSports;
      const sportsByCategory = this.splitByCategory(requestedSports);
      const all: SportEvent[] = [];

      for (const provider of this.providers) {
        try {
          const applicableSports =
            provider.id === 'pandascore' ? sportsByCategory.esport
            : provider.id === 'thesportsdb' ? sportsByCategory.sport
            : requestedSports;

          if (applicableSports.length === 0) continue;
          const events = await provider.fetchEvents({ sports: applicableSports, from, to });
          all.push(...events);
        } catch (error) {
          console.warn(`[Sync] Provider ${provider.id} a échoué`, error);
        }
      }

      store.mergeEvents(all);
      const timestamp = new Date().toISOString();
      store.setLastSyncedAt(timestamp);
      usePreferencesStore.getState().setLastSyncAt(timestamp);

      this.scheduleUpcomingNotifications();
      return { added: all.length, total: useEventsStore.getState().events.length };
    } catch (error: any) {
      store.setError(error?.message ?? 'Erreur inconnue');
      throw error;
    } finally {
      store.setSyncing(false);
    }
  }

  private splitByCategory(sports: SportId[]): { sport: SportId[]; esport: SportId[] } {
    const sport: SportId[] = [];
    const esport: SportId[] = [];
    sports.forEach((id) => {
      const meta = SPORTS_CATALOG[id];
      if (!meta) return;
      if (meta.category === 'sport') sport.push(id);
      else esport.push(id);
    });
    return { sport, esport };
  }

  private scheduleUpcomingNotifications(): void {
    const prefs = usePreferencesStore.getState().preferences;
    if (!prefs.notifications.enabled) return;

    const upcoming = useEventsStore.getState().getUpcomingEvents(200);
    notificationService.cancelAll();
    upcoming.forEach((event) => notificationService.scheduleForEvent(event, prefs.notifications));
  }
}

export const syncService = new SyncService();
