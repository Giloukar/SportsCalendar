import { EventTier } from '@app-types/index';

/**
 * Utilitaires de couleur pour les tiers.
 * Le reste du thème est géré par Tailwind (dark: modifier).
 */

export const TIER_COLORS: Record<EventTier, { bg: string; text: string; border: string; dot: string }> = {
  S: {
    bg: 'bg-rose-600',
    text: 'text-rose-600',
    border: 'border-rose-600',
    dot: '#D92D20',
  },
  A: {
    bg: 'bg-orange-500',
    text: 'text-orange-500',
    border: 'border-orange-500',
    dot: '#F97316',
  },
  B: {
    bg: 'bg-blue-600',
    text: 'text-blue-600',
    border: 'border-blue-600',
    dot: '#2563EB',
  },
  C: {
    bg: 'bg-slate-400',
    text: 'text-slate-400',
    border: 'border-slate-400',
    dot: '#94A3B8',
  },
};

export function getTierDotColor(tier: EventTier): string {
  return TIER_COLORS[tier].dot;
}
