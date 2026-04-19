/**
 * Netlify Function : proxy pour l'API ESPN.
 *
 * Pourquoi ?
 *  - ESPN n'envoie pas de header CORS, le navigateur refuse les appels
 *    directs depuis une PWA (Cross-Origin Resource Sharing).
 *  - Netlify déploie cette fonction sur le même domaine que le site,
 *    contournant le CORS.
 *
 * Compatibilité : CommonJS explicite (exports.handler) pour éviter
 * les problèmes d'ESM que j'ai eus sur les runtimes Netlify.
 *
 * Appel depuis le front :
 *   /.netlify/functions/espn-proxy?path=soccer/fra.1/scoreboard&dates=20260101-20260201
 *
 * Réponse : relaie le JSON d'ESPN avec headers CORS + cache court.
 */

exports.handler = async function handler(event) {
  const params = event.queryStringParameters || {};
  const path = params.path;

  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Préflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: responseHeaders, body: '' };
  }

  if (!path) {
    return {
      statusCode: 400,
      headers: responseHeaders,
      body: JSON.stringify({ error: 'Paramètre "path" manquant' }),
    };
  }

  // Reconstruire la query string en excluant `path`
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k !== 'path' && v !== undefined && v !== null) {
      query.append(k, String(v));
    }
  }

  const qs = query.toString();
  const url = `https://site.api.espn.com/apis/site/v2/sports/${path}${qs ? '?' + qs : ''}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 SportCalendar/1.0',
      },
    });

    const body = await response.text();

    return {
      statusCode: response.status,
      headers: {
        ...responseHeaders,
        // Cache très court : 15s pour la fraîcheur des scores live
        'Cache-Control': 'public, max-age=15',
      },
      body,
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: responseHeaders,
      body: JSON.stringify({
        error: String(error && error.message ? error.message : error),
        url,
      }),
    };
  }
};
