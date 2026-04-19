import axios, { AxiosInstance } from 'axios';
import { SportEvent, SportId, SportProvider } from '@app-types/index';
import { classifyEventTier } from '@utils/tierClassifier';

/**
 * PandaScore – API esport.
 * Documentation : https://developers.pandascore.co/
 *
 * NOTE DE CONFIGURATION :
 * Remplacer `PANDA_API_KEY` par votre clé avant la distribution.
 * En mode DEV, nous utilisons un fallback en mock si aucune clé n'est fournie.
 */
const PANDA_API_KEY: string = ''; // ⚠️ À renseigner en production
const PANDA_BASE_URL = 'https://api.pandascore.co';

const ESPORT_MAP: Partial<Record<SportId, string>> = {
  lol: 'lol',
  valorant: 'valorant',
  csgo: 'csgo',
  dota2: 'dota2',
  rocketleague: 'rl',
  overwatch: 'ow',
  fifa: 'fifa',
  starcraft: 'sc2',
};

interface PandaMatch {
  id: number;
  name: string;
  begin_at: string | null;
  end_at: string | null;
  status: string; // "not_started", "running", "finished", "canceled"
  league: { id: number; name: string };
  serie: { full_name: string };
  tournament: { name: string };
  number_of_games: number;
  videogame: { slug: string; name: string };
  opponents: Array<{
    type: string;
    opponent: { id: number; name: string; acronym?: string; image_url?: string };
  }>;
  results: Array<{ score: number; team_id: number }>;
  streams_list: Array<{ language: string; raw_url: string; main: boolean }>;
}

function buildClient(): AxiosInstance {
  return axios.create({
    baseURL: PANDA_BASE_URL,
    timeout: 15000,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${PANDA_API_KEY}`,
    },
  });
}

function mapPandaMatchToEvent(match: PandaMatch, sportId: SportId): SportEvent | null {
  if (!match.begin_at) return null;

  const home = match.opponents[0]?.opponent;
  const away = match.opponents[1]?.opponent;

  const leagueName = match.league?.name ?? 'Unknown';
  const round = match.tournament?.name ?? match.serie?.full_name ?? undefined;

  const tier = classifyEventTier({
    sportId,
    league: leagueName,
    round,
    title: match.name,
  });

  const status: SportEvent['status'] =
    match.status === 'running' ? 'live'
    : match.status === 'finished' ? 'finished'
    : match.status === 'canceled' ? 'cancelled'
    : 'scheduled';

  return {
    id: `panda-${match.id}`,
    title: match.name,
    sportId,
    category: 'esport',
    startDate: new Date(match.begin_at).toISOString(),
    endDate: match.end_at ? new Date(match.end_at).toISOString() : undefined,
    league: leagueName,
    tier,
    status,
    homeTeam: home
      ? { id: String(home.id), name: home.name, shortName: home.acronym, logoUrl: home.image_url }
      : undefined,
    awayTeam: away
      ? { id: String(away.id), name: away.name, shortName: away.acronym, logoUrl: away.image_url }
      : undefined,
    homeScore: match.results?.find((r) => r.team_id === home?.id)?.score,
    awayScore: match.results?.find((r) => r.team_id === away?.id)?.score,
    round,
    broadcast: match.streams_list?.filter((s) => s.main).map((s) => s.raw_url),
    externalUrls: match.streams_list?.map((s) => ({ label: `Stream ${s.language}`, url: s.raw_url })),
    lastSyncedAt: new Date().toISOString(),
  };
}

/**
 * Provider PandaScore pour les esports.
 * Si aucune clé n'est renseignée, renvoie une liste vide proprement
 * pour ne pas casser le reste de la synchronisation.
 */
export const esportsProvider: SportProvider = {
  id: 'pandascore',
  name: 'PandaScore',

  async fetchEvents({ sports, from, to }) {
    if (!PANDA_API_KEY) {
      console.info('[esportsProvider] Clé API manquante : esports désactivés.');
      return [];
    }

    const client = buildClient();
    const sportIds = (sports ?? Object.keys(ESPORT_MAP)) as SportId[];
    const results: SportEvent[] = [];

    for (const sportId of sportIds) {
      const slug = ESPORT_MAP[sportId];
      if (!slug) continue;

      try {
        const resp = await client.get<PandaMatch[]>(`/${slug}/matches`, {
          params: {
            'range[begin_at]': `${from.toISOString()},${to.toISOString()}`,
            per_page: 100,
            sort: 'begin_at',
          },
        });

        resp.data.forEach((match) => {
          const mapped = mapPandaMatchToEvent(match, sportId);
          if (mapped) results.push(mapped);
        });
      } catch (error) {
        console.warn(`[esportsProvider] Erreur sur ${sportId}`, error);
      }
    }

    return results;
  },
};
