import { SportEvent } from '@app-types/index';
import { SPORTS_CATALOG } from '@constants/sports';

/**
 * Intégration Google Calendar via lien d'ajout direct.
 *
 * Pour une PWA, le plus simple et le plus fiable est d'utiliser
 * l'URL de "quick-add" de Google Calendar, qui ouvre un formulaire
 * prérempli dans un nouvel onglet. Pas besoin d'OAuth, pas de clé API.
 *
 * L'utilisateur valide d'un clic et l'événement est ajouté.
 */
class GoogleCalendarService {
  /**
   * Construit l'URL d'ajout Google Calendar pour un événement donné.
   * Format : https://calendar.google.com/calendar/render?action=TEMPLATE&...
   */
  buildCalendarUrl(event: SportEvent): string {
    const meta = SPORTS_CATALOG[event.sportId];
    const teams = event.homeTeam && event.awayTeam
      ? `${event.homeTeam.name} vs ${event.awayTeam.name}`
      : event.title;

    const start = this.toGoogleDate(event.startDate);
    const endIso = event.endDate ??
      new Date(new Date(event.startDate).getTime() + 2 * 60 * 60 * 1000).toISOString();
    const end = this.toGoogleDate(endIso);

    const description = [
      `Sport : ${meta?.label ?? event.sportId}`,
      `Ligue : ${event.league}`,
      event.round ? `Phase : ${event.round}` : null,
      event.broadcast?.length ? `Diffusion : ${event.broadcast.join(', ')}` : null,
      `Importance : Tier ${event.tier}`,
    ].filter(Boolean).join('\n');

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: teams,
      dates: `${start}/${end}`,
      details: description,
      location: event.venue ?? '',
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  /**
   * Ouvre Google Calendar dans un nouvel onglet avec le formulaire prérempli.
   */
  addToCalendar(event: SportEvent): void {
    const url = this.buildCalendarUrl(event);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * Format Google Calendar : YYYYMMDDTHHMMSSZ
   */
  private toGoogleDate(iso: string): string {
    return new Date(iso)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  }
}

export const googleCalendarService = new GoogleCalendarService();
