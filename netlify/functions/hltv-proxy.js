/**
 * Netlify Function : scraper HLTV.org pour les matches CS2.
 *
 * Pourquoi ?
 *  - PandaScore peut avoir des manques (notamment les finales tier S)
 *  - HLTV est LA référence CS2 et expose publiquement ses pages matches
 *  - Scraping léger : on parse le HTML pour extraire les matches à venir
 *
 * Renvoie un JSON du type :
 *   {
 *     matches: [
 *       { id, name, time, team1, team2, event, stars, format, live }
 *     ]
 *   }
 *
 * Note : HLTV n'aime pas le scraping intensif, on fait max 1 requête par
 * synchronisation utilisateur. Netlify CDN cache 60s pour protéger.
 */

exports.handler = async function handler(event) {
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: responseHeaders, body: '' };
  }

  try {
    const response = await fetch('https://www.hltv.org/matches', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
      },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: responseHeaders,
        body: JSON.stringify({ error: `HLTV responded ${response.status}`, matches: [] }),
      };
    }

    const html = await response.text();
    const matches = parseHltvMatches(html);

    return {
      statusCode: 200,
      headers: {
        ...responseHeaders,
        'Cache-Control': 'public, max-age=60',
      },
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
 * Parse le HTML de hltv.org/matches pour extraire les matches à venir.
 * Basé sur la structure des cartes "upcomingMatch" que HLTV utilise depuis
 * plusieurs années. Robuste aux petits changements grâce à des regex tolérants.
 */
function parseHltvMatches(html) {
  const matches = [];

  // HLTV structure chaque match comme <div class="upcomingMatch" ... data-zonedgrouping-entry-unix="1234567890000">
  // Contient plusieurs data-attributes et des divs imbriqués.
  const matchRegex = /<div[^>]*class="[^"]*\bupcomingMatch\b[^"]*"[^>]*data-zonedgrouping-entry-unix="(\d+)"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;

  let m;
  let count = 0;
  while ((m = matchRegex.exec(html)) !== null && count < 60) {
    count++;
    const timestamp = parseInt(m[1], 10);
    const block = m[2];

    const dateIso = new Date(timestamp).toISOString();

    // Équipes : <div class="matchTeamName ...">NomÉquipe</div>
    const teamNames = [];
    const teamRegex = /<div class="matchTeamName[^"]*"[^>]*>([^<]+)<\/div>/g;
    let teamMatch;
    while ((teamMatch = teamRegex.exec(block)) !== null && teamNames.length < 2) {
      teamNames.push(teamMatch[1].trim());
    }

    // Événement : <div class="matchEventName gtSmartphone-only">NomEvent</div>
    // Ou <span class="matchEventName">...</span>
    const eventMatch = block.match(/<(?:div|span)[^>]*class="[^"]*matchEventName[^"]*"[^>]*>([^<]+)</);
    const eventName = eventMatch ? eventMatch[1].trim() : 'CS Match';

    // Format : <div class="matchMeta">BO3</div> ou similaire
    const metaMatch = block.match(/<div[^>]*class="matchMeta"[^>]*>([^<]+)</);
    const format = metaMatch ? metaMatch[1].trim() : '';

    // Étoiles (importance) : <div class="matchRating">... <i class="... star-on"></i>
    const stars = (block.match(/star-on/g) || []).length;

    // ID du match : <a href="/matches/1234567/team-vs-team-...">
    const linkMatch = block.match(/href="\/matches\/(\d+)\/[^"]+"/);
    const matchId = linkMatch ? linkMatch[1] : `hltv-${timestamp}`;

    // Statut live : présence de "live" dans la carte
    const isLive = /matchLive|live-match/i.test(block);

    if (teamNames.length === 2) {
      matches.push({
        id: matchId,
        date: dateIso,
        timestamp,
        team1: teamNames[0],
        team2: teamNames[1],
        event: eventName,
        format,
        stars, // 0 à 5 étoiles selon HLTV
        live: isLive,
        url: `https://www.hltv.org/matches/${matchId}`,
      });
    }
  }

  return matches;
}
