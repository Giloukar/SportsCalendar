import { IptvChannel, IptvSourceConfig } from '../types/iptv';

/**
 * Service d'importation de playlists IPTV.
 *
 * Supporte deux formats :
 *  - M3U (fichier texte standard)
 *  - Xtream Codes API (serveur + user + pass → récupère liste via /player_api.php)
 */

/**
 * Normalise un nom de chaîne pour le matching.
 * Supprime :
 *  - emojis drapeaux
 *  - préfixes pays/catégorie typiques
 *  - HD/FHD/4K/UHD
 *  - caractères spéciaux
 *
 * Exemples :
 *   "🇫🇷 FR | Canal+ Sport HD" → "canal+ sport"
 *   "[FR] CANAL+ SPORT FHD" → "canal+ sport"
 *   "FRANCE ► Canal Plus Sport 1 4K" → "canal plus sport 1"
 */
export function normalizeChannelName(name: string): string {
  return name
    // Retire les emojis drapeaux (codes Unicode 🇦..🇿)
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')
    // Retire les autres emojis courants
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]/gu, '')
    // Retire les préfixes pays typiques en début
    .replace(/^\s*(FR|FRA|FRANCE|EN|ENG|UK|US|USA|DE|GER|ES|IT|PT)\s*[|►:\-\]]\s*/i, '')
    // Retire les crochets/parenthèses de pays
    .replace(/^\s*[\[\(]\s*(FR|FRA|FRANCE|EN|ENG|UK|US|USA|DE|GER|ES|IT|PT)\s*[\]\)]\s*/i, '')
    // Retire les codes de qualité
    .replace(/\b(4K|UHD|FHD|HD|SD|RAW|BACKUP|MULTI|H265|HEVC)\b/gi, '')
    // Retire VIP, PRIMARY, LIVE, etc.
    .replace(/\b(VIP|PRIMARY|SECONDARY|LIVE|DIRECT|BACKUP|MAIN|ALT)\b/gi, '')
    // Retire les séparateurs ET caractères isolés répétés
    .replace(/[|►:\-_]+/g, ' ')
    // Espaces multiples → un seul
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Devine le pays d'une chaîne à partir de son nom ou de son groupe.
 */
export function guessCountry(name: string, group?: string): string | undefined {
  const haystack = `${name} ${group ?? ''}`.toLowerCase();
  if (/\b(fr|fra|france|français)\b|🇫🇷/.test(haystack)) return 'FR';
  if (/\b(uk|eng|english|united kingdom|britain)\b|🇬🇧/.test(haystack)) return 'UK';
  if (/\b(us|usa|united states|america)\b|🇺🇸/.test(haystack)) return 'US';
  if (/\b(de|ger|german|allemagne)\b|🇩🇪/.test(haystack)) return 'DE';
  if (/\b(es|spa|spain|spanish|espagne)\b|🇪🇸/.test(haystack)) return 'ES';
  if (/\b(it|ita|italy|italian|italie)\b|🇮🇹/.test(haystack)) return 'IT';
  if (/\b(pt|por|portugal|portuguese)\b|🇵🇹/.test(haystack)) return 'PT';
  if (/\b(be|belgium|belgique)\b|🇧🇪/.test(haystack)) return 'BE';
  if (/\b(ch|switzerland|suisse)\b|🇨🇭/.test(haystack)) return 'CH';
  return undefined;
}

/**
 * Parse une playlist M3U standard.
 *
 * Format :
 *   #EXTM3U
 *   #EXTINF:-1 tvg-id="..." tvg-logo="..." group-title="FR | Sports",Canal+ Sport
 *   http://server.com:8080/live/user/pass/123.ts
 */
export function parseM3U(content: string): IptvChannel[] {
  const lines = content.split(/\r?\n/);
  const channels: IptvChannel[] = [];
  let currentInfo: Partial<IptvChannel> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      // Parse les attributs : tvg-id, tvg-name, tvg-logo, group-title
      const attrs: Record<string, string> = {};
      const attrRegex = /([\w-]+)="([^"]*)"/g;
      let am;
      while ((am = attrRegex.exec(line)) !== null) {
        attrs[am[1]] = am[2];
      }
      // Le nom est après la dernière virgule
      const commaIdx = line.lastIndexOf(',');
      const name = commaIdx >= 0 ? line.substring(commaIdx + 1).trim() : 'Unknown';

      currentInfo = {
        name,
        logoUrl: attrs['tvg-logo'],
        group: attrs['group-title'],
      };
    } else if (!line.startsWith('#') && currentInfo) {
      // Ligne URL
      const streamUrl = line;
      const id = btoa(streamUrl).substring(0, 32).replace(/[+/=]/g, '');
      channels.push({
        id,
        name: currentInfo.name ?? 'Unknown',
        normalizedName: normalizeChannelName(currentInfo.name ?? ''),
        streamUrl,
        group: currentInfo.group,
        logoUrl: currentInfo.logoUrl,
        country: guessCountry(currentInfo.name ?? '', currentInfo.group),
      });
      currentInfo = null;
    }
  }

  return channels;
}

/**
 * Importe la liste des chaînes depuis une URL M3U.
 *
 * Passe par le proxy Netlify pour contourner le CORS.
 * Retourne des messages d'erreur explicites pour chaque cas typique.
 */
export async function importFromM3U(url: string): Promise<IptvChannel[]> {
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error("URL invalide : l'URL doit commencer par http:// ou https://");
  }

  // Appel via proxy Netlify (contourne CORS)
  const proxyUrl = `/.netlify/functions/iptv-proxy?url=${encodeURIComponent(url)}&mode=text`;

  let response: Response;
  try {
    response = await fetch(proxyUrl);
  } catch (e: any) {
    throw new Error(
      `Erreur réseau : impossible de contacter le proxy. ` +
      `Vérifiez votre connexion Internet. (${e?.message ?? e})`
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 403) {
      throw new Error(
        "HTTP 403 Forbidden : votre provider IPTV refuse cette URL. " +
        "Vérifiez que l'abonnement est actif et que l'URL est exacte."
      );
    }
    if (response.status === 404) {
      throw new Error("HTTP 404 : URL introuvable. Vérifiez l'adresse exacte.");
    }
    if (response.status >= 500 && response.status < 600) {
      throw new Error(
        `HTTP ${response.status} : serveur IPTV indisponible. Réessayez dans quelques minutes.`
      );
    }
    throw new Error(
      `HTTP ${response.status}. ${body ? body.slice(0, 150) : response.statusText}`
    );
  }

  const content = await response.text();

  if (!content || content.trim().length === 0) {
    throw new Error("Le serveur a renvoyé une réponse vide. Vérifiez l'URL.");
  }

  if (content.includes('<html') || content.includes('<!DOCTYPE')) {
    throw new Error(
      "L'URL pointe vers une page HTML, pas vers une playlist M3U. " +
      "Vérifiez avec votre provider IPTV le lien exact de la playlist."
    );
  }

  if (!content.includes('#EXTM3U') && !content.includes('#EXTINF')) {
    throw new Error(
      "Le contenu récupéré ne ressemble pas à une playlist M3U valide. " +
      "Premiers caractères : " + content.substring(0, 80).replace(/\n/g, ' ')
    );
  }

  const channels = parseM3U(content);
  if (channels.length === 0) {
    throw new Error(
      "Playlist M3U valide mais aucune chaîne trouvée. Format de playlist inattendu."
    );
  }

  return channels;
}

/**
 * Importe la liste des chaînes via l'API Xtream Codes.
 *
 * L'API Xtream est très répandue : elle est utilisée par 95% des
 * providers IPTV. L'URL est du type :
 *   http://server:port/player_api.php?username=X&password=Y&action=get_live_streams
 */
export async function importFromXtream(
  server: string,
  username: string,
  password: string
): Promise<IptvChannel[]> {
  if (!server || !username || !password) {
    throw new Error('Tous les champs Xtream sont obligatoires (serveur, utilisateur, mot de passe).');
  }

  // Ajoute http:// si absent
  let cleanServer = server.replace(/\/$/, '');
  if (!/^https?:\/\//i.test(cleanServer)) {
    cleanServer = 'http://' + cleanServer;
  }

  // Étape 1 : vérifier que les credentials marchent
  const authUrl = `${cleanServer}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  const authProxyUrl = `/.netlify/functions/iptv-proxy?url=${encodeURIComponent(authUrl)}&mode=json`;

  let authResponse: Response;
  try {
    authResponse = await fetch(authProxyUrl);
  } catch (e: any) {
    throw new Error(
      `Erreur réseau : impossible de contacter le serveur. ` +
      `Vérifiez l'URL du serveur et votre connexion. (${e?.message ?? e})`
    );
  }

  if (!authResponse.ok) {
    throw new Error(
      `Serveur Xtream injoignable (HTTP ${authResponse.status}). ` +
      `Vérifiez l'URL du serveur : ${cleanServer}`
    );
  }

  let authData: any;
  try {
    authData = await authResponse.json();
  } catch {
    throw new Error(
      `Le serveur n'a pas renvoyé du JSON. ` +
      `L'URL "${cleanServer}" n'est probablement pas un serveur Xtream Codes.`
    );
  }

  // Authentification Xtream : vérifier user_info.auth
  if (!authData || !authData.user_info) {
    throw new Error(
      `Réponse Xtream invalide. Le serveur a répondu mais pas dans le format attendu. ` +
      `Vérifiez que c'est bien un serveur Xtream Codes.`
    );
  }

  if (authData.user_info.auth === 0 || authData.user_info.auth === '0') {
    throw new Error(
      `Identifiants incorrects. Le serveur a refusé la connexion. ` +
      `Vérifiez votre nom d'utilisateur et mot de passe.`
    );
  }

  // Étape 2 : récupérer les streams
  const streamsUrl = `${authUrl}&action=get_live_streams`;
  const streamsProxyUrl = `/.netlify/functions/iptv-proxy?url=${encodeURIComponent(streamsUrl)}&mode=json`;

  const streamsResponse = await fetch(streamsProxyUrl);
  if (!streamsResponse.ok) {
    throw new Error(`Erreur HTTP ${streamsResponse.status} lors de la récupération des chaînes`);
  }

  const data = await streamsResponse.json();
  if (!Array.isArray(data)) {
    throw new Error(
      "Le serveur n'a pas renvoyé de liste de chaînes. " +
      "Votre abonnement est-il actif ?"
    );
  }

  if (data.length === 0) {
    throw new Error(
      "Le serveur a répondu mais aucune chaîne disponible. " +
      "Votre abonnement est-il actif et inclut-il des chaînes live ?"
    );
  }

  // Étape 3 : récupérer les catégories pour les groupes
  const catUrl = `${authUrl}&action=get_live_categories`;
  const catProxyUrl = `/.netlify/functions/iptv-proxy?url=${encodeURIComponent(catUrl)}&mode=json`;
  const catResponse = await fetch(catProxyUrl);
  const categories: Array<{ category_id: string; category_name: string }> =
    catResponse.ok ? await catResponse.json().catch(() => []) : [];
  const catMap = new Map(categories.map((c) => [c.category_id, c.category_name]));

  return data.map((item: any) => {
    const name = item.name ?? 'Unknown';
    const streamId = item.stream_id;
    const streamUrl = `${cleanServer}/live/${username}/${password}/${streamId}.ts`;
    const group = item.category_id ? catMap.get(String(item.category_id)) : undefined;

    return {
      id: `xtream-${streamId}`,
      name,
      normalizedName: normalizeChannelName(name),
      streamUrl,
      group,
      logoUrl: item.stream_icon ?? undefined,
      country: guessCountry(name, group),
    };
  });
}

/**
 * Importe les chaînes selon la configuration source de l'utilisateur.
 */
export async function importChannels(config: IptvSourceConfig): Promise<IptvChannel[]> {
  if (config.type === 'm3u') {
    if (!config.m3uUrl) throw new Error('URL M3U manquante');
    return importFromM3U(config.m3uUrl);
  } else {
    if (!config.xtreamServer || !config.xtreamUsername || !config.xtreamPassword) {
      throw new Error('Configuration Xtream incomplète');
    }
    return importFromXtream(
      config.xtreamServer,
      config.xtreamUsername,
      config.xtreamPassword
    );
  }
}
