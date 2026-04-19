import {
  Trophy, Gamepad2, Target, Bike, Car, Flame, Swords, Rocket, Crosshair, Crown, Smartphone,
} from 'lucide-react';
import { SportId } from '@app-types/index';
import { SPORTS_CATALOG } from '@constants/sports';

/**
 * Mapping SportId → composant d'icône lucide.
 * lucide-react n'a pas toutes les icônes spécifiques à chaque sport,
 * donc on utilise des équivalents visuels cohérents.
 */
const ICON_MAP: Record<SportId, typeof Trophy> = {
  football: Trophy,
  basketball: Trophy,
  tennis: Trophy,
  rugby: Trophy,
  formula1: Car,
  motogp: Bike,
  handball: Trophy,
  badminton: Trophy,
  volleyball: Trophy,
  baseball: Trophy,
  golf: Trophy,
  boxing: Flame,
  mma: Flame,
  cycling: Bike,
  athletics: Flame,
  nfl: Trophy,
  nhl: Trophy,
  // Esports
  lol: Swords,
  valorant: Target,
  csgo: Crosshair,
  dota2: Swords,
  rocketleague: Rocket,
  overwatch: Target,
  fifa: Gamepad2,
  starcraft: Rocket,
  r6siege: Crosshair,
  mobilelegends: Smartphone,
  pubg: Crosshair,
  pubgmobile: Smartphone,
  kingofglory: Crown,
  codblackops: Crosshair,
  freefire: Flame,
};

interface SportIconProps {
  sportId: SportId;
  size?: number;
  withBackground?: boolean;
  className?: string;
}

export function SportIcon({ sportId, size = 22, withBackground = true, className = '' }: SportIconProps) {
  const meta = SPORTS_CATALOG[sportId];
  if (!meta) return null;

  const Icon = ICON_MAP[sportId] ?? Trophy;

  if (!withBackground) {
    return <Icon size={size} color={meta.color} className={className} />;
  }

  const containerSize = size * 1.75;
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full ${className}`}
      style={{
        width: containerSize,
        height: containerSize,
        backgroundColor: `${meta.color}22`,
      }}
    >
      <Icon size={size} color={meta.color} />
    </div>
  );
}
