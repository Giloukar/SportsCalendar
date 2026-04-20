import { addDays } from 'date-fns';
import { SportProvider, SportId, SportEvent } from '@app-types/index';
import { espnProvider } from './espnProvider';
import { liquipediaProvider } from './liquipediaProvider';
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
  private providers: SportProvider[] = [espnProvider, liquipediaProvider];
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
          // Routage :
          //  - espn       → sports traditionnels
          //  - liquipedia → esports (source unique)
          const applicableSports =
            provider.id === 'espn' ? sportsByCategory.sport
            : provider.id === 'liquipedia' ? sportsByCategory.esport
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
   * Déduplication par ID d'événement, puis par signature logique
   * (équipes + date à ±1h) pour attraper les doublons cross-provider.
   * Ex : PandaScore et HLTV renvoient tous les deux NAVI vs Vitality à 20h → on n'en garde qu'un.
   * On privilégie PandaScore pour les streams officiels, mais on fusionne les infos.
   */
  private dedupeEvents(events: SportEvent[]): SportEvent[] {
    // Phase 1 : dédup par ID stricte
    const byId = new Map<string, SportEvent>();
    events.forEach((event) => {
      const existing = byId.get(event.id);
      if (!existing || (event.lastSyncedAt ?? '') >= (existing.lastSyncedAt ?? '')) {
        byId.set(event.id, event);
      }
    });

    // Phase 2 : dédup par signature logique (équipes + ~date)
    // Clé : sportId + teams_triés_alphabetiquement + heure_arrondie
    const bySignature = new Map<string, SportEvent>();
    const result: SportEvent[] = [];

    for (const event of byId.values()) {
      if (!event.homeTeam || !event.awayTeam) {
        result.push(event);
        continue;
      }

      const teamsKey = [event.homeTeam.name, event.awayTeam.name]
        .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
        .sort()
        .join('-');
      const hourSlot = Math.floor(new Date(event.startDate).getTime() / (60 * 60 * 1000));
      const sig = `${event.sportId}|${teamsKey}|${hourSlot}`;

      const existing = bySignature.get(sig);
      if (!existing) {
        bySignature.set(sig, event);
        result.push(event);
      } else {
        // Fusion : on garde celui qui a le plus d'infos, on enrichit avec ce qui manque
        const merged = this.mergeEvents(existing, event);
        bySignature.set(sig, merged);
        // Remplace dans result
        const idx = result.findIndex((e) => e.id === existing.id);
        if (idx >= 0) result[idx] = merged;
      }
    }

    return result;
  }

  /**
   * Fusionne deux événements qui représentent le même match.
   * On garde l'ID de celui qui a le tier le plus important, puis on
   * complète les champs manquants depuis l'autre.
   */
  private mergeEvents(a: SportEvent, b: SportEvent): SportEvent {
    const tierOrder: Record<SportEvent['tier'], number> = { S: 0, A: 1, B: 2, C: 3 };
    const primary = tierOrder[a.tier] <= tierOrder[b.tier] ? a : b;
    const secondary = primary === a ? b : a;

    return {
      ...primary,
      homeScore: primary.homeScore ?? secondary.homeScore,
      awayScore: primary.awayScore ?? secondary.awayScore,
      venue: primary.venue ?? secondary.venue,
      round: primary.round ?? secondary.round,
      broadcast: [...(primary.broadcast ?? []), ...(secondary.broadcast ?? [])]
        .filter((v, i, arr) => arr.indexOf(v) === i),
      externalUrls: [...(primary.externalUrls ?? []), ...(secondary.externalUrls ?? [])]
        .filter((v, i, arr) => arr.findIndex((x) => x.url === v.url) === i),
      // Statut le plus "avancé" gagne (live > finished > scheduled)
      status: a.status === 'live' || b.status === 'live' ? 'live'
        : a.status === 'finished' || b.status === 'finished' ? 'finished'
        : primary.status,
    };
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
