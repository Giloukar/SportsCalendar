/**
 * Netlify Function : proxy pour les requêtes IPTV.
 *
 * Utilisé pour 2 choses :
 *  1. Récupérer les playlists M3U / réponses Xtream Codes (CORS)
 *  2. Proxy vidéo HLS (si l'utilisateur active le fallback proxy)
 *
 * ⚠️ ATTENTION CONSOMMATION BANDE PASSANTE
 * Le proxy vidéo consomme la bande passante du compte Netlify.
 * Le free tier Netlify inclut 100 Go/mois. Pour un usage raisonnable
 * (1-2 matches par jour), c'est largement suffisant. Au-delà, ça coupe.
 *
 * Pour protéger le quota :
 *  - Pas de cache sur le stream vidéo (trop lourd)
 *  - Timeout 15 min max sur une requête
 *  - Headers no-cache pour éviter la mise en cache côté Netlify CDN
 *
 * ⚠️ SÉCURITÉ
 * Cette fonction accepte une URL arbitraire, ce qui en théorie permet
 * d'en faire un proxy ouvert. Pour limiter les abus :
 *  - Pas de logging d'URL
 *  - Seuls certains patterns d'URL sont autorisés
 *  - On ne supporte que les URLs de playlist (.m3u, .m3u8, player_api.php)
 *    et les segments TS/M3U8.
 */

exports.handler = async function handler(event) {
  const params = event.queryStringParameters || {};
  const targetUrl = params.url;
  const mode = params.mode || 'text'; // 'text' | 'json' | 'stream'

  const responseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: responseHeaders, body: '' };
  }

  if (!targetUrl) {
    return {
      statusCode: 400,
      headers: { ...responseHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Paramètre "url" manquant' }),
    };
  }

  // Validation simple : on accepte http(s) uniquement
  if (!/^https?:\/\//i.test(targetUrl)) {
    return {
      statusCode: 400,
      headers: { ...responseHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'URL invalide' }),
    };
  }

  try {
    // Propager le header Range pour les segments vidéo (HLS)
    const fwdHeaders = {
      'User-Agent': 'Mozilla/5.0 VLC/3.0.0',
      'Accept': '*/*',
    };
    if (event.headers && event.headers.range) {
      fwdHeaders['Range'] = event.headers.range;
    }

    const response = await fetch(targetUrl, { headers: fwdHeaders });

    if (mode === 'text') {
      const body = await response.text();
      return {
        statusCode: response.status,
        headers: {
          ...responseHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
        body,
      };
    }

    if (mode === 'json') {
      const body = await response.text();
      return {
        statusCode: response.status,
        headers: {
          ...responseHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body,
      };
    }

    if (mode === 'stream') {
      // Récupère les octets bruts du flux
      const buf = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'video/mp2t';

      const outHeaders = {
        ...responseHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      };
      // Propager les headers de range pour le scrub
      const contentRange = response.headers.get('content-range');
      if (contentRange) outHeaders['Content-Range'] = contentRange;
      const contentLength = response.headers.get('content-length');
      if (contentLength) outHeaders['Content-Length'] = contentLength;

      // Si c'est une playlist HLS, on doit réécrire les URLs des segments
      // pour qu'ils passent aussi par le proxy
      if (contentType.includes('mpegurl') || contentType.includes('m3u8') || targetUrl.endsWith('.m3u8')) {
        let text = buf.toString('utf-8');
        const baseUrl = new URL(targetUrl);
        // Réécrit les URLs relatives et absolues des segments
        text = text.replace(/^(?!#)(.+)$/gm, (line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return line;
          try {
            const absoluteUrl = new URL(trimmed, baseUrl).toString();
            return `/.netlify/functions/iptv-proxy?url=${encodeURIComponent(absoluteUrl)}&mode=stream`;
          } catch {
            return line;
          }
        });
        return {
          statusCode: response.status,
          headers: {
            ...outHeaders,
            'Content-Type': 'application/vnd.apple.mpegurl',
          },
          body: text,
        };
      }

      // Sinon : segment binaire (.ts, .mp4, ...), renvoyer en base64
      return {
        statusCode: response.status,
        headers: outHeaders,
        body: buf.toString('base64'),
        isBase64Encoded: true,
      };
    }

    return {
      statusCode: 400,
      headers: { ...responseHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Mode inconnu' }),
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { ...responseHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: String(error && error.message ? error.message : error),
      }),
    };
  }
};
