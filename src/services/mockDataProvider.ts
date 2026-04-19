import { addDays, addHours, setHours, setMinutes } from 'date-fns';
import { SportEvent, SportProvider } from '@app-types/index';
import { classifyEventTier } from '@utils/tierClassifier';

/**
 * Provider de démonstration : génère des données réalistes localement.
 * Actif en permanence pour garantir une expérience "out of the box"
 * même sans clé API. Désactivable en commentant son entrée dans
 * `syncService.ts`.
 */

interface MockTemplate {
  sportId: SportEvent['sportId'];
  category: SportEvent['category'];
  league: string;
  title: (home: string, away: string) => string;
  teams: Array<[string, string]>;
  round?: string;
  venue?: string;
  broadcast?: string[];
  startHour: number;
  startMinute: number;
  daysOffset: number[];
}

const MOCK_TEMPLATES: MockTemplate[] = [
  {
    sportId: 'football',
    category: 'sport',
    league: 'UEFA Champions League',
    title: (h, a) => `${h} vs ${a}`,
    teams: [
      ['Real Madrid', 'Manchester City'],
      ['PSG', 'Bayern Munich'],
      ['Barcelona', 'Inter Milan'],
      ['Arsenal', 'Liverpool'],
    ],
    round: 'Quarter-Final',
    broadcast: ['Canal+', 'RMC Sport'],
    startHour: 21,
    startMinute: 0,
    daysOffset: [1, 3, 5, 8, 12],
  },
  {
    sportId: 'football',
    category: 'sport',
    league: 'French Ligue 1',
    title: (h, a) => `${h} - ${a}`,
    teams: [
      ['PSG', 'Marseille'],
      ['Lyon', 'Monaco'],
      ['Lille', 'Rennes'],
      ['Nice', 'Lens'],
    ],
    broadcast: ['Prime Video', 'beIN Sports'],
    startHour: 20,
    startMinute: 45,
    daysOffset: [0, 2, 6, 9, 13, 16],
  },
  {
    sportId: 'basketball',
    category: 'sport',
    league: 'NBA',
    title: (h, a) => `${h} @ ${a}`,
    teams: [
      ['Lakers', 'Warriors'],
      ['Celtics', 'Heat'],
      ['Nuggets', 'Bucks'],
      ['Knicks', 'Mavericks'],
      ['76ers', 'Suns'],
    ],
    broadcast: ['beIN Sports'],
    startHour: 1,
    startMinute: 30,
    daysOffset: [0, 1, 2, 3, 4, 5, 7, 9, 11],
  },
  {
    sportId: 'basketball',
    category: 'sport',
    league: 'EuroLeague',
    title: (h, a) => `${h} vs ${a}`,
    teams: [
      ['Real Madrid', 'FC Barcelona'],
      ['Panathinaikos', 'Olympiakos'],
      ['ASVEL', 'Monaco'],
    ],
    broadcast: ['Skweek'],
    startHour: 20,
    startMinute: 30,
    daysOffset: [2, 4, 7, 11],
  },
  {
    sportId: 'tennis',
    category: 'sport',
    league: 'ATP Masters 1000',
    title: (h, a) => `${h} vs ${a}`,
    teams: [
      ['Alcaraz', 'Sinner'],
      ['Djokovic', 'Medvedev'],
      ['Zverev', 'Rublev'],
    ],
    round: 'Semi-Final',
    startHour: 14,
    startMinute: 0,
    daysOffset: [1, 4, 8],
  },
  {
    sportId: 'formula1',
    category: 'sport',
    league: 'F1 World Championship',
    title: () => 'Grand Prix – Course',
    teams: [['', '']],
    round: 'Race',
    venue: 'Circuit de Monaco',
    broadcast: ['Canal+'],
    startHour: 15,
    startMinute: 0,
    daysOffset: [6, 20],
  },
  {
    sportId: 'formula1',
    category: 'sport',
    league: 'F1 World Championship',
    title: () => 'Grand Prix – Qualifications',
    teams: [['', '']],
    round: 'Qualifying',
    venue: 'Circuit de Monaco',
    broadcast: ['Canal+'],
    startHour: 15,
    startMinute: 0,
    daysOffset: [5, 19],
  },
  {
    sportId: 'rugby',
    category: 'sport',
    league: 'Six Nations',
    title: (h, a) => `${h} – ${a}`,
    teams: [
      ['France', 'Angleterre'],
      ['Irlande', 'Écosse'],
    ],
    broadcast: ['France 2'],
    startHour: 16,
    startMinute: 45,
    daysOffset: [5, 12],
  },
  {
    sportId: 'motogp',
    category: 'sport',
    league: 'MotoGP World Championship',
    title: () => 'Grand Prix MotoGP – Course',
    teams: [['', '']],
    round: 'Race',
    venue: 'Circuit de Jerez',
    broadcast: ['Canal+ Sport'],
    startHour: 14,
    startMinute: 0,
    daysOffset: [7, 21],
  },
  {
    sportId: 'handball',
    category: 'sport',
    league: 'EHF Champions League',
    title: (h, a) => `${h} vs ${a}`,
    teams: [['PSG Handball', 'Barça Handball'], ['Kielce', 'Magdeburg']],
    broadcast: ['beIN Sports'],
    startHour: 20,
    startMinute: 45,
    daysOffset: [3, 10],
  },
  // ============ Esports ============
  {
    sportId: 'lol',
    category: 'esport',
    league: 'LEC',
    title: (h, a) => `${h} vs ${a}`,
    teams: [
      ['G2 Esports', 'Fnatic'],
      ['MAD Lions', 'Team Vitality'],
      ['Rogue', 'Team BDS'],
    ],
    broadcast: ['Twitch LEC', 'YouTube LEC'],
    startHour: 19,
    startMinute: 0,
    daysOffset: [0, 1, 2, 7, 8, 9],
  },
  {
    sportId: 'lol',
    category: 'esport',
    league: 'Worlds',
    title: (h, a) => `${h} vs ${a}`,
    teams: [['T1', 'Gen.G'], ['JDG', 'BLG']],
    round: 'Semi-Final',
    broadcast: ['Twitch LoL Esports'],
    startHour: 13,
    startMinute: 0,
    daysOffset: [14, 18],
  },
  {
    sportId: 'valorant',
    category: 'esport',
    league: 'VCT EMEA',
    title: (h, a) => `${h} vs ${a}`,
    teams: [
      ['Team Liquid', 'Fnatic'],
      ['Team Heretics', 'Karmine Corp'],
      ['NAVI', 'KOI'],
    ],
    broadcast: ['Twitch VCT EMEA'],
    startHour: 18,
    startMinute: 0,
    daysOffset: [1, 3, 8, 10, 15],
  },
  {
    sportId: 'csgo',
    category: 'esport',
    league: 'IEM Katowice',
    title: (h, a) => `${h} vs ${a}`,
    teams: [['FaZe Clan', 'NAVI'], ['G2 Esports', 'Vitality']],
    round: 'Grand Final',
    broadcast: ['Twitch ESL'],
    startHour: 20,
    startMinute: 0,
    daysOffset: [6],
  },
  {
    sportId: 'dota2',
    category: 'esport',
    league: 'The International',
    title: (h, a) => `${h} vs ${a}`,
    teams: [['Team Spirit', 'Gaimin Gladiators']],
    round: 'Grand Final',
    broadcast: ['Twitch Dota2'],
    startHour: 12,
    startMinute: 0,
    daysOffset: [25],
  },
  {
    sportId: 'rocketleague',
    category: 'esport',
    league: 'RLCS Major',
    title: (h, a) => `${h} vs ${a}`,
    teams: [['Karmine Corp', 'Team BDS']],
    broadcast: ['Twitch RLCS'],
    startHour: 20,
    startMinute: 30,
    daysOffset: [9, 16],
  },
];

function generateId(template: MockTemplate, dayOffset: number, index: number): string {
  return `mock-${template.sportId}-${template.league}-${dayOffset}-${index}`
    .replace(/\s+/g, '_')
    .toLowerCase();
}

export const mockDataProvider: SportProvider = {
  id: 'mock-demo',
  name: 'Données de démonstration',

  async fetchEvents({ sports, from, to }) {
    const now = new Date();
    const events: SportEvent[] = [];

    for (const template of MOCK_TEMPLATES) {
      if (sports && !sports.includes(template.sportId)) continue;

      for (let i = 0; i < template.daysOffset.length; i++) {
        const offset = template.daysOffset[i];
        let date = addDays(now, offset);
        date = setHours(setMinutes(date, template.startMinute), template.startHour);

        if (date < from || date > to) continue;

        const teamPair = template.teams[i % template.teams.length];
        const [homeName, awayName] = teamPair;

        const title = template.title(homeName, awayName);
        const tier = classifyEventTier({
          sportId: template.sportId,
          league: template.league,
          round: template.round,
          title,
        });

        // Quelques matches deviennent "live" ou "finished" pour enrichir la démo.
        const hoursDiff = (date.getTime() - now.getTime()) / (1000 * 60 * 60);
        const status: SportEvent['status'] =
          hoursDiff < -2 ? 'finished'
          : hoursDiff < 0 ? 'live'
          : 'scheduled';

        events.push({
          id: generateId(template, offset, i),
          title,
          sportId: template.sportId,
          category: template.category,
          startDate: date.toISOString(),
          endDate: addHours(date, 2).toISOString(),
          league: template.league,
          tier,
          status,
          homeTeam: homeName ? { id: homeName, name: homeName, shortName: homeName } : undefined,
          awayTeam: awayName ? { id: awayName, name: awayName, shortName: awayName } : undefined,
          homeScore: status !== 'scheduled' ? Math.floor(Math.random() * 4) : undefined,
          awayScore: status !== 'scheduled' ? Math.floor(Math.random() * 4) : undefined,
          venue: template.venue,
          broadcast: template.broadcast,
          round: template.round,
          lastSyncedAt: new Date().toISOString(),
        });
      }
    }

    return events;
  },
};
