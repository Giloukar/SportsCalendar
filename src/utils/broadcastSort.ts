/**
 * Utilitaires de catégorisation et de tri des diffuseurs.
 *
 * Règle globale d'affichage : FR en premier, puis EN, puis autres langues.
 * Pour les noms de chaîne, on détecte le pays via un dictionnaire.
 */

/** Chaînes TV françaises (priorité 0 = top) */
const FR_CHANNELS = [
  'canal+', 'canal +', 'canalplus',
  'bein sports', 'bein', 'bein sport',
  'ligue 1+', 'ligue1',
  'rmc sport', 'rmc',
  'prime video', 'amazon prime',
  'dazn',
  'france 2', 'france 3', 'france 4', 'france télévisions', 'france tv',
  'tf1', 'tmc', 'tfx',
  'm6', 'w9', '6ter',
  "l'équipe", 'lequipe', "l'equipe",
  'skweek',
  'eurosport',
  'apple tv+', 'apple tv',
  'molotov',
  'arte',
  'csgo','cs2'
];

/** Chaînes TV anglophones majeures */
const EN_CHANNELS = [
  'espn', 'abc', 'nbc', 'cbs', 'fox', 'fs1', 'fs2',
  'tnt', 'tbs', 'cnn',
  'sky sports', 'bt sport', 'bbc', 'itv',
  'hulu', 'paramount+', 'peacock',
  'draftkings',
  'tsn', 'sportsnet',
];

/** Chaînes TV hispanophones / lusophones */
const ES_PT_CHANNELS = ['espn deportes', 'univision', 'tudn', 'tycsports', 'sport tv', 'sky brasil'];

export type BroadcastLang = 'fr' | 'en' | 'es' | 'pt' | 'other';

/**
 * Détermine la langue/pays d'une chaîne TV ou d'un stream URL.
 */
export function detectBroadcastLang(broadcast: string): BroadcastLang {
  const lower = broadcast.toLowerCase();

  // URLs : on se base sur le code langue si présent
  if (lower.startsWith('http')) {
    if (/[_/-](fr|french|france)([_/-]|$)/.test(lower)) return 'fr';
    if (/[_/-](en|english|eng)([_/-]|$)/.test(lower)) return 'en';
    if (/[_/-](es|spanish|espanol)([_/-]|$)/.test(lower)) return 'es';
    if (/[_/-](pt|br|portuguese)([_/-]|$)/.test(lower)) return 'pt';
    // Twitch officiels : deviner d'après le nom
    if (/riot|lec|vct.*emea|ka(rmine|orn|arc)/i.test(lower)) return 'fr'; // canaux souvent FR
    return 'en'; // default Twitch = EN
  }

  // Noms de chaîne
  if (FR_CHANNELS.some((c) => lower.includes(c))) return 'fr';
  if (EN_CHANNELS.some((c) => lower.includes(c))) return 'en';
  if (ES_PT_CHANNELS.some((c) => lower.includes(c))) return lower.includes('brasil') || lower.includes('tudo') ? 'pt' : 'es';

  return 'other';
}

const LANG_RANK: Record<BroadcastLang, number> = {
  fr: 0,
  en: 1,
  es: 2,
  pt: 2,
  other: 3,
};

/**
 * Trie une liste de broadcasts en privilégiant FR > EN > autres.
 * Préserve l'ordre relatif original à l'intérieur d'une même langue (stable).
 */
export function sortBroadcasts(broadcasts: string[]): string[] {
  return [...broadcasts]
    .map((b, idx) => ({ b, idx, rank: LANG_RANK[detectBroadcastLang(b)] }))
    .sort((a, b) => a.rank - b.rank || a.idx - b.idx)
    .map((x) => x.b);
}

/**
 * Trie une liste d'URLs externes (streams) avec le même principe.
 * La structure des externalUrls contient déjà un label avec la langue
 * (ex: "Twitch (FR)") mais on refait la détection pour être sûr.
 */
export function sortExternalUrls<T extends { label: string; url: string }>(
  items: T[]
): T[] {
  return [...items]
    .map((item, idx) => ({
      item,
      idx,
      rank: LANG_RANK[detectBroadcastLang(item.label.toLowerCase().includes('fr') ? 'canal+' : item.url)],
    }))
    .sort((a, b) => a.rank - b.rank || a.idx - b.idx)
    .map((x) => x.item);
}
