import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarPlus, Share2, Star, Clock, Trophy, MapPin, Info, Tv, ExternalLink, Shield, PlayCircle,
} from 'lucide-react';
import { useEventsStore } from '@store/eventsStore';
import { usePreferencesStore } from '@store/preferencesStore';
import { SPORTS_CATALOG, TIER_LABELS, TIER_DESCRIPTIONS } from '@constants/sports';
import { formatLongDate, formatTime, formatRelativeDate } from '@utils/dateUtils';
import { TierBadge } from '@components/TierBadge';
import { SportIcon } from '@components/SportIcon';
import { getTierDotColor } from '@theme/index';
import { googleCalendarService } from '@services/googleCalendarService';

export function EventDetailScreen() {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const event = useEventsStore((s) => (eventId ? s.getEventById(decodeURIComponent(eventId)) : undefined));
  const { favoriteTeams, favoriteLeagues } = usePreferencesStore((s) => s.preferences);
  const toggleFavoriteTeam = usePreferencesStore((s) => s.toggleFavoriteTeam);
  const toggleFavoriteLeague = usePreferencesStore((s) => s.toggleFavoriteLeague);

  if (!event) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600 dark:text-slate-400 mb-4">Événement introuvable.</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
        >
          Retour
        </button>
      </div>
    );
  }

  const meta = SPORTS_CATALOG[event.sportId];
  const tierColor = getTierDotColor(event.tier);
  const isLeagueFavorite = favoriteLeagues.includes(event.league);
  const isHomeFavorite = !!event.homeTeam && favoriteTeams.includes(event.homeTeam.id);
  const isAwayFavorite = !!event.awayTeam && favoriteTeams.includes(event.awayTeam.id);
  const hasScore = event.homeScore != null && event.awayScore != null;

  /**
   * Séparation broadcasts :
   *  - Les URLs vont dans la section "Regarder en direct"
   *  - Les noms de chaînes TV vont dans la section "Diffusion TV"
   */
  const { streams, tvChannels } = partitionBroadcasts(event.broadcast, event.externalUrls);

  const handleShare = async () => {
    const teams = event.homeTeam && event.awayTeam
      ? `${event.homeTeam.name} vs ${event.awayTeam.name}`
      : event.title;
    const text = `${teams} – ${event.league}\n${formatRelativeDate(event.startDate)}`;
    if (navigator.share) {
      try { await navigator.share({ title: teams, text }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(text);
        alert('Copié dans le presse-papiers');
      } catch {
        alert(text);
      }
    }
  };

  const iconClass = 'text-slate-400 dark:text-slate-500 mt-0.5 shrink-0';

  return (
    <div className="pb-8">
      {/* Hero */}
      <div
        className="relative px-4 pt-12 pb-8 text-white"
        style={{
          background: event.tier === 'S'
            ? 'linear-gradient(135deg, #D92D20 0%, #F59E0B 100%)'
            : tierColor,
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <TierBadge tier={event.tier} size="md" />
        </div>

        <div className="text-center">
          <SportIcon sportId={event.sportId} size={36} withBackground={false} className="mx-auto mb-2" />
          <div className="text-sm font-bold uppercase tracking-widest opacity-90">
            {event.league}
          </div>
          {event.round && <div className="text-xs mt-1 opacity-80">{event.round}</div>}
        </div>

        {event.homeTeam && event.awayTeam ? (
          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="flex-1 text-center">
              <div className="text-xl font-bold">{event.homeTeam.name}</div>
            </div>
            <div className="text-center px-4">
              {hasScore ? (
                <div className="text-3xl font-extrabold">
                  {event.homeScore} – {event.awayScore}
                </div>
              ) : (
                <div className="text-2xl font-extrabold opacity-90">VS</div>
              )}
              <div className="text-sm opacity-85 mt-1">{formatTime(event.startDate)}</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-xl font-bold">{event.awayTeam.name}</div>
            </div>
          </div>
        ) : (
          <h1 className="mt-4 text-2xl font-bold text-center">{event.title}</h1>
        )}

        <p className="text-center mt-4 text-sm font-semibold opacity-95">
          {formatLongDate(event.startDate)}
        </p>
      </div>

      <div className="max-w-3xl mx-auto">
        {/* Grosse action "Regarder en live" si stream disponible */}
        {streams.length > 0 && (
          <div className="px-4 pt-4">
            <a
              href={streams[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full p-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white font-bold shadow-md transition-all"
            >
              <PlayCircle size={28} />
              <div className="flex-1 text-left">
                <div className="text-base">Regarder en direct</div>
                <div className="text-xs opacity-90 font-normal">{streams[0].label}</div>
              </div>
              <ExternalLink size={20} />
            </a>
            {streams.length > 1 && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {streams.slice(1).map((stream, i) => (
                  <a
                    key={i}
                    href={stream.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <PlayCircle size={16} className="text-purple-600 dark:text-purple-400" />
                    <span className="flex-1 truncate">{stream.label}</span>
                    <ExternalLink size={12} className="text-slate-400" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2 p-4">
          <ActionPill
            icon={<CalendarPlus size={20} />}
            label="Agenda"
            onClick={() => googleCalendarService.addToCalendar(event)}
          />
          <ActionPill
            icon={<Share2 size={20} />}
            label="Partager"
            onClick={handleShare}
          />
          <ActionPill
            icon={<Star size={20} fill={isLeagueFavorite ? 'currentColor' : 'none'} />}
            label="Ligue"
            onClick={() => toggleFavoriteLeague(event.league)}
            highlighted={isLeagueFavorite}
          />
        </div>

        {/* Informations */}
        <div className="px-4">
          <InfoCard title="Informations">
            <InfoRow
              icon={<Clock size={20} className={iconClass} />}
              label="Date et heure"
              value={formatRelativeDate(event.startDate)}
            />
            <InfoRow
              icon={<Trophy size={20} className={iconClass} />}
              label="Importance"
              value={TIER_LABELS[event.tier]}
              secondary={TIER_DESCRIPTIONS[event.tier]}
            />
            <InfoRow
              icon={<SportIcon sportId={event.sportId} size={20} withBackground={false} className="mt-0.5 shrink-0" />}
              label="Sport"
              value={meta.label}
            />
            {event.venue && (
              <InfoRow
                icon={<MapPin size={20} className={iconClass} />}
                label="Lieu"
                value={event.venue}
              />
            )}
            <InfoRow
              icon={<Info size={20} className={iconClass} />}
              label="Statut"
              value={
                event.status === 'live' ? '🔴 En direct'
                : event.status === 'finished' ? 'Terminé'
                : event.status === 'cancelled' ? 'Annulé'
                : event.status === 'postponed' ? 'Reporté'
                : 'À venir'
              }
            />
          </InfoCard>

          {/* Diffusion TV */}
          {tvChannels.length > 0 && (
            <InfoCard title="Diffusion TV">
              <div className="flex flex-wrap gap-2">
                {tvChannels.map((channel, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <Tv size={14} />
                    {channel}
                  </span>
                ))}
              </div>
            </InfoCard>
          )}

          {/* Équipes */}
          {(event.homeTeam || event.awayTeam) && (
            <InfoCard title="Équipes">
              <div className="space-y-2">
                {event.homeTeam && (
                  <TeamRow
                    name={event.homeTeam.name}
                    isFavorite={isHomeFavorite}
                    onToggle={() => toggleFavoriteTeam(event.homeTeam!.id)}
                  />
                )}
                {event.awayTeam && (
                  <TeamRow
                    name={event.awayTeam.name}
                    isFavorite={isAwayFavorite}
                    onToggle={() => toggleFavoriteTeam(event.awayTeam!.id)}
                  />
                )}
              </div>
            </InfoCard>
          )}
        </div>
      </div>
    </div>
  );
}

// ============== Utilitaires ==============

/**
 * Répartit les broadcasts en :
 *  - streams cliquables (URLs, avec label "Twitch", "YouTube"...)
 *  - chaînes TV (noms classiques sans URL)
 */
function partitionBroadcasts(
  broadcasts: string[] | undefined,
  externalUrls: Array<{ label: string; url: string }> | undefined
): { streams: Array<{ label: string; url: string }>; tvChannels: string[] } {
  const streams: Array<{ label: string; url: string }> = [];
  const tvChannels: string[] = [];

  // Priorité aux externalUrls (déjà structurés avec label/url par le provider)
  if (externalUrls && externalUrls.length > 0) {
    streams.push(...externalUrls);
  }

  if (broadcasts) {
    broadcasts.forEach((b) => {
      if (b.startsWith('http://') || b.startsWith('https://')) {
        // Éviter les doublons avec externalUrls
        if (!streams.some((s) => s.url === b)) {
          streams.push({ label: detectPlatform(b), url: b });
        }
      } else {
        if (!tvChannels.includes(b)) tvChannels.push(b);
      }
    });
  }

  return { streams, tvChannels };
}

function detectPlatform(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('twitch')) return 'Twitch';
  if (lower.includes('youtube') || lower.includes('youtu.be')) return 'YouTube';
  if (lower.includes('afreeca')) return 'AfreecaTV';
  if (lower.includes('huya')) return 'Huya';
  if (lower.includes('kick.com')) return 'Kick';
  return 'Stream';
}

// ============== Sous-composants ==============

function ActionPill({
  icon, label, onClick, highlighted,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  highlighted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 font-bold text-xs transition-colors ${
        highlighted
          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500 text-amber-600 dark:text-amber-400'
          : 'bg-white dark:bg-slate-800 border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
        {children}
      </div>
    </div>
  );
}

function InfoRow({
  icon, label, value, secondary,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
          {value}
        </div>
        {secondary && (
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{secondary}</div>
        )}
      </div>
    </div>
  );
}

function TeamRow({
  name, isFavorite, onToggle,
}: {
  name: string;
  isFavorite: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
    >
      <Shield size={22} className="text-blue-600 dark:text-blue-400" />
      <span className="flex-1 text-left font-semibold text-sm text-slate-900 dark:text-white">
        {name}
      </span>
      <Star
        size={22}
        className={isFavorite ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'}
        fill={isFavorite ? 'currentColor' : 'none'}
      />
    </button>
  );
}
