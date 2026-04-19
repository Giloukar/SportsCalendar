import axios from 'axios';
import { SportEvent, SportProvider } from '@app-types/index';
import { classifyEventTier } from '@utils/tierClassifier';

/**
 * Provider HLTV : scrape hltv.org/matches via une Netlify Function.
 * Complète PandaScore pour CS2 : HLTV couvre tous les tournois
 * avec leur système d'étoiles pour la hiérarchie d'importance.
 *
 * Système d'étoiles HLTV :
 *  - 5 étoiles : match majeur (finale Major, S-Tier)
 *  - 4 étoiles : gros match
 *  - 3 étoiles : important
 *  - 1-2 étoiles : mineur
 *  - 0 étoile : régulier
 *
 * Nous mappons ces étoiles sur notre système de tiers :
 *  - 5 étoiles → Tier S
 *  - 4 étoiles → Tier A
 *  - 2-3 étoiles → Tier B
 *  - 0-1 étoile → Tier C
 */

const PROXY_URL = '/.netlify/functions/hltv-proxy';

interface HltvMatch {
  id: string;
  date: string;
  timestamp: number;
  team1: string;
  team2: string;
  event: string;
  format: string;
  stars: number;
  live: boolean;
  url: string;
}

function starsToTier(stars: number): SportEvent['tier'] {
  if (stars >= 5) return 'S';
  if (stars >= 4) return 'A';
  if (stars >= 2) return 'B';
  return 'C';
}

function mapHltvMatch(match: HltvMatch): SportEvent {
  // Détection round à partir du nom d'événement
  const eventLower = match.event.toLowerCase();
  let round: string | undefined;
  if (eventLower.includes('final') || eventLower.includes('grand final')) round = 'Grand Final';
  else if (eventLower.includes('semi')) round = 'Semi-Final';
  else if (eventLower.includes('quarter')) round = 'Quarter-Final';
  else if (eventLower.includes('playoff')) round = 'Playoff';

  // Classification tier : on combine stars HLTV + règles de notre classifier.
  // Si le nom du tournoi est dans notre liste Tier S, on force S.
  const starsTier = starsToTier(match.stars);
  const classifiedTier = classifyEventTier({
    sportId: 'csgo',
    league: match.event,
    round,
    title: `${match.team1} vs ${match.team2}`,
  });

  // Priorité au tier le plus important entre étoiles HLTV et classifier
  const tierOrder: Record<SportEvent['tier'], number> = { S: 0, A: 1, B: 2, C: 3 };
  const tier = tierOrder[starsTier] < tierOrder[classifiedTier] ? starsTier : classifiedTier;

  return {
    id: `hltv-${match.id}`,
    title: `${match.team1} vs ${match.team2}`,
    sportId: 'csgo',
    category: 'esport',
    startDate: match.date,
    league: match.event,
    tier,
    status: match.live ? 'live' : 'scheduled',
    homeTeam: { id: match.team1, name: match.team1 },
    awayTeam: { id: match.team2, name: match.team2 },
    round: match.format ? `${round ?? ''} ${match.format}`.trim() : round,
    externalUrls: [{ label: 'HLTV', url: match.url }],
    lastSyncedAt: new Date().toISOString(),
  };
}

export const hltvProvider: SportProvider = {
  id: 'hltv',
  name: 'HLTV.org',

  async fetchEvents({ sports, from, to }) {
    // Si CS2 n'est pas demandé, on saute ce provider
    if (sports && !sports.includes('csgo')) return [];

    try {
      const resp = await axios.get<{ matches: HltvMatch[] }>(PROXY_URL, { timeout: 15000 });
      const matches = resp.data?.matches ?? [];

      return matches
        .filter((m) => {
          const d = new Date(m.date);
          return d >= from && d <= to;
        })
        .map(mapHltvMatch);
    } catch (error: any) {
      console.warn('[HLTV] Erreur', error?.message ?? error);
      return [];
    }
  },
};
