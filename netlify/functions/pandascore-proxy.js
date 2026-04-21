/**
 * Netlify Function : proxy PandaScore API pour les esports.
 *
 * ─── Remplace le scraper Liquipedia ───
 *   Liquipedia bloque les requêtes serveur depuis Netlify (User-Agent
 *   filtering strict + parsing HTML fragile). PandaScore offre une vraie
 *   API REST documentée avec un plan gratuit généreux (1000 req/h).
 *
 * ─── Configuration requise ───
 *   Variable d'environnement Netlify : PANDASCORE_API_KEY
 *   Obtenir une clé : https://pandascore.co (inscription gratuite)
 *   Plan gratuit : "Schedules, Results & Context Data"
 *
 * ─── Paramètres de l'API ───
 *   GET /?game=lol&type=upcoming
 *   GET /?game=csgo&type=running
 *   GET /?game=valorant&type=past
 *
 * ─── Games supportés ───
 *   lol, csgo (CS2), dota2, valorant, r6siege, overwatch, pubg, rocketleague,
 *   starcraft2, kingofglory, codmw, fifa, mtg
 */

// Cache mémoire 2 min pour réduire les appels API
const cache = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000;

// Map des SportId de SportCal vers les slugs PandaScore
const GAME_MAP = {
  lol: 'lol',
  csgo: 'csgo',
  dota2: 'dota2',
  valorant: 'valorant',
  r6siege: 'r6siege',
  overwatch: 'ow',
  pubg: 'pubg',
  rocketleague: 'rl',
  starcraft: 'sc2',
  kingofglory: 'kog',
  codblackops: 'cod',
  fifa: 'fifa',
  // Non supportés par PandaScore (fallback à vide) :
  // mobilelegends, pubgmobile, freefire
};

exports.handler = async function handler(event) {
  const params = event.queryStringParameters || {};
  const game = params.game;
  const type = params.type || 'upcoming'; // upcoming | running | past
  const forceRefresh = params.force === '1';

  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: responseHeaders, body: '' };
  }

  const apiKey = process.env.PANDASCORE_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({
        error: 'PANDASCORE_API_KEY non configurée sur Netlify',
        matches: [],
        help: 'Site configuration → Environment variables → ajouter PANDASCORE_API_KEY',
      }),
    };
  }

  if (!game || !GAME_MAP[game]) {
    return {
      statusCode: 400,
      headers: responseHeaders,
      body: JSON.stringify({
        error: `Game "${game}" non supporté par PandaScore`,
        matches: [],
        supported: Object.keys(GAME_MAP),
      }),
    };
  }

  const cacheKey = `${game}:${type}`;

  // Cache hit
  const cached = cache.get(cacheKey);
  if (cached && !forceRefresh && Date.now() - cached.time < CACHE_TTL_MS) {
    return {
      statusCode: 200,
      headers: { ...responseHeaders, 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify({
        matches: cached.data,
        cached: true,
        age: Math.round((Date.now() - cached.time) / 1000),
      }),
    };
  }

  const pandaSlug = GAME_MAP[game];
  // /{game}/matches/{type} → renvoie matches avec opponents, league, streams_list
  const url = `https://api.pandascore.co/${pandaSlug}/matches/${type}?per_page=50&sort=begin_at`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new Error('Clé API PandaScore invalide ou expirée');
      }
      if (response.status === 429) {
        throw new Error('Rate-limit PandaScore atteint (1000 req/h). Réessayez plus tard.');
      }
      throw new Error(`HTTP ${response.status} ${response.statusText} ${body.slice(0, 100)}`);
    }

    const raw = await response.json();
    const matches = parseMatches(raw, game);

    cache.set(cacheKey, { time: Date.now(), data: matches });

    return {
      statusCode: 200,
      headers: { ...responseHeaders, 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify({
        matches,
        cached: false,
        rateLimitRemaining: response.headers.get('x-rate-limit-remaining'),
      }),
    };
  } catch (error) {
    const errMsg = String(error && error.message ? error.message : error);

    // Fallback cache périmé
    if (cached) {
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          matches: cached.data,
          cached: true,
          stale: true,
          error: errMsg,
        }),
      };
    }

    return {
      statusCode: 502,
      headers: responseHeaders,
      body: JSON.stringify({ error: errMsg, matches: [] }),
    };
  }
};

/**
 * Convertit la réponse PandaScore au format SportEvent de SportCal.
 */
function parseMatches(rawMatches, game) {
  if (!Array.isArray(rawMatches)) return [];

  return rawMatches
    .filter((m) => m.begin_at && m.opponents && m.opponents.length >= 2)
    .map((m) => {
      const opp1 = m.opponents[0]?.opponent;
      const opp2 = m.opponents[1]?.opponent;
      const team1 = opp1?.name || opp1?.acronym || 'TBD';
      const team2 = opp2?.name || opp2?.acronym || 'TBD';

      const tournament = m.tournament?.name || m.league?.name || 'Unknown';
      const format = m.number_of_games ? `BO${m.number_of_games}` : '';

      const streams = Array.isArray(m.streams_list)
        ? m.streams_list.filter((s) => s && s.raw_url).map((s) => s.raw_url)
        : [];

      // Status : not_started → upcoming, running → live, finished → past
      const status = m.status || 'not_started';
      const live = status === 'running';
      const finished = status === 'finished';

      return {
        id: `panda-${game}-${m.id}`,
        date: m.begin_at,
        timestamp: new Date(m.begin_at).getTime(),
        team1,
        team2,
        team1Logo: opp1?.image_url || undefined,
        team2Logo: opp2?.image_url || undefined,
        tournament,
        format,
        live,
        finished,
        status,
        streams,
        wiki: game,
        // Scores pour les matches finis/live
        score1: m.results?.[0]?.score ?? undefined,
        score2: m.results?.[1]?.score ?? undefined,
      };
    });
}
