import axios from 'axios';
import { SportEvent } from '@app-types/index';

/**
 * Service de récupération de stats détaillées pour un événement.
 *
 * ESPN fournit un endpoint "summary" par sport/ligue/eventId qui renvoie :
 *  - boxscore (stats du match par équipe/joueur)
 *  - standings (classement de la ligue)
 *  - leaders (top joueurs)
 *  - plays (résumé du match)
 *  - lastFiveGames (forme récente)
 *  - againstTheSpread / predictor (pronostics)
 *
 * Documentation : non officielle, mais stable depuis des années.
 * Endpoint : https://site.web.api.espn.com/apis/site/v2/sports/{sport}/{league}/summary?event={id}
 *
 * On passe par la Netlify Function espn-proxy pour contourner CORS.
 */

export interface TeamForm {
  teamId: string;
  teamName: string;
  /** Résultats récents, du plus ancien au plus récent : 'W', 'L', 'T' */
  recentResults: Array<{
    result: 'W' | 'L' | 'T';
    score: string;
    date: string;
    opponent?: string;
  }>;
}

export interface StandingEntry {
  rank: number;
  team: string;
  teamId: string;
  wins: number;
  losses: number;
  ties?: number;
  points?: number;
  winPercent?: number;
}

export interface EventStats {
  standings?: StandingEntry[];
  homeForm?: TeamForm;
  awayForm?: TeamForm;
  leaders?: Array<{
    teamId: string;
    category: string;
    players: Array<{ name: string; value: string }>;
  }>;
  /** URL du match sur le site ESPN pour plus de détails */
  espnGameUrl?: string;
  /** Métadonnées supplémentaires (temps, attendance, officials...) */
  metadata?: Record<string, string>;
}

const ESPN_PROXY = '/.netlify/functions/espn-proxy';

/**
 * Récupère les stats pour un événement. Renvoie null si l'événement
 * ne provient pas d'ESPN ou si les stats ne sont pas disponibles.
 */
export async function fetchEventStats(event: SportEvent): Promise<EventStats | null> {
  // Format de l'ID pour les events ESPN : "espn-{sport}-{league}-{eventId}"
  const match = event.id.match(/^espn-([^-]+)-([^-]+(?:\.[^-]+)*)-(\d+)$/);
  if (!match) return null;

  const [, sport, league, eventId] = match;

  try {
    const resp = await axios.get<any>(ESPN_PROXY, {
      timeout: 12000,
      params: {
        path: `${sport}/${league}/summary`,
        event: eventId,
      },
    });

    const data = resp.data;
    return parseEspnSummary(data, event);
  } catch (error) {
    console.warn('[Stats] Échec ESPN summary', error);
    return null;
  }
}

function parseEspnSummary(data: any, event: SportEvent): EventStats {
  const stats: EventStats = {};

  // === Standings ===
  const standingsData = data?.standings?.groups?.[0]?.standings?.entries;
  if (Array.isArray(standingsData) && standingsData.length > 0) {
    stats.standings = standingsData
      .slice(0, 20) // max 20 équipes
      .map((entry: any, idx: number) => ({
        rank: idx + 1,
        team: entry.team?.displayName ?? 'Unknown',
        teamId: String(entry.team?.id ?? ''),
        wins: readStatFromStats(entry.stats, 'wins'),
        losses: readStatFromStats(entry.stats, 'losses'),
        ties: readStatFromStats(entry.stats, 'ties') || undefined,
        points: readStatFromStats(entry.stats, 'points') || readStatFromStats(entry.stats, 'pointsFor') || undefined,
        winPercent: readStatFromStats(entry.stats, 'winPercent') || undefined,
      }));
  }

  // === Forme récente (lastFiveGames) ===
  const lastFive = data?.lastFiveGames;
  if (Array.isArray(lastFive) && lastFive.length > 0) {
    // lastFiveGames est un array par équipe
    const homeTeamId = event.homeTeam?.id;
    const awayTeamId = event.awayTeam?.id;

    lastFive.forEach((teamBlock: any) => {
      const teamId = String(teamBlock.team?.id ?? '');
      const teamName = teamBlock.team?.displayName ?? 'Unknown';
      const events = Array.isArray(teamBlock.events) ? teamBlock.events : [];

      const form: TeamForm = {
        teamId,
        teamName,
        recentResults: events.slice(0, 5).map((e: any) => ({
          result: (e.gameResult as 'W' | 'L' | 'T') ?? 'T',
          score: e.score ?? '',
          date: e.gameDate ?? '',
          opponent: e.opponent?.displayName ?? undefined,
        })),
      };

      if (homeTeamId && teamId === homeTeamId) stats.homeForm = form;
      else if (awayTeamId && teamId === awayTeamId) stats.awayForm = form;
    });
  }

  // === Leaders du match ===
  const leaders = data?.leaders;
  if (Array.isArray(leaders)) {
    stats.leaders = leaders
      .flatMap((teamBlock: any) => {
        const teamId = String(teamBlock.team?.id ?? '');
        return (teamBlock.leaders ?? []).map((category: any) => ({
          teamId,
          category: category.displayName ?? category.name ?? '',
          players: (category.leaders ?? []).slice(0, 3).map((p: any) => ({
            name: p.athlete?.displayName ?? 'Unknown',
            value: p.displayValue ?? '',
          })),
        }));
      })
      .filter((x) => x.players.length > 0);
  }

  // === Métadonnées ===
  const header = data?.header?.competitions?.[0];
  if (header) {
    const meta: Record<string, string> = {};
    if (header.attendance) meta['Spectateurs'] = String(header.attendance);
    if (header.neutralSite) meta['Terrain neutre'] = 'Oui';
    if (header.status?.type?.detail) meta['Détails'] = header.status.type.detail;
    if (header.venue?.fullName) meta['Lieu'] = header.venue.fullName;
    const officials = header.officials?.[0]?.displayName;
    if (officials) meta['Arbitre'] = officials;

    if (Object.keys(meta).length > 0) stats.metadata = meta;
  }

  return stats;
}

function readStatFromStats(statsArr: any[], name: string): number {
  if (!Array.isArray(statsArr)) return 0;
  const entry = statsArr.find((s) => s.name === name || s.type === name);
  if (!entry) return 0;
  return Number(entry.value ?? entry.displayValue ?? 0);
}
