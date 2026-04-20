import { IptvChannel, BroadcastChannelMapping } from '../types/iptv';
import { normalizeChannelName } from './iptvImportService';

/**
 * Service de matching automatique entre les noms de diffuseurs SportCal
 * (ex: "Canal+ Sport") et les chaînes IPTV de l'utilisateur.
 *
 * L'algorithme :
 *  1. Vérifie s'il existe une correspondance manuelle définie par l'utilisateur
 *  2. Sinon, applique un scoring par similarité fuzzy avec boost FR
 *  3. Retourne les N meilleures chaînes candidates
 */

export interface MatchCandidate {
  channel: IptvChannel;
  score: number;
  /** Explication du matching pour debug / UI */
  reason: string;
}

/**
 * Synonymes courants : certaines chaînes ont plusieurs noms.
 * Ex : ESPN peut s'appeler "ESPN" ou "Sport 1" selon le provider.
 */
const SYNONYMS: Record<string, string[]> = {
  'canal+ sport': ['canal sport', 'canalplus sport', 'canalsport', 'canal + sport'],
  'canal+': ['canal plus', 'canalplus', 'canal +'],
  'bein sports': ['bein sport', 'bein', 'be in sports'],
  'ligue 1+': ['ligue1+', 'ligue 1 plus', 'ligue1', 'l1+', 'l1 plus'],
  'rmc sport': ['rmc', 'rmcsport'],
  "l'équipe": ['lequipe', 'equipe', 'l equipe', 'lequipe tv'],
  'france 2': ['france2', 'fr2', 'f2'],
  'france 3': ['france3', 'fr3', 'f3'],
  'france 4': ['france4', 'fr4', 'f4'],
  'france télévisions': ['france tv', 'france televisions', 'francetv'],
  'prime video': ['amazon prime', 'primevideo', 'amazon'],
  'eurosport': ['euro sport', 'eurosport 1', 'eurosport 2'],
  'dazn': ['dazn 1', 'dazn fr'],
  'sky sports': ['sky sport'],
};

/**
 * Tokenise un nom normalisé en mots-clés significatifs.
 */
function tokenize(name: string): string[] {
  return name
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .filter((t) => !/^(tv|hd|sd|fhd|uhd|4k)$/.test(t));
}

/**
 * Calcule un score de similarité entre un diffuseur et une chaîne IPTV.
 * Retourne un score entre 0 (pas de match) et 100 (parfait).
 */
function scoreMatch(broadcastNorm: string, channel: IptvChannel): { score: number; reason: string } {
  const channelNorm = channel.normalizedName;

  // Match parfait
  if (broadcastNorm === channelNorm) return { score: 100, reason: 'Nom identique' };

  // Vérifier les synonymes du diffuseur
  const synonyms = [broadcastNorm, ...(SYNONYMS[broadcastNorm] ?? [])];
  for (const syn of synonyms) {
    if (channelNorm === syn) return { score: 98, reason: 'Synonyme exact' };
  }

  // Inclusion stricte (ex: "canal+ sport" ⊂ "canal+ sport 1")
  for (const syn of synonyms) {
    if (channelNorm.includes(syn) && syn.length >= 4) {
      const ratio = syn.length / channelNorm.length;
      return { score: 80 + Math.round(ratio * 15), reason: `Contient "${syn}"` };
    }
  }

  // Inverse : le nom chaîne est inclus dans le diffuseur
  if (broadcastNorm.includes(channelNorm) && channelNorm.length >= 4) {
    const ratio = channelNorm.length / broadcastNorm.length;
    return { score: 70 + Math.round(ratio * 15), reason: `Contenu dans "${broadcastNorm}"` };
  }

  // Matching par tokens : combien de mots clés communs ?
  const broadcastTokens = new Set(tokenize(broadcastNorm));
  const channelTokens = new Set(tokenize(channelNorm));
  const intersection = new Set([...broadcastTokens].filter((t) => channelTokens.has(t)));

  if (intersection.size === 0) return { score: 0, reason: 'Aucun mot commun' };

  // Score basé sur la proportion de tokens matchés
  const ratio = intersection.size / Math.max(broadcastTokens.size, channelTokens.size);
  const score = Math.round(ratio * 60);

  return {
    score,
    reason: `${intersection.size}/${broadcastTokens.size} mots-clés communs`,
  };
}

/**
 * Trouve les meilleures chaînes IPTV pour un nom de diffuseur donné.
 */
export function findChannelsForBroadcast(
  broadcastName: string,
  channels: IptvChannel[],
  mappings: BroadcastChannelMapping[] = [],
  maxResults = 5
): MatchCandidate[] {
  if (!broadcastName || channels.length === 0) return [];

  // 1. Priorité absolue : correspondance manuelle
  const manualMapping = mappings.find(
    (m) => m.broadcastName.toLowerCase() === broadcastName.toLowerCase()
  );
  if (manualMapping) {
    const manualChannel = channels.find((c) => c.id === manualMapping.iptvChannelId);
    if (manualChannel) {
      return [{ channel: manualChannel, score: 100, reason: 'Correspondance manuelle' }];
    }
  }

  // 2. Matching automatique par similarité
  const broadcastNorm = normalizeChannelName(broadcastName);
  const candidates: MatchCandidate[] = channels
    .filter((c) => !c.hidden)
    .map((channel) => {
      const { score, reason } = scoreMatch(broadcastNorm, channel);
      // Boost pour les chaînes FR si le diffuseur est manifestement français
      const isFrBroadcast = /canal|bein|ligue|rmc|tf1|france|m6|w9|eurosport/i.test(broadcastNorm);
      const frBoost = isFrBroadcast && channel.country === 'FR' ? 10 : 0;
      return { channel, score: score + frBoost, reason };
    })
    .filter((c) => c.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return candidates;
}

/**
 * Version simplifiée : retourne la meilleure correspondance unique ou null.
 */
export function findBestChannel(
  broadcastName: string,
  channels: IptvChannel[],
  mappings: BroadcastChannelMapping[] = []
): IptvChannel | null {
  const matches = findChannelsForBroadcast(broadcastName, channels, mappings, 1);
  return matches.length > 0 ? matches[0].channel : null;
}
