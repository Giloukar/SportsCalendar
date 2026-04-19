import { Search, X } from 'lucide-react';
import { EventTier, SportId } from '@app-types/index';
import { SPORTS_CATALOG, TIER_ORDER } from '@constants/sports';
import { TIER_COLORS } from '@theme/index';
import { SportIcon } from './SportIcon';

interface FilterBarProps {
  availableSports: SportId[];
  selectedSports: SportId[];
  onToggleSport: (sportId: SportId) => void;
  selectedTiers: EventTier[];
  onToggleTier: (tier: EventTier) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showSearch?: boolean;
}

/**
 * Barre de filtres : recherche + chips tiers + chips sports.
 */
export function FilterBar({
  availableSports,
  selectedSports,
  onToggleSport,
  selectedTiers,
  onToggleTier,
  searchQuery,
  onSearchChange,
  showSearch = true,
}: FilterBarProps) {
  return (
    <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 py-2 space-y-2">
      {showSearch && (
        <div className="mx-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 border border-transparent focus-within:border-blue-500 transition-colors">
          <Search size={18} className="text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher une équipe, ligue ou lieu…"
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
          />
          {searchQuery && (
            <button onClick={() => onSearchChange('')} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          )}
        </div>
      )}

      {/* Chips tiers */}
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-2 px-3 pb-1">
          {TIER_ORDER.map((tier) => {
            const isActive = selectedTiers.includes(tier);
            const colors = TIER_COLORS[tier];
            return (
              <button
                key={tier}
                onClick={() => onToggleTier(tier)}
                className={`shrink-0 px-3 py-1.5 rounded-full border-2 text-xs font-bold tracking-wide transition-colors ${
                  isActive
                    ? `${colors.bg} ${colors.border} text-white`
                    : `${colors.border} ${colors.text} bg-transparent`
                }`}
              >
                Tier {tier}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chips sports */}
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-2 px-3 pb-1">
          {availableSports.map((sportId) => {
            const meta = SPORTS_CATALOG[sportId];
            if (!meta) return null;
            const isActive = selectedSports.includes(sportId);
            return (
              <button
                key={sportId}
                onClick={() => onToggleSport(sportId)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-xs font-bold transition-colors"
                style={{
                  backgroundColor: isActive ? meta.color : 'transparent',
                  borderColor: meta.color,
                  color: isActive ? '#FFFFFF' : meta.color,
                }}
              >
                <SportIcon sportId={sportId} size={12} withBackground={false} />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
