/**
 * Netlify Function : proxy pour l'API PandaScore esport.
 *
 * Lit la clé API depuis la variable d'environnement PANDASCORE_API_KEY
 * (configurée dans Site configuration → Environment variables).
 * La clé n'est jamais exposée au client.
 *
 * Appel depuis le front :
 *   /.netlify/functions/pandascore-proxy?path=csgo/matches&...
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

  const apiKey = process.env.PANDASCORE_API_KEY;
  if (!apiKey) {
    // Pas de clé → on ne casse pas l'app, on renvoie liste vide + info.
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify({
        _warning: 'PANDASCORE_API_KEY non configurée sur Netlify',
        data: [],
      }),
    };
  }

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k !== 'path' && v !== undefined && v !== null) {
      query.append(k, String(v));
    }
  }

  const qs = query.toString();
  const url = `https://api.pandascore.co/${path}${qs ? '?' + qs : ''}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    const body = await response.text();

    return {
      statusCode: response.status,
      headers: {
        ...responseHeaders,
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
      }),
    };
  }
};
