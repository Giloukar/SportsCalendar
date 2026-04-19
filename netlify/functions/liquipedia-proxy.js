/**
 * Netlify Function : scraper Liquipedia.net pour les matches esport.
 *
 * Liquipedia est LA référence esport (maintenue par la communauté, couvre
 * tous les jeux compétitifs). L'API MediaWiki publique permet de parser
 * la page "Liquipedia:Upcoming_and_ongoing_matches" de chaque wiki de jeu.
 *
 * Wikis couverts (slug Liquipedia) :
 *   counterstrike, leagueoflegends, dota2, valorant, rocketleague,
 *   overwatch, rainbowsix, starcraft2, pubg, fifa, callofduty, etc.
 *
 * ⚠️ CONDITIONS D'UTILISATION :
 *   - User-Agent identifié obligatoire (email)
 *   - Rate-limit conseillé : 1 requête toutes les 30 sec par wiki
 *   - À but non lucratif uniquement
 *
 * Appel depuis le front :
 *   /.netlify/functions/liquipedia-proxy?wiki=counterstrike
 */

// User-Agent : Liquipedia impose un identifiant avec email de contact.
// Personnalisez ici avec votre email (ou gardez celui-ci, c'est OK).
const USER_AGENT = 'SportCalendarPWA/1.0 (https://github.com/Giloukar/SportsCalendar; sportcalendar@example.com) axios/1.0';

// Petit cache en mémoire pour éviter de spammer Liquipedia
// (une Netlify Function est éphémère mais survit quelques minutes chaude)
const cache = new Map();
const CACHE_TTL_MS = 60_000; // 1 minute

exports.handler = async function handler(event) {
  const params = event.queryStringParameters || {};
  const wiki = params.wiki;

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
  const cacheKey = `liquipedia:${wiki}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    return {
      statusCode: 200,
      headers: { ...responseHeaders, 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify({ matches: cached.data, cached: true }),
    };
  }

  try {
    // API MediaWiki : parse la page Liquipedia:Matches pour obtenir le HTML
    const url = `https://liquipedia.net/${wiki}/api.php?action=parse&page=Liquipedia:Matches&format=json&prop=text`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
      },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: responseHeaders,
        body: JSON.stringify({
          error: `Liquipedia ${wiki} responded ${response.status}`,
          matches: [],
        }),
      };
    }

    const data = await response.json();
    const html = data?.parse?.text?.['*'] ?? '';
    const matches = parseLiquipediaMatches(html, wiki);

    cache.set(cacheKey, { time: Date.now(), data: matches });

    return {
      statusCode: 200,
      headers: { ...responseHeaders, 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify({ matches }),
    };
  } catch (error) {
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
 * Parse le HTML d'une page Liquipedia:Matches.
 *
 * Structure type Liquipedia :
 *   <table class="infobox_matches_content">
 *     <tr><td class="team-left">...team1...</td>
 *         <td class="versus">BO3</td>
 *         <td class="team-right">...team2...</td></tr>
 *     <tr><td>...tournoi...</td>
 *         <td>timer class="timer-object" data-timestamp="...">heure</td></tr>
 *     <tr><td>streams</td></tr>
 *   </table>
 */
function parseLiquipediaMatches(html, wiki) {
  const matches = [];

  // Découpe en blocs de matches (chaque table infobox_matches_content = 1 match)
  const tableRegex = /<table[^>]*class="[^"]*\binfobox_matches_content\b[^"]*"[^>]*>([\s\S]*?)<\/table>/g;

  let m;
  let id = 0;
  while ((m = tableRegex.exec(html)) !== null) {
    const block = m[1];
    id++;

    // Timestamp : <span class="timer-object" data-timestamp="1745000000">
    const tsMatch = block.match(/data-timestamp="(\d+)"/);
    if (!tsMatch) continue;
    const timestamp = parseInt(tsMatch[1], 10) * 1000; // secondes → ms
    const dateIso = new Date(timestamp).toISOString();

    // Équipe gauche : <td class="team-left">...<span class="team-template-text">TeamName</span>
    // Fallback : chercher le premier "team-template-text" dans le block
    const teamTextRegex = /<span[^>]*class="[^"]*\bteam-template-text\b[^"]*"[^>]*>([\s\S]*?)<\/span>/g;
    const teams = [];
    let tm;
    while ((tm = teamTextRegex.exec(block)) !== null && teams.length < 2) {
      // Enlever les sous-balises (liens, etc.) pour ne garder que le texte
      const rawText = tm[1].replace(/<[^>]+>/g, '').trim();
      if (rawText) teams.push(rawText);
    }
    if (teams.length < 2) continue;

    // Format : BO1, BO3, BO5... (souvent dans <abbr> ou simplement <td class="versus">)
    const versusMatch = block.match(/<td[^>]*class="[^"]*\bversus\b[^"]*"[^>]*>([\s\S]*?)<\/td>/);
    let format = '';
    if (versusMatch) {
      const versusText = versusMatch[1].replace(/<[^>]+>/g, '').trim();
      const bo = versusText.match(/B[oO]\s*\d+/);
      if (bo) format = bo[0].toUpperCase().replace(/\s+/g, '');
    }

    // Tournoi : première balise avec class "tournament-text" ou "league-icon-small-image"
    // Plus simplement : le nom visible du tournoi via lien après l'icône
    // Regex tolérant : on prend le premier <a ... title="..." qui suit un div.match-filler ou league-icon
    let tournamentName = '';
    const tournMatch = block.match(/<a[^>]*href="\/[^"]+"[^>]*title="([^"]+)"[^>]*>[\s\S]*?<\/a>\s*<\/div>/);
    if (tournMatch) {
      tournamentName = tournMatch[1].trim();
    } else {
      // Fallback : n'importe quel a avec title dans le block
      const anyLink = block.match(/<a[^>]*title="([^"]+)"/);
      if (anyLink) tournamentName = anyLink[1].trim();
    }

    // Streams : <a href="https://www.twitch.tv/..." ou similaire
    const streamUrls = [];
    const streamRegex = /href="(https?:\/\/(?:www\.)?(?:twitch\.tv|youtube\.com|youtu\.be|kick\.com|afreecatv\.com|huya\.com|trovo\.live|nimo\.tv)\/[^"]+)"/g;
    let sm;
    while ((sm = streamRegex.exec(block)) !== null) {
      const url = sm[1];
      if (!streamUrls.includes(url)) streamUrls.push(url);
    }

    // Statut : présence de "match-countdown" ou texte "LIVE!"
    const isLive = /match-countdown.*live|class="[^"]*live[^"]*"/i.test(block) || /LIVE!/.test(block);

    // Déterminer le tier à partir du nom de tournoi (Tier 1 tournaments de Liquipedia)
    // On renvoie juste le nom brut, c'est l'app qui classifie
    matches.push({
      id: `liqui-${wiki}-${timestamp}-${id}`,
      date: dateIso,
      timestamp,
      team1: teams[0],
      team2: teams[1],
      tournament: tournamentName || 'Unknown Tournament',
      format,
      live: isLive,
      streams: streamUrls,
      wiki,
    });
  }

  return matches;
}
