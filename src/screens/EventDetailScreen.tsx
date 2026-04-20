import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarPlus, Share2, Star, Clock, Trophy, MapPin, Info, Tv, ExternalLink, Shield, PlayCircle,
  TrendingUp, BarChart3, Play, ChevronRight,
} from 'lucide-react';
import { useEventsStore } from '@store/eventsStore';
import { usePreferencesStore } from '@store/preferencesStore';
import { useIptvStore } from '@store/iptvStore';
import { SPORTS_CATALOG, TIER_LABELS, TIER_DESCRIPTIONS } from '@constants/sports';
import { formatLongDate, formatTime, formatRelativeDate } from '@utils/dateUtils';
import { TierBadge } from '@components/TierBadge';
import { SportIcon } from '@components/SportIcon';
import { getTierDotColor } from '@theme/index';
import { googleCalendarService } from '@services/googleCalendarService';
import { fetchEventStats, EventStats, TeamForm, StandingEntry } from '@services/statsService';
import { findChannelsForBroadcast } from '@services/iptvMatchingService';
import { VideoPlayer } from '@components/VideoPlayer';
import { IptvChannel } from '../types/iptv';

export function EventDetailScreen() {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const event = useEventsStore((s) => (eventId ? s.getEventById(decodeURIComponent(eventId)) : undefined));
  const { favoriteTeams, favoriteLeagues } = usePreferencesStore((s) => s.preferences);
  const toggleFavoriteTeam = usePreferencesStore((s) => s.toggleFavoriteTeam);
  const toggleFavoriteLeague = usePreferencesStore((s) => s.toggleFavoriteLeague);

  // Stats détaillées (chargées en asynchrone depuis ESPN summary)
  const [stats, setStats] = useState<EventStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!event) return;
    setStatsLoading(true);
    fetchEventStats(event)
      .then((s) => setStats(s))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [event?.id]);

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

          {/* Diffusion TV avec IPTV intégré */}
          {tvChannels.length > 0 && (
            <BroadcastTvSection channels={tvChannels} />
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

          {/* Stats détaillées — visible uniquement si le provider ESPN a renvoyé des stats */}
          {(statsLoading || stats) && (
            <StatsSections
              loading={statsLoading}
              stats={stats}
              homeTeamName={event.homeTeam?.name}
              awayTeamName={event.awayTeam?.name}
            />
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

// ============== Sections de stats détaillées ==============

/**
 * Affiche les stats détaillées d'un événement :
 * - Classement de la ligue (standings)
 * - Forme récente des équipes (5 derniers matches)
 * - Leaders du match (si en cours/terminé)
 */
function StatsSections({
  loading,
  stats,
  homeTeamName,
  awayTeamName,
}: {
  loading: boolean;
  stats: EventStats | null;
  homeTeamName?: string;
  awayTeamName?: string;
}) {
  if (loading && !stats) {
    return (
      <InfoCard title="Historique et stats">
        <div className="text-xs text-slate-500 dark:text-slate-400 text-center py-2">
          Chargement des statistiques...
        </div>
      </InfoCard>
    );
  }

  if (!stats) return null;

  const hasAny = stats.standings?.length || stats.homeForm || stats.awayForm || stats.leaders?.length;
  if (!hasAny) return null;

  return (
    <>
      {/* Forme récente */}
      {(stats.homeForm || stats.awayForm) && (
        <InfoCard title="Forme récente">
          <div className="space-y-3">
            {stats.homeForm && <TeamFormRow form={stats.homeForm} fallbackName={homeTeamName} />}
            {stats.awayForm && <TeamFormRow form={stats.awayForm} fallbackName={awayTeamName} />}
          </div>
        </InfoCard>
      )}

      {/* Classement de la ligue */}
      {stats.standings && stats.standings.length > 0 && (
        <InfoCard title="Classement">
          <StandingsTable
            entries={stats.standings}
            highlightTeams={[homeTeamName, awayTeamName].filter(Boolean) as string[]}
          />
        </InfoCard>
      )}

      {/* Leaders / meilleurs joueurs */}
      {stats.leaders && stats.leaders.length > 0 && (
        <InfoCard title="Meilleurs joueurs">
          <div className="space-y-3">
            {stats.leaders.map((block, i) => (
              <div key={i}>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  {block.category}
                </div>
                <div className="space-y-0.5">
                  {block.players.map((p, j) => (
                    <div key={j} className="flex justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-300 truncate pr-2">
                        {p.name}
                      </span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white shrink-0">
                        {p.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </InfoCard>
      )}
    </>
  );
}

function TeamFormRow({ form, fallbackName }: { form: TeamForm; fallbackName?: string }) {
  const name = form.teamName || fallbackName || 'Équipe';
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <TrendingUp size={14} className="text-slate-400" />
        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate flex-1">
          {name}
        </span>
      </div>
      <div className="flex gap-1.5">
        {form.recentResults.length === 0 ? (
          <span className="text-xs text-slate-400">Aucun résultat récent</span>
        ) : (
          form.recentResults.map((r, i) => (
            <div
              key={i}
              className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${
                r.result === 'W' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : r.result === 'L' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
              title={`${r.result} ${r.score}${r.opponent ? ' vs ' + r.opponent : ''}`}
            >
              {r.result}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StandingsTable({
  entries,
  highlightTeams,
}: {
  entries: StandingEntry[];
  highlightTeams: string[];
}) {
  // On limite à 12 équipes par défaut, mais on force à inclure les 2 équipes du match
  const keepAll = entries.length <= 12;
  const visibleEntries = keepAll
    ? entries
    : entries.filter((e, i) =>
        i < 8 || highlightTeams.some((t) => e.team.toLowerCase() === t.toLowerCase())
      );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
            <th className="text-left py-1.5 pl-1">#</th>
            <th className="text-left py-1.5">Équipe</th>
            <th className="text-center py-1.5">V</th>
            <th className="text-center py-1.5">D</th>
            <th className="text-center py-1.5 pr-1">%</th>
          </tr>
        </thead>
        <tbody>
          {visibleEntries.map((e) => {
            const isHighlighted = highlightTeams.some((t) => e.team.toLowerCase() === t.toLowerCase());
            return (
              <tr
                key={e.teamId}
                className={`border-b border-slate-100 dark:border-slate-800 ${
                  isHighlighted ? 'bg-blue-50 dark:bg-blue-900/20 font-semibold' : ''
                }`}
              >
                <td className="py-1.5 pl-1 text-slate-500 dark:text-slate-400">{e.rank}</td>
                <td className="py-1.5 text-slate-900 dark:text-white truncate max-w-[150px]">{e.team}</td>
                <td className="text-center py-1.5 text-slate-700 dark:text-slate-300">{e.wins}</td>
                <td className="text-center py-1.5 text-slate-700 dark:text-slate-300">{e.losses}</td>
                <td className="text-center py-1.5 pr-1 font-mono text-slate-700 dark:text-slate-300">
                  {e.winPercent ? e.winPercent.toFixed(3) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============== Section Diffusion TV avec IPTV intégré ==============

/**
 * Affiche les diffuseurs TV en tant que boutons cliquables.
 * Au clic, cherche une correspondance dans les chaînes IPTV de l'utilisateur
 * et propose soit la lecture intégrée, soit une sélection si plusieurs candidats.
 */
function BroadcastTvSection({ channels }: { channels: string[] }) {
  const iptvChannels = useIptvStore((s) => s.channels);
  const mappings = useIptvStore((s) => s.mappings);
  const setMapping = useIptvStore((s) => s.setMapping);

  const [playingChannel, setPlayingChannel] = useState<IptvChannel | null>(null);
  const [selectingFor, setSelectingFor] = useState<string | null>(null);

  const hasIptv = iptvChannels.length > 0;

  const handleClick = (broadcast: string) => {
    if (!hasIptv) {
      alert(
        "Configurez votre abonnement IPTV dans Réglages → IPTV pour regarder directement dans SportCal."
      );
      return;
    }
    const matches = findChannelsForBroadcast(broadcast, iptvChannels, mappings, 5);
    if (matches.length === 0) {
      alert(`Aucune chaîne trouvée pour "${broadcast}" dans votre playlist IPTV.`);
      return;
    }
    // Si un match très fort et unique, lecture directe
    if (matches.length === 1 || matches[0].score >= 95) {
      setPlayingChannel(matches[0].channel);
    } else {
      // Plusieurs candidats : laisser l'utilisateur choisir
      setSelectingFor(broadcast);
    }
  };

  const candidates = selectingFor
    ? findChannelsForBroadcast(selectingFor, iptvChannels, mappings, 8)
    : [];

  return (
    <>
      <InfoCard title="Diffusion TV">
        <div className="flex flex-wrap gap-2">
          {channels.map((channel, i) => (
            <button
              key={i}
              onClick={() => handleClick(channel)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                hasIptv
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              {hasIptv ? <Play size={14} /> : <Tv size={14} />}
              {channel}
            </button>
          ))}
        </div>
        {!hasIptv && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            💡 Configurez vos chaînes IPTV dans Réglages pour les regarder en un clic.
          </p>
        )}
      </InfoCard>

      {/* Popup de sélection quand plusieurs correspondances */}
      {selectingFor && candidates.length > 0 && (
        <div
          className="fixed inset-0 bg-black/60 z-40 flex items-end md:items-center justify-center p-4"
          onClick={() => setSelectingFor(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Choisir la chaîne
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {selectingFor}
              </div>
            </div>
            <div className="p-2">
              {candidates.map((candidate) => (
                <button
                  key={candidate.channel.id}
                  onClick={() => {
                    // Mémorise ce choix pour la prochaine fois
                    setMapping(selectingFor, candidate.channel.id);
                    setPlayingChannel(candidate.channel);
                    setSelectingFor(null);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {candidate.channel.name}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {candidate.channel.group ?? '—'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Score : {candidate.score} · {candidate.reason}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setSelectingFor(null)}
                className="w-full py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lecteur vidéo plein écran */}
      {playingChannel && (
        <VideoPlayer channel={playingChannel} onClose={() => setPlayingChannel(null)} />
      )}
    </>
  );
}
