import axios from 'axios';
import { SportEvent, SportId, SportProvider, Team } from '@app-types/index';
import { classifyEventTier } from '@utils/tierClassifier';

/**
 * Provider ESPN via la Netlify Function `espn-proxy`.
 * Cela contourne le CORS et permet d'utiliser l'API ESPN publique
 * depuis le navigateur sans clé.
 *
 * En dev local (npm run dev), les appels iront vers la même URL
 * relative : vous pouvez lancer `netlify dev` à la place de
 * `npm run dev` pour bénéficier du proxy localement.
 */

const PROXY_URL = '/.netlify/functions/espn-proxy';

interface EspnEndpoint {
  sport: string;
  league: string;
  displayName: string;
  sportId: SportId;
}

const ENDPOINTS: EspnEndpoint[] = [
  // Football
  { sport: 'soccer', league: 'eng.1', displayName: 'Premier League', sportId: 'football' },
  { sport: 'soccer', league: 'esp.1', displayName: 'La Liga', sportId: 'football' },
  { sport: 'soccer', league: 'ita.1', displayName: 'Serie A', sportId: 'football' },
  { sport: 'soccer', league: 'ger.1', displayName: 'Bundesliga', sportId: 'football' },
  { sport: 'soccer', league: 'fra.1', displayName: 'Ligue 1', sportId: 'football' },
  { sport: 'soccer', league: 'uefa.champions', displayName: 'UEFA Champions League', sportId: 'football' },
  { sport: 'soccer', league: 'uefa.europa', displayName: 'UEFA Europa League', sportId: 'football' },
  { sport: 'soccer', league: 'uefa.nations', displayName: 'UEFA Nations League', sportId: 'football' },
  { sport: 'soccer', league: 'fifa.world', displayName: 'Coupe du Monde FIFA', sportId: 'football' },
  { sport: 'soccer', league: 'usa.1', displayName: 'MLS', sportId: 'football' },

  // Basketball
  { sport: 'basketball', league: 'nba', displayName: 'NBA', sportId: 'basketball' },
  { sport: 'basketball', league: 'wnba', displayName: 'WNBA', sportId: 'basketball' },
  { sport: 'basketball', league: 'mens-college-basketball', displayName: 'NCAA Basketball', sportId: 'basketball' },

  // Football US
  { sport: 'football', league: 'nfl', displayName: 'NFL', sportId: 'nfl' },
  { sport: 'football', league: 'college-football', displayName: 'NCAA Football', sportId: 'nfl' },

  // Hockey
  { sport: 'hockey', league: 'nhl', displayName: 'NHL', sportId: 'nhl' },

  // Baseball
  { sport: 'baseball', league: 'mlb', displayName: 'MLB', sportId: 'baseball' },

  // Tennis
  { sport: 'tennis', league: 'atp', displayName: 'ATP Tour', sportId: 'tennis' },
  { sport: 'tennis', league: 'wta', displayName: 'WTA Tour', sportId: 'tennis' },

  // Sport auto
  { sport: 'racing', league: 'f1', displayName: 'Formula 1', sportId: 'formula1' },

  // Golf
  { sport: 'golf', league: 'pga', displayName: 'PGA Tour', sportId: 'golf' },

  // MMA
  { sport: 'mma', league: 'ufc', displayName: 'UFC', sportId: 'mma' },
];

interface EspnEvent {
  id: string;
  name: string;
  shortName?: string;
  date: string;
  status: {
    type: { state: string; completed: boolean; description?: string; detail?: string };
  };
  competitions: Array<{
    competitors: Array<{
      id: string;
      homeAway: 'home' | 'away';
      team?: { id: string; displayName: string; abbreviation?: string; logo?: string };
      athlete?: { id: string; displayName: string; shortName?: string };
      score?: string;
    }>;
    venue?: { fullName?: string };
    broadcasts?: Array<{ names: string[] }>;
  }>;
}

interface EspnResponse { events?: EspnEvent[] }

function makeTeam(c: EspnEvent['competitions'][0]['competitors'][0]): Team | undefined {
  if (c.team) {
    return {
      id: c.team.id,
      name: c.team.displayName,
      shortName: c.team.abbreviation,
      logoUrl: c.team.logo,
    };
  }
  if (c.athlete) {
    return { id: c.athlete.id, name: c.athlete.displayName, shortName: c.athlete.shortName };
  }
  return undefined;
}

function mapEventStatus(state: string, completed: boolean): SportEvent['status'] {
  if (completed || state === 'post') return 'finished';
  if (state === 'in') return 'live';
  return 'scheduled';
}

function mapEspnEvent(event: EspnEvent, endpoint: EspnEndpoint): SportEvent | null {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const home = comp.competitors.find((c) => c.homeAway === 'home') ?? comp.competitors[0];
  const away = comp.competitors.find((c) => c.homeAway === 'away') ?? comp.competitors[1];

  const round = event.status?.type?.detail ?? event.status?.type?.description;
  const tier = classifyEventTier({
    sportId: endpoint.sportId,
    league: endpoint.displayName,
    round,
    title: event.name,
  });

  const broadcastList: string[] = [];
  comp.broadcasts?.forEach((b) => {
    b.names?.forEach((n) => { if (n && !broadcastList.includes(n)) broadcastList.push(n); });
  });

  return {
    id: `espn-${endpoint.sport}-${endpoint.league}-${event.id}`,
    title: event.name,
    sportId: endpoint.sportId,
    category: 'sport',
    startDate: event.date,
    league: endpoint.displayName,
    tier,
    status: mapEventStatus(event.status?.type?.state ?? 'pre', event.status?.type?.completed ?? false),
    homeTeam: home ? makeTeam(home) : undefined,
    awayTeam: away ? makeTeam(away) : undefined,
    homeScore: home?.score != null ? Number(home.score) : undefined,
    awayScore: away?.score != null ? Number(away.score) : undefined,
    venue: comp.venue?.fullName,
    broadcast: broadcastList.length > 0 ? broadcastList : undefined,
    round,
    lastSyncedAt: new Date().toISOString(),
  };
}

async function fetchLeagueEvents(endpoint: EspnEndpoint, from: Date, to: Date): Promise<SportEvent[]> {
  // ESPN accepte des fenêtres de ~30 jours.
  // ⚠️ Important : on décale la fenêtre suivante de +1 jour pour éviter
  // que le dernier jour d'une fenêtre soit aussi le premier jour de la suivante,
  // ce qui provoquait des doublons dans la version précédente.
  const windows: Array<{ start: Date; end: Date }> = [];
  let cursor = new Date(from);
  while (cursor < to) {
    const end = new Date(Math.min(cursor.getTime() + 25 * 24 * 60 * 60 * 1000, to.getTime()));
    windows.push({ start: new Date(cursor), end });
    // +1 jour entier pour que la prochaine fenêtre commence après la fin
    cursor = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }

  const results: SportEvent[] = [];
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

  for (const window of windows) {
    try {
      const resp = await axios.get<EspnResponse>(PROXY_URL, {
        timeout: 15000,
        params: {
          path: `${endpoint.sport}/${endpoint.league}/scoreboard`,
          dates: `${fmt(window.start)}-${fmt(window.end)}`,
          limit: 100,
        },
      });
      const events = resp.data.events ?? [];
      events.forEach((e) => {
        const mapped = mapEspnEvent(e, endpoint);
        if (mapped) results.push(mapped);
      });
    } catch (error) {
      console.warn(`[ESPN] Erreur ${endpoint.sport}/${endpoint.league}`, error);
    }
  }

  return results;
}

export const espnProvider: SportProvider = {
  id: 'espn',
  name: 'ESPN',

  async fetchEvents({ sports, from, to }) {
    const relevant = sports
      ? ENDPOINTS.filter((e) => sports.includes(e.sportId))
      : ENDPOINTS;

    const BATCH_SIZE = 4;
    const allEvents: SportEvent[] = [];

    for (let i = 0; i < relevant.length; i += BATCH_SIZE) {
      const batch = relevant.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map((ep) => fetchLeagueEvents(ep, from, to)));
      results.forEach((events) => allEvents.push(...events));
    }

    return allEvents;
  },
};
