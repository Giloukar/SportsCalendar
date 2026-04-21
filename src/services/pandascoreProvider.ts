import axios from 'axios';
import {
  SportEvent,
  SportId,
  SportCategory,
  SportProvider,
  Team,
} from '@app-types/index';
import { classifyEventTier } from '@utils/tierClassifier';

/**
 * Provider PandaScore : source unique pour les esports.
 *
 * ─── Remplace Liquipedia ───
 *   Liquipedia bloque systématiquement les requêtes Netlify (User-Agent
 *   filtering + parsing HTML fragile). PandaScore offre une vraie API
 *   REST avec plan gratuit (1000 req/h).
 *
 * ─── Configuration requise côté Netlify ───
 *   Site configuration → Environment variables → PANDASCORE_API_KEY
 *   Obtenir une clé gratuite : https://pandascore.co (2 minutes)
 *
 * ─── Games supportés ───
 *   csgo (CS2), lol, dota2, valorant, r6siege, overwatch, pubg, rl,
 *   sc2, kog, cod, fifa
 *   Non supportés (renvoie vide) : mobilelegends, pubgmobile, freefire
 */

const PROXY_URL = '/.netlify/functions/pandascore-proxy';

const SUPPORTED_GAMES: SportId[] = [
  'csgo',
  'lol',
  'dota2',
  'valorant',
  'r6siege',
  'overwatch',
  'pubg',
  'rocketleague',
  'starcraft',
  'kingofglory',
  'codblackops',
  'fifa',
];

// Raw object from our proxy
interface PandaMatch {
  id: string;
  date: string;
  timestamp: number;
  team1: string;
  team2: string;
  team1Logo?: string;
  team2Logo?: string;
  tournament: string;
  format: string;
  live: boolean;
  finished: boolean;
  status: string;
  streams: string[];
  score1?: number;
  score2?: number;
}

async function fetchMatchesForGame(
  game: SportId,
  type: 'upcoming' | 'running' | 'past'
): Promise<PandaMatch[]> {
  try {
    const response = await axios.get(`${PROXY_URL}?game=${game}&type=${type}`, {
      timeout: 12_000,
    });
    const matches = response.data?.matches;
    if (!Array.isArray(matches)) return [];
    return matches;
  } catch (e: any) {
    console.warn(`[PandaScore] ${game} ${type} error`, e?.message ?? e);
    return [];
  }
}

function makeTeam(name: string, logoUrl?: string): Team {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    logoUrl,
  };
}

function mapStatus(m: PandaMatch): SportEvent['status'] {
  if (m.live || m.status === 'running') return 'live';
  if (m.finished || m.status === 'finished') return 'finished';
  if (m.status === 'canceled' || m.status === 'cancelled') return 'cancelled';
  if (m.status === 'postponed') return 'postponed';
  return 'scheduled';
}

function convertToSportEvent(m: PandaMatch, sportId: SportId): SportEvent {
  const title = `${m.team1} vs ${m.team2}`;
  const homeTeam = makeTeam(m.team1, m.team1Logo);
  const awayTeam = makeTeam(m.team2, m.team2Logo);

  const event: SportEvent = {
    id: m.id,
    title,
    sportId,
    category: 'esport' as SportCategory,
    startDate: m.date,
    league: m.tournament,
    round: m.format || undefined,
    tier: classifyEventTier({
      sportId,
      league: m.tournament,
      round: m.format,
      title,
    }),
    status: mapStatus(m),
    homeTeam,
    awayTeam,
    broadcast: m.streams.length > 0 ? m.streams : undefined,
    externalUrls: m.streams.length > 0
      ? m.streams.slice(0, 3).map((url, i) => ({
          label: `Stream ${i + 1}`,
          url,
        }))
      : undefined,
    lastSyncedAt: new Date().toISOString(),
  };

  if (m.score1 !== undefined) event.homeScore = m.score1;
  if (m.score2 !== undefined) event.awayScore = m.score2;

  return event;
}

export const pandascoreProvider: SportProvider = {
  id: 'pandascore',
  name: 'PandaScore',

  async fetchEvents(options: {
    from: Date;
    to: Date;
    sports?: SportId[];
  }): Promise<SportEvent[]> {
    const sports = options.sports ?? [];
    const supported = sports.filter((s) => SUPPORTED_GAMES.includes(s));
    if (supported.length === 0) return [];

    // Lance en parallèle : upcoming + running pour chaque game
    // (on ne prend pas "past" pour limiter les appels)
    const allRequests = supported.flatMap((game) => [
      fetchMatchesForGame(game, 'upcoming').then((ms) =>
        ms.map((m) => ({ m, sport: game }))
      ),
      fetchMatchesForGame(game, 'running').then((ms) =>
        ms.map((m) => ({ m, sport: game }))
      ),
    ]);

    const settled = await Promise.allSettled(allRequests);
    const events: SportEvent[] = [];

    const fromTs = options.from.getTime();
    const toTs = options.to.getTime();

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        for (const { m, sport } of result.value) {
          const event = convertToSportEvent(m, sport);
          const ts = new Date(event.startDate).getTime();
          if (ts >= fromTs && ts <= toTs) {
            events.push(event);
          }
        }
      }
    }

    return events;
  },
};
