/**
 * Types et interfaces centralisés de l'application.
 * Toute entité métier doit être déclarée ici pour garantir la cohérence.
 */

// ======================== Catégories sportives ========================

export type SportCategory = 'sport' | 'esport';

export type SportId =
  // Sports traditionnels
  | 'football'
  | 'basketball'
  | 'tennis'
  | 'rugby'
  | 'formula1'
  | 'motogp'
  | 'handball'
  | 'badminton'
  | 'volleyball'
  | 'baseball'
  | 'golf'
  | 'boxing'
  | 'mma'
  | 'cycling'
  | 'athletics'
  | 'nfl'
  | 'nhl'
  // Esports
  | 'lol'
  | 'valorant'
  | 'csgo'
  | 'dota2'
  | 'rocketleague'
  | 'overwatch'
  | 'fifa'
  | 'starcraft'
  | 'r6siege'
  | 'mobilelegends'
  | 'pubg'
  | 'pubgmobile'
  | 'kingofglory'
  | 'codblackops'
  | 'freefire';

// ======================== Niveaux d'importance ========================

/**
 * Tier S : événements majeurs (NBA, Ligue 1, CL, Worlds LoL...)
 * Tier A : finales importantes
 * Tier B : phases finales / playoffs
 * Tier C : ligues secondaires et matches réguliers
 */
export type EventTier = 'S' | 'A' | 'B' | 'C';

export type EventStatus = 'scheduled' | 'live' | 'finished' | 'cancelled' | 'postponed';

// ======================== Événements ========================

export interface Team {
  id: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  country?: string;
}

export interface SportEvent {
  /** Identifiant unique, de préférence stable côté API */
  id: string;
  /** Nom ou titre de l'événement */
  title: string;
  /** Identifiant du sport/esport */
  sportId: SportId;
  /** Catégorie sport vs esport */
  category: SportCategory;
  /** Date/heure ISO 8601 UTC */
  startDate: string;
  /** Date/heure de fin estimée (optionnelle) */
  endDate?: string;
  /** Nom de la compétition (NBA, Ligue 1, Worlds, etc.) */
  league: string;
  /** Niveau d'importance pour le code couleur */
  tier: EventTier;
  /** Statut de l'événement */
  status: EventStatus;
  /** Équipes participantes (facultatif pour certains sports individuels) */
  homeTeam?: Team;
  awayTeam?: Team;
  /** Scores actuels si l'événement est en cours ou terminé */
  homeScore?: number;
  awayScore?: number;
  /** Lieu de l'événement */
  venue?: string;
  /** Chaîne/plateforme de diffusion */
  broadcast?: string[];
  /** Phase de la compétition (groupe, demi-finale, finale...) */
  round?: string;
  /** Liens externes (billetterie, stream) */
  externalUrls?: { label: string; url: string }[];
  /** Notes ou commentaires */
  notes?: string;
  /** Horodatage de la dernière synchronisation */
  lastSyncedAt?: string;
}

// ======================== Préférences utilisateur ========================

export interface NotificationSettings {
  enabled: boolean;
  /** Délai avant événement en minutes avant le lancement */
  reminderMinutes: number[];
  /** Notifier uniquement les Tier S/A */
  onlyImportant: boolean;
  /** Notifications pour le début des matches live */
  onLiveStart: boolean;
}

export interface GoogleCalendarSettings {
  enabled: boolean;
  calendarId?: string;
  userEmail?: string;
  /** Ajout automatique dès la synchronisation */
  autoSync: boolean;
  /** Uniquement les événements Tier S/A */
  onlyImportant: boolean;
}

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface UserPreferences {
  /** Liste des sports sélectionnés par l'utilisateur */
  selectedSports: SportId[];
  /** Équipes favorites pour mise en avant */
  favoriteTeams: string[];
  /** Ligues favorites */
  favoriteLeagues: string[];
  /** Tier minimum à afficher par défaut */
  minTier: EventTier;
  notifications: NotificationSettings;
  googleCalendar: GoogleCalendarSettings;
  theme: ThemeMode;
  /** Langue de l'interface */
  language: 'fr' | 'en';
  /** Fuseau horaire automatique ou manuel */
  timezone?: string;
  /** Dernière synchronisation globale */
  lastSyncAt?: string;
}

// ======================== Filtres ========================

export interface EventFilters {
  sports?: SportId[];
  tiers?: EventTier[];
  leagues?: string[];
  teams?: string[];
  status?: EventStatus[];
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

// ======================== Navigation ========================

export type RootDrawerParamList = {
  MainTabs: undefined;
  Settings: undefined;
  About: undefined;
};

export type MainTabParamList = {
  Calendar: undefined;
  Today: undefined;
  Favorites: undefined;
  Live: undefined;
};

// ======================== API ========================

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  timestamp: string;
}

export interface SportProvider {
  id: string;
  name: string;
  fetchEvents(options: { from: Date; to: Date; sports?: SportId[] }): Promise<SportEvent[]>;
}
