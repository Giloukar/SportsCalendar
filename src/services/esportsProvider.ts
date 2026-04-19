import axios from 'axios';
import { SportEvent, SportId, SportProvider } from '@app-types/index';
import { classifyEventTier } from '@utils/tierClassifier';

/**
 * Provider PandaScore via la Netlify Function `pandascore-proxy`.
 *
 * 🔑 Pour activer les esports :
 *   1. Créez un compte gratuit sur https://pandascore.co
 *   2. Copiez votre API Token depuis le dashboard
 *   3. Sur Netlify : Site configuration → Environment variables →
 *      Ajouter la clé `PANDASCORE_API_KEY` avec votre token
 *   4. Redéployez (Deploys → Trigger deploy)
 *
 * Sans cette variable d'environnement, les esports restent inactifs
 * mais l'app continue de fonctionner pour les sports traditionnels.
 */

const PROXY_URL = '/.netlify/functions/pandascore-proxy';

const ESPORT_MAP: Partial<Record<SportId, string>> = {
  lol: 'lol',
  valorant: 'valorant',
  csgo: 'csgo', // PandaScore a migré csgo → cs2 sous le même endpoint
  dota2: 'dota2',
  rocketleague: 'rl',
  overwatch: 'ow',
  fifa: 'fifa',
  starcraft: 'sc2',
  r6siege: 'r6siege',
  mobilelegends: 'mlbb',
  pubg: 'pubg',
  kingofglory: 'kog',
  codblackops: 'codmw',
  pubgmobile: 'pubgmobile',
  freefire: 'freefire',
};

interface PandaOpponent {
  id: number;
  name: string;
  acronym?: string;
  image_url?: string;
}

interface PandaStream {
  language: string;
  raw_url: string;
  main?: boolean;
}

interface PandaMatch {
  id: number;
  name: string;
  begin_at: string | null;
  end_at: string | null;
  scheduled_at?: string | null;
  status: string;
  league: { id: number; name: string; image_url?: string };
  serie?: { full_name?: string };
  tournament?: { name?: string };
  opponents: Array<{ type: string; opponent: PandaOpponent }>;
  results?: Array<{ score: number; team_id: number }>;
  streams_list?: PandaStream[];
}

function detectPlatform(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('twitch')) return 'Twitch';
  if (lower.includes('youtube') || lower.includes('youtu.be')) return 'YouTube';
  if (lower.includes('afreeca')) return 'AfreecaTV';
  if (lower.includes('huya')) return 'Huya';
  if (lower.includes('douyu')) return 'Douyu';
  if (lower.includes('kick.com')) return 'Kick';
  if (lower.includes('trovo')) return 'Trovo';
  return 'Stream';
}

function mapPandaMatch(match: PandaMatch, sportId: SportId): SportEvent | null {
  const startDate = match.begin_at ?? match.scheduled_at;
  if (!startDate) return null;

  const home = match.opponents[0]?.opponent;
  const away = match.opponents[1]?.opponent;
  const leagueName = match.league?.name ?? 'Unknown';
  const round = match.tournament?.name ?? match.serie?.full_name ?? undefined;

  const tier = classifyEventTier({ sportId, league: leagueName, round, title: match.name });

  const status: SportEvent['status'] =
    match.status === 'running' ? 'live'
    : match.status === 'finished' ? 'finished'
    : match.status === 'canceled' ? 'cancelled'
    : match.status === 'postponed' ? 'postponed'
    : 'scheduled';

  // Streams : tri par pertinence (main → fr → en → autres)
  const broadcastList: string[] = [];
  const externalUrls: Array<{ label: string; url: string }> = [];

  if (match.streams_list && match.streams_list.length > 0) {
    const sorted = [...match.streams_list].sort((a, b) => {
      if (a.main && !b.main) return -1;
      if (!a.main && b.main) return 1;
      if (a.language === 'fr' && b.language !== 'fr') return -1;
      if (b.language === 'fr' && a.language !== 'fr') return 1;
      if (a.language === 'en' && b.language !== 'en') return -1;
      if (b.language === 'en' && a.language !== 'en') return 1;
      return 0;
    });
    sorted.forEach((s) => {
      if (s.raw_url) {
        broadcastList.push(s.raw_url);
        const platform = detectPlatform(s.raw_url);
        externalUrls.push({
          label: `${platform}${s.language ? ` (${s.language.toUpperCase()})` : ''}`,
          url: s.raw_url,
        });
      }
    });
  }

  return {
    id: `panda-${match.id}`,
    title: match.name,
    sportId,
    category: 'esport',
    startDate: new Date(startDate).toISOString(),
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
    broadcast: broadcastList.length > 0 ? broadcastList : undefined,
    externalUrls: externalUrls.length > 0 ? externalUrls : undefined,
    lastSyncedAt: new Date().toISOString(),
  };
}

export const esportsProvider: SportProvider = {
  id: 'pandascore',
  name: 'PandaScore',

  async fetchEvents({ sports, from, to }) {
    const sportIds = (sports ?? Object.keys(ESPORT_MAP)) as SportId[];
    const results: SportEvent[] = [];

    for (const sportId of sportIds) {
      const slug = ESPORT_MAP[sportId];
      if (!slug) continue;

      try {
        const resp = await axios.get<PandaMatch[] | []>(PROXY_URL, {
          timeout: 15000,
          params: {
            path: `${slug}/matches`,
            'range[begin_at]': `${from.toISOString()},${to.toISOString()}`,
            per_page: 100,
            sort: 'begin_at',
          },
        });

        if (!Array.isArray(resp.data)) continue;
        resp.data.forEach((match) => {
          const mapped = mapPandaMatch(match, sportId);
          if (mapped) results.push(mapped);
        });
      } catch (error: any) {
        console.warn(`[PandaScore] Erreur sur ${sportId}`, error?.message ?? error);
      }
    }

    return results;
  },
};
