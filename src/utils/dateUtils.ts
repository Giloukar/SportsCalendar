import { format, parseISO, isToday, isTomorrow, isYesterday, differenceInMinutes, isSameDay, addDays, startOfDay, endOfDay } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

const LOCALES = { fr, en: enUS };

/**
 * Formate une date au format "HH:mm" pour l'affichage horaire.
 */
export function formatTime(dateIso: string, locale: 'fr' | 'en' = 'fr'): string {
  return format(parseISO(dateIso), 'HH:mm', { locale: LOCALES[locale] });
}

/**
 * Formate une date longue : "Dimanche 18 octobre 2026".
 */
export function formatLongDate(dateIso: string, locale: 'fr' | 'en' = 'fr'): string {
  return format(parseISO(dateIso), 'EEEE d MMMM yyyy', { locale: LOCALES[locale] });
}

/**
 * Retourne une étiquette humaine du type "Aujourd'hui 20:00",
 * "Demain 19:45" ou "Sam. 14 mars 20:00".
 */
export function formatRelativeDate(dateIso: string, locale: 'fr' | 'en' = 'fr'): string {
  const date = parseISO(dateIso);
  const time = format(date, 'HH:mm');
  const todayLabel = locale === 'fr' ? "Aujourd'hui" : 'Today';
  const tomorrowLabel = locale === 'fr' ? 'Demain' : 'Tomorrow';
  const yesterdayLabel = locale === 'fr' ? 'Hier' : 'Yesterday';

  if (isToday(date)) return `${todayLabel} ${time}`;
  if (isTomorrow(date)) return `${tomorrowLabel} ${time}`;
  if (isYesterday(date)) return `${yesterdayLabel} ${time}`;

  return format(date, 'EEE d MMM HH:mm', { locale: LOCALES[locale] });
}

/**
 * Retourne le delta en minutes entre maintenant et la date cible.
 * Utile pour les notifications et les compteurs "dans X minutes".
 */
export function minutesUntil(dateIso: string): number {
  return differenceInMinutes(parseISO(dateIso), new Date());
}

/**
 * Groupe une liste d'événements par jour (clé YYYY-MM-DD).
 */
export function groupByDay<T extends { startDate: string }>(items: T[]): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = item.startDate.substring(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

/**
 * Utilitaires pour le composant Calendrier (plage visible).
 */
export function getVisibleRange(month: Date): { from: Date; to: Date } {
  const from = startOfDay(addDays(new Date(month.getFullYear(), month.getMonth(), 1), -7));
  const to = endOfDay(addDays(new Date(month.getFullYear(), month.getMonth() + 1, 0), 7));
  return { from, to };
}

export { isSameDay, addDays, startOfDay, endOfDay };
