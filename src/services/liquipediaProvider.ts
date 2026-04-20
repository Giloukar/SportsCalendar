import axios from 'axios';
import { SportEvent, SportId, SportProvider } from '@app-types/index';
import { classifyEventTier } from '@utils/tierClassifier';

/**
 * Provider Liquipedia : unique source esport de l'application.
 *
 * ─── Stratégie d'appel ───
 * Liquipedia limite action=parse à 1 req / 30s par wiki. Mon serveur
 * Netlify applique ce rate-limit + cache 25 min, donc côté client on
 * peut enchaîner les wikis en série SANS délai supplémentaire : si
 * un wiki est en cache sur Netlify, il répond en 50ms.
 *
 * Par contre, sur le premier appel à froid d'un wiki non-caché, ça
 * prendra ~1-3 secondes de latence réseau. On exécute donc les
 * wikis en SÉRIE pour permettre au cache de se construire sans
 * bloquer l'UI trop longtemps.
 */

const PROXY_URL = '/.netlify/functions/liquipedia-proxy';

const WIKI_MAP: Record<SportId, string | undefined> = {
  // Sports traditionnels : non couverts par Liquipedia esport
  football: undefined, basketball: undefined, tennis: undefined, rugby: undefined,
  formula1: undefined, motogp: undefined, handball: undefined, badminton: undefined,
  volleyball: undefined, baseball: undefined, golf: undefined, boxing: undefined,
  mma: undefined, cycling: undefined, athletics: undefined, nfl: undefined, nhl: undefined,

  // Esports → slug Liquipedia
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

interface LiquipediaResponse {
  matches: LiquipediaMatch[];
  cached?: boolean;
  stale?: boolean;
  age?: number;
  error?: string;
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
  if (lower.includes('bilibili')) return 'Bilibili';
  return 'Stream';
}

function guessLanguage(url: string): string | undefined {
  const l = url.toLowerCase();
  if (/[_/-](fr|french|france)([_/-]|$)/.test(l)) return 'fr';
  if (/karmine|kamto|solary|vitality|gentlemates/i.test(l)) return 'fr'; // orgas FR
  if (/[_/-](en|english|eng)([_/-]|$)/.test(l)) return 'en';
  if (/[_/-](de|ger|german|deu)([_/-]|$)/.test(l)) return 'de';
  if (/[_/-](es|spanish|espanol)([_/-]|$)/.test(l)) return 'es';
  if (/[_/-](pt|br|portuguese|brazilian)([_/-]|$)/.test(l)) return 'pt';
  if (/[_/-](ru|russian)([_/-]|$)/.test(l)) return 'ru';
  if (/[_/-](ko|kr|korean)([_/-]|$)/.test(l)) return 'ko';
  if (/[_/-](jp|ja|japanese)([_/-]|$)/.test(l)) return 'ja';
  return undefined;
}

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

    // Dédup wikis
    const sportBySlug = new Map<string, SportId>();
    sportIds.forEach((id) => {
      const w = WIKI_MAP[id];
      if (w && !sportBySlug.has(w)) sportBySlug.set(w, id);
    });
    const wikis = Array.from(sportBySlug.keys());

    const results: SportEvent[] = [];

    // Appels en série. Grâce au cache Netlify (25 min), la plupart
    // des wikis répondent instantanément. Seul le premier accès à froid
    // d'un wiki prend ~2s.
    for (const wiki of wikis) {
      try {
        const resp = await axios.get<LiquipediaResponse>(PROXY_URL, {
          params: { wiki },
          timeout: 20000,
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

        // Log utile pour le diagnostic
        if (resp.data?.cached) {
          console.info(`[Liquipedia] ${wiki}: ${matches.length} matches (cached ${resp.data.age}s ago)`);
        } else {
          console.info(`[Liquipedia] ${wiki}: ${matches.length} matches (fresh)`);
        }
      } catch (error: any) {
        console.warn(`[Liquipedia] ${wiki} failed:`, error?.response?.data ?? error?.message);
      }
    }

    return results;
  },
};
