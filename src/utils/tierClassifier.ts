import { EventTier, SportEvent, SportId } from '@app-types/index';
import { SPORTS_CATALOG } from '@constants/sports';

/**
 * Détermine le tier d'un événement à partir du nom de la ligue
 * et de la phase de compétition. Règles :
 *  - Tier S : ligues explicitement listées comme majeures (NBA, Ligue 1, CL...)
 *  - Tier A : mot "Final" dans le round
 *  - Tier B : mots "Semifinal", "Quarter", "Playoff", "Knockout"
 *  - Tier C : reste (matches réguliers, ligues secondaires)
 */
export function classifyEventTier(params: {
  sportId: SportId;
  league: string;
  round?: string;
  title?: string;
}): EventTier {
  const { sportId, league, round, title } = params;
  const meta = SPORTS_CATALOG[sportId];

  const leagueLower = league.toLowerCase();
  const roundLower = (round ?? '').toLowerCase();
  const titleLower = (title ?? '').toLowerCase();

  // 1. Tier S : ligues majeures (comparaison tolérante)
  if (
    meta?.tierSLeagues.some(
      (l) =>
        leagueLower.includes(l.toLowerCase()) ||
        titleLower.includes(l.toLowerCase())
    )
  ) {
    // Si c'est en plus une finale d'une ligue majeure, ça reste Tier S (priorité maximum)
    return 'S';
  }

  // 2. Tier A : finales
  if (
    roundLower.includes('final') ||
    titleLower.includes('final') ||
    titleLower.includes('finale')
  ) {
    // Une finale de ligue secondaire reste Tier A
    return 'A';
  }

  // 3. Tier B : playoffs, demi-finales, quarts, knockout
  const tierBKeywords = ['semi', 'demi', 'quarter', 'quart', 'playoff', 'knockout', 'élimination', 'elimination'];
  if (tierBKeywords.some((k) => roundLower.includes(k) || titleLower.includes(k))) {
    return 'B';
  }

  // 4. Par défaut : Tier C
  return 'C';
}

/**
 * Compare deux tiers. Retourne négatif si a < b (S < A < B < C).
 */
export function compareTiers(a: EventTier, b: EventTier): number {
  const order: Record<EventTier, number> = { S: 0, A: 1, B: 2, C: 3 };
  return order[a] - order[b];
}

/**
 * Détermine si un événement mérite une notification par défaut
 * (S ou A). Peut être affiné par les préférences utilisateur.
 */
export function isImportantEvent(event: SportEvent): boolean {
  return event.tier === 'S' || event.tier === 'A';
}
