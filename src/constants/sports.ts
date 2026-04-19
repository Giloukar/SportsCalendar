import { SportId, EventTier, SportCategory } from '@app-types/index';

/**
 * Métadonnées des sports et esports supportés.
 * L'ajout d'un nouveau sport se fait uniquement ici : le reste de
 * l'application s'adapte automatiquement (filtres, paramètres, UI).
 */
export interface SportMeta {
  id: SportId;
  label: string;
  category: SportCategory;
  icon: string; // Nom d'icône MaterialCommunityIcons
  color: string; // Couleur représentative du sport
  description: string;
  /** Ligues majeures Tier S pour ce sport */
  tierSLeagues: string[];
  /** Saison approximative (mois de début à mois de fin, 1-12, 0 = toute l'année) */
  season?: { start: number; end: number };
}

export const SPORTS_CATALOG: Record<SportId, SportMeta> = {
  // =============== Sports traditionnels ===============
  football: {
    id: 'football',
    label: 'Football',
    category: 'sport',
    icon: 'soccer',
    color: '#2E7D32',
    description: 'Ligue 1, Premier League, Liga, Champions League',
    tierSLeagues: ['UEFA Champions League', 'Ligue 1', 'Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'World Cup'],
    season: { start: 8, end: 5 },
  },
  basketball: {
    id: 'basketball',
    label: 'Basketball',
    category: 'sport',
    icon: 'basketball',
    color: '#E65100',
    description: 'NBA, EuroLeague, Betclic Elite',
    tierSLeagues: ['NBA', 'EuroLeague', 'NCAA March Madness'],
    season: { start: 10, end: 6 },
  },
  tennis: {
    id: 'tennis',
    label: 'Tennis',
    category: 'sport',
    icon: 'tennis',
    color: '#9CCC65',
    description: 'Grand Chelems ATP/WTA, Masters 1000',
    tierSLeagues: ['Roland Garros', 'Wimbledon', 'US Open', 'Australian Open', 'ATP Finals'],
    season: { start: 1, end: 11 },
  },
  rugby: {
    id: 'rugby',
    label: 'Rugby',
    category: 'sport',
    icon: 'rugby',
    color: '#4E342E',
    description: 'Top 14, Six Nations, Coupe du Monde',
    tierSLeagues: ['Six Nations', 'Rugby World Cup', 'Top 14', 'Champions Cup'],
    season: { start: 8, end: 6 },
  },
  formula1: {
    id: 'formula1',
    label: 'Formule 1',
    category: 'sport',
    icon: 'car-sports',
    color: '#C62828',
    description: 'Grands Prix du championnat du monde',
    tierSLeagues: ['F1 World Championship'],
    season: { start: 3, end: 12 },
  },
  motogp: {
    id: 'motogp',
    label: 'MotoGP',
    category: 'sport',
    icon: 'motorbike',
    color: '#D84315',
    description: 'Grands Prix MotoGP',
    tierSLeagues: ['MotoGP World Championship'],
    season: { start: 3, end: 11 },
  },
  handball: {
    id: 'handball',
    label: 'Handball',
    category: 'sport',
    icon: 'handball',
    color: '#1565C0',
    description: 'Liqui Moly StarLigue, EHF Champions League',
    tierSLeagues: ['EHF Champions League', 'World Championship', 'European Championship'],
    season: { start: 9, end: 6 },
  },
  badminton: {
    id: 'badminton',
    label: 'Badminton',
    category: 'sport',
    icon: 'badminton',
    color: '#00897B',
    description: 'BWF World Tour',
    tierSLeagues: ['BWF World Championships', 'All England Open'],
    season: { start: 0, end: 0 },
  },
  volleyball: {
    id: 'volleyball',
    label: 'Volleyball',
    category: 'sport',
    icon: 'volleyball',
    color: '#FFA726',
    description: 'Ligue A, FIVB World League',
    tierSLeagues: ['FIVB World Championship', 'CEV Champions League'],
    season: { start: 10, end: 5 },
  },
  baseball: {
    id: 'baseball',
    label: 'Baseball',
    category: 'sport',
    icon: 'baseball',
    color: '#5D4037',
    description: 'MLB',
    tierSLeagues: ['MLB World Series', 'MLB'],
    season: { start: 3, end: 10 },
  },
  golf: {
    id: 'golf',
    label: 'Golf',
    category: 'sport',
    icon: 'golf',
    color: '#558B2F',
    description: 'PGA Tour, Majors',
    tierSLeagues: ['Masters Tournament', 'US Open', 'The Open', 'PGA Championship', 'Ryder Cup'],
    season: { start: 1, end: 11 },
  },
  boxing: {
    id: 'boxing',
    label: 'Boxe',
    category: 'sport',
    icon: 'boxing-glove',
    color: '#B71C1C',
    description: 'Combats de championnat',
    tierSLeagues: ['WBC', 'WBA', 'IBF', 'WBO'],
    season: { start: 0, end: 0 },
  },
  mma: {
    id: 'mma',
    label: 'MMA / UFC',
    category: 'sport',
    icon: 'karate',
    color: '#880E4F',
    description: 'UFC, Bellator',
    tierSLeagues: ['UFC PPV', 'UFC Fight Night'],
    season: { start: 0, end: 0 },
  },
  cycling: {
    id: 'cycling',
    label: 'Cyclisme',
    category: 'sport',
    icon: 'bike',
    color: '#F9A825',
    description: 'Tour de France, Giro, Vuelta',
    tierSLeagues: ['Tour de France', 'Giro d\'Italia', 'Vuelta a España', 'Paris-Roubaix'],
    season: { start: 3, end: 10 },
  },
  athletics: {
    id: 'athletics',
    label: 'Athlétisme',
    category: 'sport',
    icon: 'run-fast',
    color: '#6A1B9A',
    description: 'Meetings Diamond League, Championnats',
    tierSLeagues: ['World Championships', 'Olympic Games', 'Diamond League Final'],
    season: { start: 5, end: 9 },
  },
  nfl: {
    id: 'nfl',
    label: 'NFL',
    category: 'sport',
    icon: 'football',
    color: '#013369',
    description: 'National Football League',
    tierSLeagues: ['Super Bowl', 'NFL Playoffs', 'NFL'],
    season: { start: 9, end: 2 },
  },
  nhl: {
    id: 'nhl',
    label: 'NHL / Hockey',
    category: 'sport',
    icon: 'hockey-sticks',
    color: '#111111',
    description: 'National Hockey League',
    tierSLeagues: ['Stanley Cup Finals', 'NHL Playoffs', 'NHL'],
    season: { start: 10, end: 6 },
  },

  // =============== Esports ===============
  lol: {
    id: 'lol',
    label: 'League of Legends',
    category: 'esport',
    icon: 'sword-cross',
    color: '#C89B3C',
    description: 'LEC, LCS, LCK, Worlds, MSI',
    tierSLeagues: ['Worlds', 'MSI', 'LEC', 'LCK', 'LCS', 'LPL'],
    season: { start: 1, end: 11 },
  },
  valorant: {
    id: 'valorant',
    label: 'Valorant',
    category: 'esport',
    icon: 'target',
    color: '#FF4655',
    description: 'VCT, Champions, Masters',
    tierSLeagues: ['VCT Champions', 'VCT Masters', 'VCT EMEA', 'VCT Americas', 'VCT Pacific'],
    season: { start: 1, end: 10 },
  },
  csgo: {
    id: 'csgo',
    label: 'Counter-Strike 2',
    category: 'esport',
    icon: 'pistol',
    color: '#F7941D',
    description: 'Majors, ESL Pro League, BLAST',
    tierSLeagues: ['CS Major', 'IEM Katowice', 'ESL Pro League', 'BLAST Premier'],
    season: { start: 0, end: 0 },
  },
  dota2: {
    id: 'dota2',
    label: 'Dota 2',
    category: 'esport',
    icon: 'shield-sword',
    color: '#A4252A',
    description: 'The International, DPC',
    tierSLeagues: ['The International', 'DPC Major', 'ESL One'],
    season: { start: 0, end: 0 },
  },
  rocketleague: {
    id: 'rocketleague',
    label: 'Rocket League',
    category: 'esport',
    icon: 'rocket-launch',
    color: '#00A8E8',
    description: 'RLCS',
    tierSLeagues: ['RLCS World Championship', 'RLCS Major'],
    season: { start: 0, end: 0 },
  },
  overwatch: {
    id: 'overwatch',
    label: 'Overwatch',
    category: 'esport',
    icon: 'crosshairs-gps',
    color: '#F99E1A',
    description: 'Overwatch Champions Series',
    tierSLeagues: ['OWCS Finals', 'OWCS Major'],
    season: { start: 0, end: 0 },
  },
  fifa: {
    id: 'fifa',
    label: 'EA FC / FIFA',
    category: 'esport',
    icon: 'soccer-field',
    color: '#00C853',
    description: 'eChampions League, FIFAe World Cup',
    tierSLeagues: ['FIFAe World Cup', 'eChampions League'],
    season: { start: 0, end: 0 },
  },
  starcraft: {
    id: 'starcraft',
    label: 'StarCraft II',
    category: 'esport',
    icon: 'rocket',
    color: '#0E6BA8',
    description: 'ESL Pro Tour, GSL',
    tierSLeagues: ['ESL Pro Tour', 'GSL'],
    season: { start: 0, end: 0 },
  },
};

/**
 * Liste ordonnée des sports à afficher dans l'UI.
 * Ordre stable et prévisible.
 */
export const SPORTS_LIST = Object.values(SPORTS_CATALOG);

export const SPORTS_BY_CATEGORY: Record<SportCategory, SportMeta[]> = {
  sport: SPORTS_LIST.filter(s => s.category === 'sport'),
  esport: SPORTS_LIST.filter(s => s.category === 'esport'),
};

// =========== Sélection par défaut pour un nouvel utilisateur ===========
export const DEFAULT_SELECTED_SPORTS: SportId[] = [
  'football',
  'basketball',
  'tennis',
  'formula1',
  'lol',
  'valorant',
];

// =========== Tiers ===========
export const TIER_LABELS: Record<EventTier, string> = {
  S: 'Tier S – Majeur',
  A: 'Tier A – Finale',
  B: 'Tier B – Phase finale',
  C: 'Tier C – Régulier',
};

export const TIER_DESCRIPTIONS: Record<EventTier, string> = {
  S: 'NBA, Ligue 1, Champions League, Worlds...',
  A: 'Finales et grandes phases décisives',
  B: 'Playoffs, demi-finales, quarts',
  C: 'Matches réguliers, ligues secondaires',
};

export const TIER_ORDER: EventTier[] = ['S', 'A', 'B', 'C'];
