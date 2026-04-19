/**
 * Netlify Function : proxy pour l'API ESPN publique.
 *
 * Pourquoi ? ESPN n'envoie pas de header CORS, donc le navigateur refuse
 * les appels directs. Netlify déploie cette fonction sur le même domaine
 * que le site, ce qui évite le blocage.
 *
 * Appel depuis le front :
 *   /.netlify/functions/espn-proxy?path=soccer/eng.1/scoreboard&dates=20260101-20260201
 */

export const handler = async (event) => {
  const params = event.queryStringParameters ?? {};
  const path = params.path;

  if (!path) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Paramètre "path" manquant' }),
    };
  }

  // Construire l'URL ESPN cible
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (k !== 'path' && v !== undefined) query.append(k, String(v));
  });

  const url = `https://site.api.espn.com/apis/site/v2/sports/${path}${query.toString() ? '?' + query.toString() : ''}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SportCalendar/1.0',
      },
    });

    const body = await response.text();

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60',
      },
      body,
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: String(error) }),
    };
  }
};
