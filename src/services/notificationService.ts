import { SportEvent, NotificationSettings } from '@app-types/index';
import { SPORTS_CATALOG } from '@constants/sports';
import { isImportantEvent } from '@utils/tierClassifier';
import { formatTime } from '@utils/dateUtils';

/**
 * Service de notifications basé sur l'API Notification du navigateur.
 *
 * Stratégie :
 * - On utilise setTimeout pour planifier (fonctionne quand la PWA est ouverte
 *   ou en arrière-plan tant que l'onglet n'est pas tué).
 * - Pour les rappels longs, on stocke les planifications dans localStorage
 *   afin de les restaurer à la réouverture.
 *
 * Limite connue : une PWA fermée depuis plus de ~30 min peut rater les
 * notifications. Pour du 100% fiable il faudrait un service push serveur —
 * à ajouter plus tard si nécessaire.
 */

interface ScheduledItem {
  id: string;
  fireAt: number;
  title: string;
  body: string;
  tag: string;
}

const STORAGE_KEY = 'sportcalendar-scheduled-notifications';
const timers = new Map<string, number>();

class NotificationService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (!('Notification' in window)) {
      console.info('[Notification] API non supportée');
      this.initialized = true;
      return;
    }
    // Restaurer les notifications planifiées à la réouverture
    this.restoreScheduled();
    this.initialized = true;
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  hasPermission(): boolean {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  scheduleForEvent(event: SportEvent, settings: NotificationSettings): void {
    if (!this.hasPermission()) return;
    if (!settings.enabled) return;
    if (settings.onlyImportant && !isImportantEvent(event)) return;
    if (event.status !== 'scheduled') return;

    const startDate = new Date(event.startDate);
    const now = Date.now();

    settings.reminderMinutes.forEach((minutesBefore) => {
      const fireAt = startDate.getTime() - minutesBefore * 60_000;
      if (fireAt <= now) return;
      this.scheduleSingle({
        id: `${event.id}-${minutesBefore}`,
        fireAt,
        title: this.buildTitle(event),
        body: this.buildMessage(event, minutesBefore),
        tag: event.id,
      });
    });

    if (settings.onLiveStart) {
      const fireAt = startDate.getTime();
      if (fireAt > now) {
        this.scheduleSingle({
          id: `${event.id}-live`,
          fireAt,
          title: `🔴 LIVE – ${event.title}`,
          body: `${event.league} • Le match commence !`,
          tag: event.id,
        });
      }
    }
  }

  cancelForEvent(eventId: string): void {
    const scheduled = this.loadScheduled();
    const remaining = scheduled.filter((item) => item.tag !== eventId);
    scheduled
      .filter((item) => item.tag === eventId)
      .forEach((item) => {
        const handle = timers.get(item.id);
        if (handle) window.clearTimeout(handle);
        timers.delete(item.id);
      });
    this.saveScheduled(remaining);
  }

  cancelAll(): void {
    timers.forEach((handle) => window.clearTimeout(handle));
    timers.clear();
    localStorage.removeItem(STORAGE_KEY);
  }

  // ======== privés ========

  private scheduleSingle(item: ScheduledItem): void {
    const delay = item.fireAt - Date.now();
    // setTimeout est limité à ~24,8 jours (2^31 ms). Au-delà, on stocke pour
    // re-planifier à la réouverture.
    if (delay > 0 && delay < 2_000_000_000) {
      const handle = window.setTimeout(() => this.show(item), delay);
      timers.set(item.id, handle);
    }
    const scheduled = this.loadScheduled();
    const others = scheduled.filter((s) => s.id !== item.id);
    this.saveScheduled([...others, item]);
  }

  private show(item: ScheduledItem): void {
    if (!this.hasPermission()) return;
    try {
      new Notification(item.title, { body: item.body, tag: item.tag, icon: '/icon-192.png' });
    } catch (error) {
      console.warn('[Notification] Erreur affichage', error);
    }
  }

  private restoreScheduled(): void {
    const scheduled = this.loadScheduled();
    const now = Date.now();
    const future = scheduled.filter((s) => s.fireAt > now);
    future.forEach((item) => {
      const handle = window.setTimeout(() => this.show(item), item.fireAt - now);
      timers.set(item.id, handle);
    });
    // Nettoie les notifications passées
    this.saveScheduled(future);
  }

  private loadScheduled(): ScheduledItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveScheduled(items: ScheduledItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }

  private buildTitle(event: SportEvent): string {
    const meta = SPORTS_CATALOG[event.sportId];
    const emoji =
      event.tier === 'S' ? '⭐'
      : event.tier === 'A' ? '🏆'
      : event.tier === 'B' ? '🔥'
      : '⚽';
    return `${emoji} ${meta?.label ?? event.sportId} • ${event.league}`;
  }

  private buildMessage(event: SportEvent, minutesBefore: number): string {
    const delayLabel =
      minutesBefore >= 1440 ? `dans ${Math.round(minutesBefore / 1440)} j`
      : minutesBefore >= 60 ? `dans ${Math.round(minutesBefore / 60)} h`
      : `dans ${minutesBefore} min`;

    const teams =
      event.homeTeam && event.awayTeam
        ? `${event.homeTeam.name} vs ${event.awayTeam.name}`
        : event.title;

    return `${teams} – ${delayLabel} (${formatTime(event.startDate)})`;
  }
}

export const notificationService = new NotificationService();
