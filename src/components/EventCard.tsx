import { Clock, MapPin, Tv, PlayCircle } from 'lucide-react';
import { SportEvent } from '@app-types/index';
import { formatTime, formatRelativeDate } from '@utils/dateUtils';
import { TierBadge } from './TierBadge';
import { SportIcon } from './SportIcon';
import { getTierDotColor } from '@theme/index';

interface EventCardProps {
  event: SportEvent;
  onClick?: (event: SportEvent) => void;
  showDate?: boolean;
}

/**
 * Détecte la plateforme de streaming à partir d'une URL.
 */
function detectPlatform(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('twitch')) return 'Twitch';
  if (lower.includes('youtube') || lower.includes('youtu.be')) return 'YouTube';
  if (lower.includes('afreeca')) return 'AfreecaTV';
  if (lower.includes('huya')) return 'Huya';
  if (lower.includes('kick.com')) return 'Kick';
  return 'Stream';
}

/**
 * Retourne la première diffusion lisible parmi les broadcasts (chaîne TV
 * ou plateforme de stream), en évitant d'afficher une URL brute.
 */
function firstBroadcastLabel(broadcasts?: string[]): { label: string; isStream: boolean } | null {
  if (!broadcasts || broadcasts.length === 0) return null;
  // Préférer une chaîne TV, sinon dériver de l'URL
  const tv = broadcasts.find((b) => !b.startsWith('http'));
  if (tv) return { label: tv, isStream: false };
  const stream = broadcasts.find((b) => b.startsWith('http'));
  if (stream) return { label: detectPlatform(stream), isStream: true };
  return null;
}

export function EventCard({ event, onClick, showDate }: EventCardProps) {
  const tierColor = getTierDotColor(event.tier);
  const isLive = event.status === 'live';
  const isFinished = event.status === 'finished';
  const hasScore = event.homeScore != null && event.awayScore != null;
  const broadcast = firstBroadcastLabel(event.broadcast);

  const handleTap = () => {
    // Vibration haptique discrète (uniquement si le navigateur supporte)
    // Vibration plus longue pour les matches live pour souligner l'urgence.
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(event.status === 'live' ? [30, 30, 30] : 15);
      } catch {}
    }
    onClick?.(event);
  };

  return (
    <button
      onClick={handleTap}
      className="w-full text-left relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md transition-all active:scale-[0.99]"
    >
      {/* Ruban coloré tier */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: tierColor }}
      />

      <div className="pl-4 pr-4 py-4 flex flex-col gap-2.5">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <SportIcon sportId={event.sportId} size={18} />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate tracking-wide">
                {event.league}
              </div>
              {event.round && (
                <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                  {event.round}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isLive && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-live" />
                LIVE
              </span>
            )}
            <TierBadge tier={event.tier} size="sm" showLabel={false} />
          </div>
        </div>

        {/* Corps : équipes ou titre */}
        <div>
          {event.homeTeam && event.awayTeam ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {event.homeTeam.name}
                </div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {event.awayTeam.name}
                </div>
              </div>
              {hasScore && (
                <div
                  className={`flex flex-col items-center justify-center min-w-[44px] px-2 py-1.5 rounded-lg border text-center ${
                    isLive
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-400'
                      : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                  }`}
                >
                  <span
                    className={`text-base font-bold ${
                      isFinished && (event.homeScore ?? 0) > (event.awayScore ?? 0)
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {event.homeScore}
                  </span>
                  <span
                    className={`text-base font-bold ${
                      isFinished && (event.awayScore ?? 0) > (event.homeScore ?? 0)
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {event.awayScore}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="font-semibold text-slate-900 dark:text-slate-100">{event.title}</div>
          )}
        </div>

        {/* Pied : heure + lieu + diffusion */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {showDate ? formatRelativeDate(event.startDate) : formatTime(event.startDate)}
          </span>
          {event.venue && (
            <span className="flex items-center gap-1 truncate max-w-[180px]">
              <MapPin size={12} />
              {event.venue}
            </span>
          )}
          {broadcast && (
            <span className={`flex items-center gap-1 truncate max-w-[140px] ${
              broadcast.isStream ? 'text-purple-600 dark:text-purple-400 font-semibold' : ''
            }`}>
              {broadcast.isStream ? <PlayCircle size={12} /> : <Tv size={12} />}
              {broadcast.label}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
