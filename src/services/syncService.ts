import { addDays } from 'date-fns';
import { SportProvider, SportId, SportEvent } from '@app-types/index';
import { espnProvider } from './espnProvider';
import { esportsProvider } from './esportsProvider';
import { SPORTS_CATALOG } from '@constants/sports';
import { useEventsStore } from '@store/eventsStore';
import { usePreferencesStore } from '@store/preferencesStore';
import { notificationService } from './notificationService';

/**
 * Résultat détaillé d'une synchronisation, utilisé pour le diagnostic.
 */
export interface SyncStats {
  total: number;
  duplicatesRemoved: number;
  byProvider: Record<string, number>;
  errors: Array<{ provider: string; message: string }>;
  durationMs: number;
}

/**
 * Orchestre les providers pour agréger les événements RÉELS.
 */
class SyncService {
  private providers: SportProvider[] = [espnProvider, esportsProvider];
  private lastStats: SyncStats | null = null;

  getLastStats(): SyncStats | null {
    return this.lastStats;
  }

  async synchronize(options?: { sports?: SportId[]; days?: number }): Promise<SyncStats> {
    const store = useEventsStore.getState();
    const prefs = usePreferencesStore.getState().preferences;
    const startTime = Date.now();

    store.setSyncing(true);
    store.setError(null);

    const byProvider: Record<string, number> = {};
    const errors: Array<{ provider: string; message: string }> = [];

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

          if (applicableSports.length === 0) {
            byProvider[provider.id] = 0;
            continue;
          }

          const events = await provider.fetchEvents({ sports: applicableSports, from, to });
          all.push(...events);
          byProvider[provider.id] = events.length;
          console.info(`[Sync] ${provider.id}: ${events.length} événements`);
        } catch (error: any) {
          const message = error?.message ?? String(error);
          console.warn(`[Sync] ${provider.id} a échoué`, error);
          errors.push({ provider: provider.id, message });
          byProvider[provider.id] = 0;
        }
      }

      // Déduplication par ID : si un événement arrive plusieurs fois
      // (bug ESPN sur les fenêtres de dates qui se chevauchent), on ne
      // garde qu'une occurrence.
      const deduped = this.dedupeEvents(all);
      const duplicatesRemoved = all.length - deduped.length;

      this.replaceUpcomingEvents(deduped);

      const timestamp = new Date().toISOString();
      store.setLastSyncedAt(timestamp);
      usePreferencesStore.getState().setLastSyncAt(timestamp);

      this.scheduleUpcomingNotifications();

      const stats: SyncStats = {
        total: deduped.length,
        duplicatesRemoved,
        byProvider,
        errors,
        durationMs: Date.now() - startTime,
      };
      this.lastStats = stats;
      return stats;
    } catch (error: any) {
      store.setError(error?.message ?? 'Erreur inconnue');
      throw error;
    } finally {
      store.setSyncing(false);
    }
  }

  /**
   * Déduplication par ID d'événement.
   * En cas de doublon, on conserve la version la plus récemment synchronisée.
   */
  private dedupeEvents(events: SportEvent[]): SportEvent[] {
    const map = new Map<string, SportEvent>();
    events.forEach((event) => {
      const existing = map.get(event.id);
      if (!existing || (event.lastSyncedAt ?? '') >= (existing.lastSyncedAt ?? '')) {
        map.set(event.id, event);
      }
    });
    return Array.from(map.values());
  }

  /**
   * Remplace tous les événements dans la fenêtre de resynchronisation.
   * Les événements hors fenêtre sont conservés (historique).
   * Les nouveaux événements sont également dédupliqués contre l'historique.
   */
  private replaceUpcomingEvents(freshEvents: SportEvent[]): void {
    const store = useEventsStore.getState();
    const threshold = addDays(new Date(), -3).toISOString();

    const oldEvents = store.events.filter((e) => e.startDate < threshold);

    // Merger en dédupliquant globalement
    const all = [...oldEvents, ...freshEvents];
    const deduped = this.dedupeEvents(all);
    store.setEvents(deduped);
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
