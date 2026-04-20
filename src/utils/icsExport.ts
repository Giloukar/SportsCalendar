import { SportEvent } from '@app-types/index';
import { SPORTS_CATALOG } from '@constants/sports';

/**
 * Export d'événements au format iCalendar (.ics).
 *
 * Le format .ics est un standard universel (RFC 5545) supporté par
 * Google Agenda, Apple Calendar, Outlook, etc. Télécharger un fichier
 * .ics permet d'importer tous les événements d'un coup dans n'importe
 * quel agenda, contrairement au lien Google Calendar qui n'ajoute
 * qu'un événement à la fois.
 */

/**
 * Échappe un texte pour le format iCalendar.
 * Les caractères \, ; , doivent être préfixés par un backslash,
 * et les retours à la ligne remplacés par \n littéral.
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Formate une date ISO au format iCalendar UTC : YYYYMMDDTHHMMSSZ
 */
function formatIcsDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Construit une VEVENT valide à partir d'un SportEvent.
 */
function buildVEvent(event: SportEvent): string {
  const meta = SPORTS_CATALOG[event.sportId];
  const sportLabel = meta?.label ?? event.sportId;

  // Durée par défaut selon le sport. Pas parfait mais indicatif.
  const defaultDuration = sportLabel.toLowerCase().includes('tennis') ? 3 * 3600
    : event.category === 'esport' ? 2 * 3600
    : 2 * 3600; // 2h par défaut

  const startDate = event.startDate;
  const endDate = event.endDate ?? new Date(new Date(event.startDate).getTime() + defaultDuration * 1000).toISOString();

  const summary = event.homeTeam && event.awayTeam
    ? `${event.homeTeam.name} vs ${event.awayTeam.name}`
    : event.title;

  const descLines = [
    `Ligue : ${event.league}`,
    event.round ? `Phase : ${event.round}` : null,
    `Sport : ${sportLabel}`,
    `Importance : Tier ${event.tier}`,
    event.broadcast?.length ? `Diffusion : ${event.broadcast.filter((b) => !b.startsWith('http')).join(', ')}` : null,
    event.externalUrls?.length ? `Streams : ${event.externalUrls.map((s) => s.url).join(' | ')}` : null,
  ].filter(Boolean);

  const description = escapeIcsText(descLines.join('\n'));
  const location = event.venue ? escapeIcsText(event.venue) : '';
  const uid = `${event.id}@sportcal.app`;
  const dtstamp = formatIcsDate(new Date().toISOString());

  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${formatIcsDate(startDate)}`,
    `DTEND:${formatIcsDate(endDate)}`,
    `SUMMARY:${escapeIcsText(`[${sportLabel}] ${summary}`)}`,
    location ? `LOCATION:${location}` : '',
    `DESCRIPTION:${description}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
  ]
    .filter(Boolean)
    .join('\r\n');
}

/**
 * Produit un fichier .ics complet et déclenche son téléchargement.
 */
export function exportEventsToICS(events: SportEvent[], filename = 'sportcal.ics'): void {
  if (events.length === 0) return;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SportCalendar//SportCalendarPWA//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Mon calendrier SportCal',
    'X-WR-TIMEZONE:Europe/Paris',
    ...events.map(buildVEvent),
    'END:VCALENDAR',
  ];

  const icsContent = lines.join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Libère l'URL après un court délai pour que le téléchargement ait le temps de partir
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
