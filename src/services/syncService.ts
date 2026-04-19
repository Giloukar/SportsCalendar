import { addDays } from 'date-fns';
import { SportProvider, SportId, SportEvent } from '@app-types/index';
import { espnProvider } from './espnProvider';
import { esportsProvider } from './esportsProvider';
import { SPORTS_CATALOG } from '@constants/sports';
import { useEventsStore } from '@store/eventsStore';
import { usePreferencesStore } from '@store/preferencesStore';
import { notificationService } from './notificationService';

/**
 * Orchestre les providers pour agréger les événements RÉELS.
 *
 * Providers :
 *  - ESPN (sports traditionnels) — aucune clé API requise
 *  - PandaScore (esports) — clé API à configurer dans esportsProvider.ts
 */
class SyncService {
  private providers: SportProvider[] = [espnProvider, esportsProvider];

  async synchronize(options?: { sports?: SportId[]; days?: number }): Promise<{ added: number; total: number }> {
    const store = useEventsStore.getState();
    const prefs = usePreferencesStore.getState().preferences;

    store.setSyncing(true);
    store.setError(null);

    try {
      const days = options?.days ?? 30;
      const from = addDays(new Date(), -3);
      const to = addDays(new Date(), days);

      const requestedSports = options?.sports ?? prefs.selectedSports;
      const sportsByCategory = this.splitByCategory(requestedSports);
      const all: SportEvent[] = [];

      for (const provider of this.providers) {
        try {
          const applicableSports =
            provider.id === 'pandascore' ? sportsByCategory.esport
            : provider.id === 'espn' ? sportsByCategory.sport
            : requestedSports;

          if (applicableSports.length === 0) continue;
          const events = await provider.fetchEvents({ sports: applicableSports, from, to });
          all.push(...events);
          console.info(`[Sync] ${provider.id}: ${events.length} événements récupérés`);
        } catch (error) {
          console.warn(`[Sync] Provider ${provider.id} a échoué`, error);
        }
      }

      // IMPORTANT : on remplace le cache des événements à venir pour
      // éviter de garder d'anciennes données périmées (notamment les
      // événements fictifs générés par l'ancienne version).
      this.replaceUpcomingEvents(all);

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

  /**
   * Remplace tous les événements dont la date de début est dans le futur
   * ou dans les 3 derniers jours (fenêtre de resynchronisation).
   * Conserve les événements plus anciens pour garder un historique.
   */
  private replaceUpcomingEvents(freshEvents: SportEvent[]): void {
    const store = useEventsStore.getState();
    const threshold = addDays(new Date(), -3).toISOString();

    // Garde les vieux événements (avant seuil)
    const oldEvents = store.events.filter((e) => e.startDate < threshold);
    // Ajoute les nouveaux (tous les événements récupérés)
    store.setEvents([...oldEvents, ...freshEvents]);
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
