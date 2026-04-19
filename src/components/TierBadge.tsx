import { EventTier } from '@app-types/index';
import { TIER_COLORS } from '@theme/index';

interface TierBadgeProps {
  tier: EventTier;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

/**
 * Badge coloré indiquant l'importance de l'événement.
 * Le Tier S utilise un fond dégradé rouge → doré pour un effet premium.
 */
export function TierBadge({ tier, size = 'md', showLabel = true, className = '' }: TierBadgeProps) {
  const colors = TIER_COLORS[tier];
  const isTierS = tier === 'S';

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-[10px]'
    : size === 'lg' ? 'px-3 py-1.5 text-sm'
    : 'px-2.5 py-1 text-xs';

  const baseClasses = `inline-flex items-center justify-center font-bold rounded tracking-wider text-white ${sizeClasses} ${className}`;

  if (isTierS) {
    return (
      <span
        className={`${baseClasses} tier-s-gradient border border-amber-400`}
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
      >
        {showLabel ? 'Tier S' : 'S'}
      </span>
    );
  }

  return (
    <span className={`${baseClasses} ${colors.bg}`}>
      {showLabel ? `Tier ${tier}` : tier}
    </span>
  );
}
