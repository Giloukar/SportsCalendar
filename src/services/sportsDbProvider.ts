import axios, { AxiosInstance } from 'axios';
import { SportEvent, SportId, SportProvider, Team } from '@app-types/index';
import { classifyEventTier } from '@utils/tierClassifier';

/**
 * TheSportsDB – API publique gratuite.
 * Clé de test "123" pour les endpoints de base.
 * Documentation : https://www.thesportsdb.com/api.php
 *
 * Pour la production, remplacer `API_KEY` par une clé payante.
 */
const API_KEY = '123';
const BASE_URL = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;

/**
 * Mapping SportId → identifiant TheSportsDB.
 * Les esports ne sont pas couverts par TheSportsDB : nous utilisons
 * dans ce cas le provider esport dédié (voir esportsProvider.ts).
 */
const SPORT_DB_MAP: Partial<Record<SportId, { dbSport: string; defaultLeagues: string[] }>> = {
  football: {
    dbSport: 'Soccer',
    defaultLeagues: [
      'French Ligue 1',
      'English Premier League',
      'Spanish La Liga',
      'Italian Serie A',
      'German Bundesliga',
      'UEFA Champions League',
    ],
  },
  basketball: {
    dbSport: 'Basketball',
    defaultLeagues: ['NBA', 'EuroLeague'],
  },
  rugby: {
    dbSport: 'Rugby',
    defaultLeagues: ['French Top 14', 'Six Nations'],
  },
  formula1: { dbSport: 'Motorsport', defaultLeagues: ['Formula 1'] },
  motogp: { dbSport: 'Motorsport', defaultLeagues: ['MotoGP'] },
  handball: { dbSport: 'Handball', defaultLeagues: ['French HandBall Division 1'] },
  nfl: { dbSport: 'American Football', defaultLeagues: ['NFL'] },
  nhl: { dbSport: 'Ice Hockey', defaultLeagues: ['NHL'] },
  baseball: { dbSport: 'Baseball', defaultLeagues: ['MLB'] },
  tennis: { dbSport: 'Tennis', defaultLeagues: ['ATP'] },
  volleyball: { dbSport: 'Volleyball', defaultLeagues: [] },
  golf: { dbSport: 'Golf', defaultLeagues: ['PGA Tour'] },
  boxing: { dbSport: 'Fighting', defaultLeagues: [] },
  mma: { dbSport: 'Fighting', defaultLeagues: ['UFC'] },
  cycling: { dbSport: 'Cycling', defaultLeagues: [] },
  athletics: { dbSport: 'Athletics', defaultLeagues: [] },
  badminton: { dbSport: 'Badminton', defaultLeagues: [] },
};

interface DBEvent {
  idEvent: string;
  strEvent: string;
  strSport: string;
  strLeague: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  idHomeTeam?: string;
  idAwayTeam?: string;
  strHomeTeamBadge?: string;
  strAwayTeamBadge?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  dateEvent?: string;
  strTime?: string;
  strTimestamp?: string;
  strStatus?: string;
  strVenue?: string;
  strRound?: string;
  strTVStation?: string;
  strPostponed?: string;
}

function buildClient(): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeTeam(id: string | undefined, name: string | undefined, badge: string | undefined): Team | undefined {
  if (!name) return undefined;
  return {
    id: id ?? name,
    name,
    shortName: name,
    logoUrl: badge ?? undefined,
  };
}

function toIsoDate(event: DBEvent): string | null {
  if (event.strTimestamp) {
    // strTimestamp est typiquement "2026-03-14 20:00:00"
    const iso = event.strTimestamp.replace(' ', 'T') + 'Z';
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  if (event.dateEvent && event.strTime) {
    const iso = `${event.dateEvent}T${event.strTime}Z`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  if (event.dateEvent) {
    return new Date(event.dateEvent).toISOString();
  }
  return null;
}

function mapDbEventToSportEvent(event: DBEvent, sportId: SportId): SportEvent | null {
  const startDate = toIsoDate(event);
  if (!startDate) return null;

  const tier = classifyEventTier({
    sportId,
    league: event.strLeague ?? '',
    round: event.strRound ?? undefined,
    title: event.strEvent ?? undefined,
  });

  const status: SportEvent['status'] = event.strPostponed === 'yes'
    ? 'postponed'
    : event.strStatus === 'Match Finished' || event.strStatus === 'FT'
    ? 'finished'
    : event.strStatus === 'Not Started' || event.strStatus === 'NS' || !event.strStatus
    ? 'scheduled'
    : 'live';

  return {
    id: event.idEvent,
    title: event.strEvent ?? 'Événement',
    sportId,
    category: 'sport',
    startDate,
    league: event.strLeague ?? 'Unknown',
    tier,
    status,
    homeTeam: makeTeam(event.idHomeTeam, event.strHomeTeam, event.strHomeTeamBadge),
    awayTeam: makeTeam(event.idAwayTeam, event.strAwayTeam, event.strAwayTeamBadge),
    homeScore: event.intHomeScore != null ? Number(event.intHomeScore) : undefined,
    awayScore: event.intAwayScore != null ? Number(event.intAwayScore) : undefined,
    venue: event.strVenue ?? undefined,
    broadcast: event.strTVStation ? event.strTVStation.split(/[,;]/).map((s) => s.trim()) : undefined,
    round: event.strRound ?? undefined,
    lastSyncedAt: new Date().toISOString(),
  };
}

/**
 * Provider TheSportsDB. Récupère les événements à venir pour chaque ligue connue.
 * Le free tier est limité ; nous faisons donc des requêtes ciblées par ligue.
 */
export const sportsDbProvider: SportProvider = {
  id: 'thesportsdb',
  name: 'TheSportsDB',

  async fetchEvents({ sports, from, to }) {
    const client = buildClient();
    const sportIds = (sports ?? Object.keys(SPORT_DB_MAP)) as SportId[];
    const results: SportEvent[] = [];

    for (const sportId of sportIds) {
      const mapping = SPORT_DB_MAP[sportId];
      if (!mapping) continue;

      for (const league of mapping.defaultLeagues) {
        try {
          // Endpoint "eventsnextleague.php" requiert un ID de ligue.
          // Nous utilisons le endpoint de recherche pour rester flexible.
          const resp = await client.get('/searchevents.php', {
            params: { e: league.replace(/ /g, '_') },
          });
          const events: DBEvent[] = resp.data?.event ?? [];

          for (const raw of events) {
            const mapped = mapDbEventToSportEvent(raw, sportId);
            if (!mapped) continue;
            const d = new Date(mapped.startDate);
            if (d >= from && d <= to) {
              results.push(mapped);
            }
          }
        } catch (error) {
          // On log et on passe à la ligue suivante sans faire échouer toute la sync.
          console.warn(`[sportsDbProvider] Erreur ligue ${league}`, error);
        }
      }
    }

    return results;
  },
};
