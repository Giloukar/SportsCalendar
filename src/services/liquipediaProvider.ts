import axios from 'axios';
import { SportEvent, SportId, SportProvider } from '@app-types/index';
import { classifyEventTier } from '@utils/tierClassifier';

/**
 * Provider Liquipedia : couvre tous les grands esports grâce au scraping
 * du wiki MediaWiki public. Complète PandaScore (notamment pour les
 * tournois tier S que PandaScore peut manquer).
 *
 * Wikis Liquipedia utilisés :
 *   - counterstrike (CS2)
 *   - leagueoflegends (LoL)
 *   - dota2 (Dota 2)
 *   - valorant (Valorant)
 *   - rocketleague (RL)
 *   - overwatch (OW2)
 *   - rainbowsix (R6)
 *   - starcraft2 (SC2)
 *   - pubg (PUBG)
 *   - fifa (EA FC)
 *   - callofduty (CoD)
 *   - mobilelegends (MLBB)
 *   - pubgmobile (PUBG Mobile)
 *   - honorofkings (HoK / KoG)
 *   - freefire (Free Fire)
 */

const PROXY_URL = '/.netlify/functions/liquipedia-proxy';

const WIKI_MAP: Record<SportId, string | undefined> = {
  // Traditionnels non couverts
  football: undefined, basketball: undefined, tennis: undefined, rugby: undefined,
  formula1: undefined, motogp: undefined, handball: undefined, badminton: undefined,
  volleyball: undefined, baseball: undefined, golf: undefined, boxing: undefined,
  mma: undefined, cycling: undefined, athletics: undefined, nfl: undefined, nhl: undefined,
  // Esports
  csgo: 'counterstrike',
  lol: 'leagueoflegends',
  dota2: 'dota2',
  valorant: 'valorant',
  rocketleague: 'rocketleague',
  overwatch: 'overwatch',
  r6siege: 'rainbowsix',
  starcraft: 'starcraft2',
  pubg: 'pubg',
  fifa: 'fifa',
  codblackops: 'callofduty',
  mobilelegends: 'mobilelegends',
  pubgmobile: 'pubgmobile',
  kingofglory: 'honorofkings',
  freefire: 'freefire',
};

interface LiquipediaMatch {
  id: string;
  date: string;
  timestamp: number;
  team1: string;
  team2: string;
  tournament: string;
  format: string;
  live: boolean;
  streams: string[];
  wiki: string;
}

function detectPlatform(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('twitch.tv')) return 'Twitch';
  if (lower.includes('youtube') || lower.includes('youtu.be')) return 'YouTube';
  if (lower.includes('afreeca')) return 'AfreecaTV';
  if (lower.includes('huya')) return 'Huya';
  if (lower.includes('kick.com')) return 'Kick';
  if (lower.includes('trovo')) return 'Trovo';
  if (lower.includes('nimo')) return 'NimoTV';
  return 'Stream';
}

/**
 * Tente de déduire la langue du stream à partir de l'URL
 * (utile pour l'ordre FR > EN > autres).
 */
function guessLanguage(url: string): string | undefined {
  const l = url.toLowerCase();
  if (/[_/-](fr|french|france)([_/-]|$)/.test(l)) return 'fr';
  if (/[_/-](en|english|eng)([_/-]|$)/.test(l)) return 'en';
  if (/[_/-](de|ger|german|deu)([_/-]|$)/.test(l)) return 'de';
  if (/[_/-](es|spanish|espanol)([_/-]|$)/.test(l)) return 'es';
  if (/[_/-](pt|br|portuguese|brazilian)([_/-]|$)/.test(l)) return 'pt';
  if (/[_/-](ru|russian)([_/-]|$)/.test(l)) return 'ru';
  if (/[_/-](jp|japanese)([_/-]|$)/.test(l)) return 'ja';
  if (/[_/-](kr|korean)([_/-]|$)/.test(l)) return 'ko';
  return undefined;
}

/**
 * Tri des streams : FR > EN > autres, puis alphabétique par plateforme.
 */
function sortStreams(streams: string[]): Array<{ label: string; url: string; lang?: string }> {
  return streams
    .map((url) => ({
      url,
      platform: detectPlatform(url),
      lang: guessLanguage(url),
    }))
    .sort((a, b) => {
      const langRank = (lang?: string) =>
        lang === 'fr' ? 0 : lang === 'en' ? 1 : lang ? 2 : 3;
      return langRank(a.lang) - langRank(b.lang);
    })
    .map(({ url, platform, lang }) => ({
      label: `${platform}${lang ? ` (${lang.toUpperCase()})` : ''}`,
      url,
      lang,
    }));
}

function mapLiquipediaMatch(match: LiquipediaMatch, sportId: SportId): SportEvent {
  // Classification tier via notre classifier (basé sur le nom du tournoi)
  const tier = classifyEventTier({
    sportId,
    league: match.tournament,
    title: `${match.team1} vs ${match.team2}`,
  });

  const streams = sortStreams(match.streams);
  const broadcasts = streams.map((s) => s.url);

  return {
    id: match.id,
    title: `${match.team1} vs ${match.team2}`,
    sportId,
    category: 'esport',
    startDate: match.date,
    league: match.tournament,
    tier,
    status: match.live ? 'live' : 'scheduled',
    homeTeam: { id: match.team1, name: match.team1 },
    awayTeam: { id: match.team2, name: match.team2 },
    round: match.format || undefined,
    broadcast: broadcasts.length > 0 ? broadcasts : undefined,
    externalUrls: streams.length > 0 ? streams.map((s) => ({ label: s.label, url: s.url })) : undefined,
    lastSyncedAt: new Date().toISOString(),
  };
}

export const liquipediaProvider: SportProvider = {
  id: 'liquipedia',
  name: 'Liquipedia',

  async fetchEvents({ sports, from, to }) {
    const sportIds = (sports ?? (Object.keys(WIKI_MAP) as SportId[]))
      .filter((id) => WIKI_MAP[id] !== undefined);

    if (sportIds.length === 0) return [];

    // Dédup wikis (plusieurs sportIds peuvent pointer vers le même wiki)
    const wikis = Array.from(new Set(sportIds.map((id) => WIKI_MAP[id]!).filter(Boolean)));
    const sportBySlug = new Map<string, SportId>();
    sportIds.forEach((id) => {
      const w = WIKI_MAP[id];
      if (w && !sportBySlug.has(w)) sportBySlug.set(w, id);
    });

    const results: SportEvent[] = [];

    // On fait les requêtes en série pour respecter les rate-limits Liquipedia
    for (const wiki of wikis) {
      try {
        const resp = await axios.get<{ matches: LiquipediaMatch[] }>(PROXY_URL, {
          params: { wiki },
          timeout: 15000,
        });
        const matches = resp.data?.matches ?? [];
        const sportId = sportBySlug.get(wiki);
        if (!sportId) continue;

        matches
          .filter((m) => {
            const d = new Date(m.date);
            return d >= from && d <= to;
          })
          .forEach((m) => results.push(mapLiquipediaMatch(m, sportId)));
      } catch (error: any) {
        console.warn(`[Liquipedia] Erreur ${wiki}`, error?.message ?? error);
      }
    }

    return results;
  },
};
