/**
 * Types pour la fonctionnalité IPTV intégrée.
 *
 * Toutes les données IPTV de l'utilisateur sont stockées EXCLUSIVEMENT
 * sur son appareil via Zustand persist (IndexedDB). Rien n'est envoyé
 * à un serveur distant, SportCal ne voit jamais ces informations.
 */

export type IptvSourceType = 'm3u' | 'xtream';

/**
 * Configuration de la source IPTV de l'utilisateur.
 */
export interface IptvSourceConfig {
  /** Type de source */
  type: IptvSourceType;
  /** URL M3U complète (si type = m3u) */
  m3uUrl?: string;
  /** URL du serveur Xtream (ex: http://serveur.com:8080) */
  xtreamServer?: string;
  /** Nom d'utilisateur Xtream */
  xtreamUsername?: string;
  /** Mot de passe Xtream */
  xtreamPassword?: string;
  /** Date de la dernière importation réussie */
  lastImportedAt?: string;
}

/**
 * Une chaîne IPTV importée depuis la playlist de l'utilisateur.
 */
export interface IptvChannel {
  /** Identifiant unique (hash du stream URL) */
  id: string;
  /** Nom affiché tel que fourni par le provider IPTV */
  name: string;
  /** Nom normalisé pour le matching (minuscules, sans emoji, pays, etc.) */
  normalizedName: string;
  /** URL du flux vidéo */
  streamUrl: string;
  /** Groupe/catégorie dans la playlist (ex: "FR | SPORTS HD") */
  group?: string;
  /** URL du logo si fourni */
  logoUrl?: string;
  /** Code pays deviné à partir du nom ou du groupe */
  country?: string;
  /** Chaîne cachée par l'utilisateur (ne pas proposer dans le matching) */
  hidden?: boolean;
}

/**
 * Correspondance manuelle entre un diffuseur (ex: "Canal+ Sport")
 * et une chaîne IPTV précise (par id).
 * Permet à l'utilisateur de corriger un matching incorrect.
 */
export interface BroadcastChannelMapping {
  /** Nom de diffuseur tel qu'il apparaît dans SportCal */
  broadcastName: string;
  /** ID de la chaîne IPTV choisie par l'utilisateur */
  iptvChannelId: string;
}

/**
 * État d'une lecture en cours dans le lecteur intégré.
 */
export interface PlayerState {
  channelId: string | null;
  playing: boolean;
  error: string | null;
  /** true = lecture via proxy Netlify, false = direct */
  usingProxy: boolean;
}
