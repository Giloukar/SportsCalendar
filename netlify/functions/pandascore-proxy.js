/**
 * Netlify Function : proxy pour l'API PandaScore esport.
 *
 * La clé API PandaScore est lue depuis la variable d'environnement
 * PANDASCORE_API_KEY configurée dans les paramètres Netlify
 * (évite d'exposer la clé côté client).
 *
 * Appel depuis le front :
 *   /.netlify/functions/pandascore-proxy?path=csgo/matches&range[begin_at]=...
 */

export const handler = async (event) => {
  const params = event.queryStringParameters ?? {};
  const path = params.path;

  if (!path) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Paramètre "path" manquant' }),
    };
  }

  const apiKey = process.env.PANDASCORE_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      // Pas de clé configurée → on renvoie une liste vide pour que l'app
      // continue de fonctionner avec les autres providers.
      body: JSON.stringify([]),
    };
  }

  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (k !== 'path' && v !== undefined) query.append(k, String(v));
  });

  const url = `https://api.pandascore.co/${path}${query.toString() ? '?' + query.toString() : ''}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
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
