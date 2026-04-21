/**
 * Netlify Function : proxy robuste pour Liquipedia API.
 *
 * ─── Fix v8.2 ───
 *   1. User-Agent conforme aux Terms of Use Liquipedia : pas de "Node.js"
 *      ni "node-fetch" (explicitement bloqués).
 *   2. Mode debug (query param &debug=1) qui renvoie des infos détaillées
 *      sur ce qui se passe, pour diagnostiquer dans l'écran Diagnostic.
 *   3. Gestion explicite des 403/429/5xx avec messages compréhensibles.
 *   4. Cache mémoire + respect du rate-limit 30s entre action=parse.
 *
 * ─── User-Agent ───
 *   Format recommandé Liquipedia :
 *     "ApplicationName/Version (URL; email@example.com)"
 *   Le simple fait d'ajouter "Node.js" à la fin suffit à être bloqué.
 */

// User-Agent conforme aux guidelines Liquipedia
const USER_AGENT = 'SportCalendarPWA/2.1 (https://github.com/Giloukar/SportsCalendar; sportcal.contact@gmail.com)';

// Cache en mémoire partagé entre invocations chaudes
const cache = new Map();
const CACHE_TTL_MS = 25 * 60 * 1000; // 25 min

// Rate-limit 30s strict imposé par Liquipedia pour action=parse
const lastFetchAt = new Map();
const MIN_DELAY_MS = 30 * 1000;

exports.handler = async function handler(event) {
  const params = event.queryStringParameters || {};
  const wiki = params.wiki;
  const forceRefresh = params.force === '1';
  const debug = params.debug === '1';

  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: responseHeaders, body: '' };
  }

  if (!wiki) {
    return {
      statusCode: 400,
      headers: responseHeaders,
      body: JSON.stringify({ error: 'Paramètre "wiki" manquant', matches: [] }),
    };
  }

  // Cache hit
  const cached = cache.get(wiki);
  if (cached && !forceRefresh && Date.now() - cached.time < CACHE_TTL_MS) {
    return {
      statusCode: 200,
      headers: { ...responseHeaders, 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify({
        matches: cached.data,
        cached: true,
        age: Math.round((Date.now() - cached.time) / 1000),
        ...(debug ? { debug: cached.debug } : {}),
      }),
    };
  }

  // Rate-limit interne
  const lastAt = lastFetchAt.get(wiki) || 0;
  const elapsed = Date.now() - lastAt;
  if (elapsed < MIN_DELAY_MS && cached) {
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify({
        matches: cached.data,
        cached: true,
        stale: true,
        reason: `Rate-limit : ${Math.round((MIN_DELAY_MS - elapsed) / 1000)}s à attendre`,
      }),
    };
  }

  try {
    lastFetchAt.set(wiki, Date.now());
    const result = await fetchWikiMatches(wiki);

    cache.set(wiki, {
      time: Date.now(),
      data: result.matches,
      debug: result.debug,
    });

    return {
      statusCode: 200,
      headers: { ...responseHeaders, 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify({
        matches: result.matches,
        cached: false,
        ...(debug ? { debug: result.debug } : {}),
      }),
    };
  } catch (error) {
    const errMsg = String(error && error.message ? error.message : error);

    // Sur erreur, renvoyer le cache même périmé si disponible
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
      body: JSON.stringify({
        error: errMsg,
        matches: [],
      }),
    };
  }
};

async function fetchWikiMatches(wiki) {
  const url = `https://liquipedia.net/${wiki}/api.php?action=parse&page=Liquipedia:Matches&format=json&prop=text`;

  const debug = {
    url,
    userAgent: USER_AGENT,
  };

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
  });

  debug.status = response.status;
  debug.statusText = response.statusText;

  if (!response.ok) {
    // Erreurs spécifiques avec messages humains
    if (response.status === 403) {
      throw new Error(`HTTP 403 Forbidden - Liquipedia a refusé l'accès. User-Agent possiblement bloqué. (${USER_AGENT})`);
    }
    if (response.status === 429) {
      throw new Error(`HTTP 429 Too Many Requests - Rate-limit dépassé. Attendez 30 secondes.`);
    }
    if (response.status >= 500) {
      throw new Error(`HTTP ${response.status} - Liquipedia est momentanément indisponible`);
    }
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  debug.hasError = !!data.error;

  if (data.error) {
    debug.apiError = data.error;
    throw new Error(`Liquipedia API error : ${data.error.info || data.error.code}`);
  }

  const html = data?.parse?.text?.['*'];
  if (!html) {
    throw new Error('Pas de HTML dans la réponse Liquipedia');
  }

  debug.htmlLength = html.length;
  debug.htmlPreview = html.substring(0, 300);

  const matches = parseMatchesHtml(html, wiki);
  debug.matchesFound = matches.length;

  return { matches, debug };
}

/**
 * Parser HTML Liquipedia : structure avec infobox_matches_content
 */
function parseMatchesHtml(html, wiki) {
  const matches = [];
  const tableRegex = /<table[^>]*class="[^"]*\binfobox_matches(?:_content)?\b[^"]*"[^>]*>([\s\S]*?)<\/table>/g;

  let m;
  let idCounter = 0;
  while ((m = tableRegex.exec(html)) !== null) {
    idCounter++;
    const block = m[1];

    const tsMatch = block.match(/data-timestamp="(\d+)"/);
    if (!tsMatch) continue;
    const timestamp = parseInt(tsMatch[1], 10) * 1000;
    if (isNaN(timestamp) || timestamp < Date.now() - 7 * 24 * 3600 * 1000) continue;
    const dateIso = new Date(timestamp).toISOString();

    const teams = extractTeams(block);
    if (teams.length < 2) continue;

    let format = '';
    const fmtMatch = block.match(/<abbr[^>]*title="[^"]*"[^>]*>\s*(B[oO]\s*\d+)\s*<\/abbr>/);
    if (fmtMatch) {
      format = fmtMatch[1].toUpperCase().replace(/\s+/g, '');
    } else {
      const versusMatch = block.match(/<td[^>]*class="versus"[^>]*>([\s\S]*?)<\/td>/);
      if (versusMatch) {
        const versusText = versusMatch[1].replace(/<[^>]+>/g, '').trim();
        const bo = versusText.match(/B[oO]\s*\d+/);
        if (bo) format = bo[0].toUpperCase().replace(/\s+/g, '');
      }
    }

    let tournament = '';
    const fillerMatch = block.match(/<tr[^>]*class="[^"]*match-filler[^"]*"[^>]*>([\s\S]*?)<\/tr>/);
    if (fillerMatch) {
      const linkMatch = fillerMatch[1].match(/<a[^>]*title="([^"]+)"/);
      if (linkMatch) tournament = decodeHtml(linkMatch[1]);
    }
    if (!tournament) {
      const anyLink = block.match(/<a[^>]*title="([^"]+)"[^>]*>/);
      if (anyLink) tournament = decodeHtml(anyLink[1]);
    }

    const streamUrls = [];
    const streamRegex = /href="(https?:\/\/(?:www\.)?(?:twitch\.tv|youtube\.com|youtu\.be|kick\.com|afreecatv\.com|huya\.com|trovo\.live|nimo\.tv|bilibili\.com)\/[^"]+)"/g;
    let sm;
    while ((sm = streamRegex.exec(block)) !== null) {
      const url = sm[1];
      if (!streamUrls.includes(url)) streamUrls.push(url);
    }

    const isLive =
      (/\blive\b/i.test(block) && !/finished/i.test(block)) ||
      (timestamp <= Date.now() && timestamp > Date.now() - 5 * 3600 * 1000);

    matches.push({
      id: `liqui-${wiki}-${timestamp}-${idCounter}`,
      date: dateIso,
      timestamp,
      team1: teams[0],
      team2: teams[1],
      tournament: tournament || 'Unknown Tournament',
      format,
      live: isLive,
      streams: streamUrls,
      wiki,
    });
  }

  return matches;
}

function extractTeams(block) {
  const teams = [];
  const strat1 = /<span[^>]*class="[^"]*\bteam-template-text\b[^"]*"[^>]*>([\s\S]*?)<\/span>/g;
  let m;
  while ((m = strat1.exec(block)) !== null && teams.length < 2) {
    const name = m[1].replace(/<[^>]+>/g, '').trim();
    if (name) teams.push(decodeHtml(name));
  }
  if (teams.length >= 2) return teams.slice(0, 2);

  const strat2a = /<td[^>]*class="[^"]*\bteam-left[^"]*"[^>]*>([\s\S]*?)<\/td>/;
  const strat2b = /<td[^>]*class="[^"]*\bteam-right[^"]*"[^>]*>([\s\S]*?)<\/td>/;
  const leftMatch = block.match(strat2a);
  const rightMatch = block.match(strat2b);
  if (leftMatch && rightMatch) {
    const left = leftMatch[1].replace(/<[^>]+>/g, '').trim();
    const right = rightMatch[1].replace(/<[^>]+>/g, '').trim();
    if (left) teams.push(decodeHtml(left));
    if (right) teams.push(decodeHtml(right));
  }
  if (teams.length >= 2) return teams.slice(0, 2);

  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
  let td;
  let count = 0;
  while ((td = tdRegex.exec(block)) !== null && count < 4 && teams.length < 2) {
    count++;
    const linkMatch = td[1].match(/<a[^>]*title="([^"]+)"/);
    if (linkMatch) {
      const name = decodeHtml(linkMatch[1]);
      if (!/liquipedia|wiki|main page|matches/i.test(name)) {
        teams.push(name);
      }
    }
  }

  return teams.slice(0, 2);
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&rsquo;/g, "'")
    .trim();
}
