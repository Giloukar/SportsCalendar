/**
 * Netlify Function : proxy robuste pour Liquipedia.
 *
 * ─── Problème des versions précédentes ───
 * L'API action=parse de Liquipedia a un rate-limit strict de 1 req / 30s.
 * En lançant plusieurs wikis en parallèle, je déclenchais les 429 / 403.
 *
 * ─── Nouvelle approche ───
 * 1. Cache mémoire longue durée par wiki (25 min, car la page Matches ne
 *    change pas aussi souvent).
 * 2. Une Function ne peut servir qu'un wiki à la fois. Si un wiki n'est
 *    pas en cache, on vérifie le rate-limit interne avant d'appeler.
 * 3. User-Agent très explicite conformément aux guidelines Liquipedia.
 * 4. Parser HTML tolérant avec plusieurs stratégies de fallback.
 *
 * NB : le cache mémoire d'une Netlify Function est partagé entre
 * invocations chaudes (même conteneur). En cold start, il est vide et
 * la première requête fait un appel réseau.
 */

// Guidelines Liquipedia : User-Agent doit contenir un email de contact
const USER_AGENT = 'SportCalendarPWA/2.0 (https://github.com/Giloukar/SportsCalendar; sportcal.contact@gmail.com) Node.js';

// Cache en mémoire : { wiki: { time: ms, data: Match[] } }
const cache = new Map();
const CACHE_TTL_MS = 25 * 60 * 1000; // 25 min

// Rate-limit intrinsèque : Liquipedia impose 30s min entre action=parse
const lastFetchAt = new Map(); // wiki → timestamp du dernier appel
const MIN_DELAY_MS = 30 * 1000;

exports.handler = async function handler(event) {
  const params = event.queryStringParameters || {};
  const wiki = params.wiki;
  const forceRefresh = params.force === '1';

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

  // ── Cache hit ──
  const cached = cache.get(wiki);
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

  // ── Rate-limit interne ──
  const lastAt = lastFetchAt.get(wiki) || 0;
  const elapsed = Date.now() - lastAt;
  if (elapsed < MIN_DELAY_MS && cached) {
    // On renvoie le cache même expiré plutôt que de dépasser le rate-limit
    return {
      statusCode: 200,
      headers: { ...responseHeaders, 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify({
        matches: cached.data,
        cached: true,
        stale: true,
        age: Math.round((Date.now() - cached.time) / 1000),
      }),
    };
  }

  try {
    lastFetchAt.set(wiki, Date.now());
    const matches = await fetchWikiMatches(wiki);

    cache.set(wiki, { time: Date.now(), data: matches });

    return {
      statusCode: 200,
      headers: { ...responseHeaders, 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify({ matches, cached: false }),
    };
  } catch (error) {
    // Sur erreur, renvoyer le cache même périmé si disponible
    if (cached) {
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          matches: cached.data,
          cached: true,
          stale: true,
          error: String(error && error.message ? error.message : error),
        }),
      };
    }
    return {
      statusCode: 502,
      headers: responseHeaders,
      body: JSON.stringify({
        error: String(error && error.message ? error.message : error),
        matches: [],
      }),
    };
  }
};

/**
 * Récupère la page Liquipedia:Matches d'un wiki et extrait les matches.
 */
async function fetchWikiMatches(wiki) {
  // On essaye d'abord la page "Liquipedia:Matches" (la plus utilisée)
  const url = `https://liquipedia.net/${wiki}/api.php?action=parse&page=Liquipedia:Matches&format=json&prop=text`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Liquipedia error: ${data.error.info || data.error.code}`);
  }

  const html = data?.parse?.text?.['*'];
  if (!html) {
    throw new Error('No HTML content in response');
  }

  return parseMatchesHtml(html, wiki);
}

/**
 * Parser HTML de Liquipedia. Structure typique (commune à tous les wikis) :
 *
 *   <table class="infobox_matches_content">
 *     <tr>
 *       <td class="team-left">...TeamName...</td>
 *       <td class="versus"><abbr>BO3</abbr></td>
 *       <td class="team-right">...TeamName...</td>
 *     </tr>
 *     <tr class="match-filler">
 *       <td>
 *         <a href="/wiki/Tournament_Name" title="Tournament Name">...</a>
 *         <span class="timer-object" data-timestamp="1745000000">...</span>
 *       </td>
 *     </tr>
 *     <tr>
 *       <td>streams</td>
 *     </tr>
 *   </table>
 */
function parseMatchesHtml(html, wiki) {
  const matches = [];

  // Regex pour isoler chaque tableau de match
  // Liquipedia utilise infobox_matches_content (nouveau) ou infobox_matches (ancien)
  const tableRegex = /<table[^>]*class="[^"]*\binfobox_matches(?:_content)?\b[^"]*"[^>]*>([\s\S]*?)<\/table>/g;

  let m;
  let idCounter = 0;
  while ((m = tableRegex.exec(html)) !== null) {
    idCounter++;
    const block = m[1];

    // ── Timestamp ──
    const tsMatch = block.match(/data-timestamp="(\d+)"/);
    if (!tsMatch) continue;
    const timestamp = parseInt(tsMatch[1], 10) * 1000;
    // Ignore si date invalide
    if (isNaN(timestamp) || timestamp < Date.now() - 7 * 24 * 3600 * 1000) continue;
    const dateIso = new Date(timestamp).toISOString();

    // ── Équipes ──
    // Essayer d'abord team-template-text (format principal),
    // puis team-left-txt / team-right-txt, puis name-text
    const teams = extractTeams(block);
    if (teams.length < 2) continue;

    // ── Format (BO1, BO3, BO5) ──
    let format = '';
    const fmtMatch = block.match(/<abbr[^>]*title="[^"]*"[^>]*>\s*(B[oO]\s*\d+)\s*<\/abbr>/);
    if (fmtMatch) {
      format = fmtMatch[1].toUpperCase().replace(/\s+/g, '');
    } else {
      // Fallback : chercher "Bo3" directement dans le texte
      const versusMatch = block.match(/<td[^>]*class="versus"[^>]*>([\s\S]*?)<\/td>/);
      if (versusMatch) {
        const versusText = versusMatch[1].replace(/<[^>]+>/g, '').trim();
        const bo = versusText.match(/B[oO]\s*\d+/);
        if (bo) format = bo[0].toUpperCase().replace(/\s+/g, '');
      }
    }

    // ── Nom du tournoi ──
    // Chercher le premier lien de la zone match-filler qui a un title
    let tournament = '';
    const fillerMatch = block.match(/<tr[^>]*class="[^"]*match-filler[^"]*"[^>]*>([\s\S]*?)<\/tr>/);
    if (fillerMatch) {
      const linkMatch = fillerMatch[1].match(/<a[^>]*title="([^"]+)"/);
      if (linkMatch) tournament = decodeHtml(linkMatch[1]);
    }
    if (!tournament) {
      // Fallback : n'importe quel lien avec title
      const anyLink = block.match(/<a[^>]*title="([^"]+)"[^>]*>/);
      if (anyLink) tournament = decodeHtml(anyLink[1]);
    }

    // ── Streams ──
    const streamUrls = [];
    const streamRegex = /href="(https?:\/\/(?:www\.)?(?:twitch\.tv|youtube\.com|youtu\.be|kick\.com|afreecatv\.com|huya\.com|trovo\.live|nimo\.tv|bilibili\.com)\/[^"]+)"/g;
    let sm;
    while ((sm = streamRegex.exec(block)) !== null) {
      const url = sm[1];
      if (!streamUrls.includes(url)) streamUrls.push(url);
    }

    // ── Statut ──
    // Liquipedia marque les matches live avec timer-object et attribut "data-finished"=0
    const isLive =
      /\blive\b/i.test(block) && !/finished/i.test(block) ||
      timestamp <= Date.now() && timestamp > Date.now() - 5 * 3600 * 1000; // Dans les 5h

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

/**
 * Extraction des noms d'équipes avec 3 stratégies.
 */
function extractTeams(block) {
  const teams = [];

  // Stratégie 1 : team-template-text (le plus fréquent)
  const strat1 = /<span[^>]*class="[^"]*\bteam-template-text\b[^"]*"[^>]*>([\s\S]*?)<\/span>/g;
  let m;
  while ((m = strat1.exec(block)) !== null && teams.length < 2) {
    const name = m[1].replace(/<[^>]+>/g, '').trim();
    if (name) teams.push(decodeHtml(name));
  }
  if (teams.length >= 2) return teams.slice(0, 2);

  // Stratégie 2 : team-left-txt / team-right-txt
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

  // Stratégie 3 : chercher des <a title="..."> dans les premières <td>
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
  let td;
  let count = 0;
  while ((td = tdRegex.exec(block)) !== null && count < 4 && teams.length < 2) {
    count++;
    const linkMatch = td[1].match(/<a[^>]*title="([^"]+)"/);
    if (linkMatch) {
      const name = decodeHtml(linkMatch[1]);
      // Filtre les titres qui ne sont pas des équipes (pages Liquipedia)
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
