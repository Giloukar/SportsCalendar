/**
 * Table de correspondance ligue → diffuseurs français connus.
 *
 * Quand les providers (ESPN, PandaScore) ne renvoient pas de diffuseur,
 * on enrichit avec cette table qui reflète les accords de diffusion
 * actuels en France (mise à jour saison 2025-2026).
 *
 * Format : chaque entrée contient une regex de match contre le nom de ligue
 * et les diffuseurs à ajouter. L'ordre est volontaire : on commence par
 * le diffuseur principal.
 */

export interface BroadcastEnrichment {
  /** Regex case-insensitive à matcher contre league OU title */
  match: RegExp;
  /** Liste de diffuseurs (chaînes TV / plateformes), priorité FR en premier */
  channels: string[];
}

export const BROADCAST_ENRICHMENTS: BroadcastEnrichment[] = [
  // =============== Football ===============
  {
    match: /ligue\s*1/i,
    channels: ['Ligue 1+', 'beIN SPORTS'],
  },
  {
    match: /champions\s*league|uefa.*champions/i,
    channels: ['Canal+'],
  },
  {
    match: /europa\s*league|uefa.*europa/i,
    channels: ['Canal+', 'W9'],
  },
  {
    match: /premier\s*league|english\s*premier/i,
    channels: ['Canal+'],
  },
  {
    match: /(la\s*liga|spanish.*liga|primera\s*division)/i,
    channels: ['beIN SPORTS'],
  },
  {
    match: /serie\s*a(?!\.)|italian\s*serie/i,
    channels: ['beIN SPORTS'],
  },
  {
    match: /bundesliga/i,
    channels: ['beIN SPORTS'],
  },
  {
    match: /mls|major\s*league\s*soccer/i,
    channels: ['Apple TV+'],
  },
  {
    match: /coupe\s*de\s*france/i,
    channels: ['France 2', 'beIN SPORTS'],
  },
  {
    match: /coupe\s*du\s*monde|fifa\s*world\s*cup/i,
    channels: ['TF1', 'beIN SPORTS'],
  },
  {
    match: /euro\b|uefa\s*euro/i,
    channels: ['TF1', 'M6', 'beIN SPORTS'],
  },

  // =============== Basketball ===============
  {
    match: /\bnba\b/i,
    channels: ['beIN SPORTS'],
  },
  {
    match: /euroleague/i,
    channels: ['Skweek'],
  },
  {
    match: /betclic\s*elite|lnb/i,
    channels: ["L'Équipe Live", 'Skweek'],
  },

  // =============== Rugby ===============
  {
    match: /top\s*14/i,
    channels: ['Canal+'],
  },
  {
    match: /six\s*nations|tournoi\s*des\s*six/i,
    channels: ['France 2', 'France 3'],
  },
  {
    match: /rugby\s*world\s*cup|coupe\s*du\s*monde\s*de\s*rugby/i,
    channels: ['TF1', 'France Télévisions'],
  },
  {
    match: /champions\s*cup.*rugby|rugby.*champions\s*cup/i,
    channels: ['beIN SPORTS'],
  },

  // =============== Sport auto ===============
  {
    match: /formula\s*1|formule\s*1|\bf1\b/i,
    channels: ['Canal+'],
  },
  {
    match: /motogp/i,
    channels: ['Canal+ Sport'],
  },

  // =============== NFL / NHL / MLB ===============
  {
    match: /\bnfl\b|super\s*bowl/i,
    channels: ['DAZN', 'beIN SPORTS'],
  },
  {
    match: /\bnhl\b/i,
    channels: ["L'Équipe Live"],
  },
  {
    match: /\bmlb\b|world\s*series/i,
    channels: ['ESPN Player'],
  },

  // =============== Tennis ===============
  {
    match: /roland[\s-]?garros/i,
    channels: ['France Télévisions', 'Prime Video'],
  },
  {
    match: /wimbledon/i,
    channels: ['beIN SPORTS'],
  },
  {
    match: /us\s*open.*tennis|atp.*us\s*open|wta.*us\s*open/i,
    channels: ['Prime Video'],
  },
  {
    match: /australian\s*open/i,
    channels: ['Eurosport'],
  },
  {
    match: /\batp\b|\bwta\b/i,
    channels: ['beIN SPORTS', 'Eurosport'],
  },

  // =============== Golf ===============
  {
    match: /pga\s*tour|masters\s*tournament|ryder\s*cup/i,
    channels: ['Canal+ Golf'],
  },

  // =============== MMA / UFC / Boxe ===============
  {
    match: /ufc/i,
    channels: ['RMC Sport'],
  },

  // =============== Cyclisme ===============
  {
    match: /tour\s*de\s*france/i,
    channels: ['France 2', 'France 3'],
  },
  {
    match: /giro|vuelta/i,
    channels: ['Eurosport'],
  },

  // =============== Handball ===============
  {
    match: /starligue|liqui\s*moly/i,
    channels: ['beIN SPORTS'],
  },
  {
    match: /ehf\s*champions\s*league/i,
    channels: ['beIN SPORTS'],
  },
];

/**
 * Enrichit une liste de diffuseurs d'un événement en ajoutant les
 * diffuseurs français connus si aucun n'est déjà présent.
 */
export function enrichBroadcasts(
  league: string | undefined,
  title: string | undefined,
  existing: string[] | undefined
): string[] | undefined {
  const haystack = `${league ?? ''} ${title ?? ''}`;
  if (!haystack.trim()) return existing;

  const enrichment = BROADCAST_ENRICHMENTS.find((e) => e.match.test(haystack));
  if (!enrichment) return existing;

  // Si aucun diffuseur, on met ceux par défaut.
  // Si déjà des diffuseurs (via ESPN par ex.), on les garde en tête
  // puis on complète avec les FR qui ne sont pas déjà présents.
  const existingLower = (existing ?? []).map((b) => b.toLowerCase());
  const additions = enrichment.channels.filter(
    (c) => !existingLower.some((e) => e.includes(c.toLowerCase()))
  );

  return [...(existing ?? []), ...additions];
}
