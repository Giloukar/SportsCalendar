import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Calendar, Download } from 'lucide-react';
import { useEventsStore } from '@store/eventsStore';
import { usePreferencesStore } from '@store/preferencesStore';
import { EventCard } from '@components/EventCard';
import { EmptyState } from '@components/EmptyState';
import { SPORTS_POPULARITY_FR } from '@constants/sports';
import { SportId, SportEvent } from '@app-types/index';
import { exportEventsToICS } from '@utils/icsExport';

export function FavoritesScreen() {
  const navigate = useNavigate();
  const events = useEventsStore((s) => s.events);
  const { favoriteTeams, favoriteLeagues } = usePreferencesStore((s) => s.preferences);

  const filtered = useMemo(() => {
    if (favoriteTeams.length === 0 && favoriteLeagues.length === 0) return [];
    const sportRank = (id: SportId) => {
      const idx = SPORTS_POPULARITY_FR.indexOf(id);
      return idx === -1 ? 999 : idx;
    };
    return events
      .filter((e) => {
        if (favoriteLeagues.includes(e.league)) return true;
        const teamIds = [e.homeTeam?.id, e.awayTeam?.id].filter(Boolean) as string[];
        const teamNames = [e.homeTeam?.name, e.awayTeam?.name].filter(Boolean) as string[];
        return (
          teamIds.some((id) => favoriteTeams.includes(id)) ||
          teamNames.some((name) => favoriteTeams.includes(name))
        );
      })
      .sort((a, b) => {
        // Live d'abord, puis à venir, puis terminés (récent d'abord)
        const rank = (s: SportEvent['status']) => (s === 'live' ? 0 : s === 'scheduled' ? 1 : 2);
        const rs = rank(a.status) - rank(b.status);
        if (rs !== 0) return rs;
        const dcmp = a.status === 'finished'
          ? b.startDate.localeCompare(a.startDate)
          : a.startDate.localeCompare(b.startDate);
        if (dcmp !== 0) return dcmp;
        return sportRank(a.sportId) - sportRank(b.sportId);
      });
  }, [events, favoriteTeams, favoriteLeagues]);

  const hasFavorites = favoriteTeams.length > 0 || favoriteLeagues.length > 0;

  /** Prochain match favori à venir (non terminé). */
  const nextMatch = useMemo(() => {
    return filtered.find((e) => e.status !== 'finished') ?? null;
  }, [filtered]);

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportEventsToICS(filtered, 'sportcal-favoris.ics');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            Vos favoris
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {filtered.length} événement{filtered.length > 1 ? 's' : ''}
          </p>
        </div>
        {filtered.length > 0 && (
          <button
            onClick={handleExport}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
            title="Exporter au format .ics"
          >
            <Download size={16} className="text-slate-600 dark:text-slate-300" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!hasFavorites ? (
          <EmptyState
            icon={<Heart size={44} className="text-slate-400 dark:text-slate-500" />}
            title="Aucun favori"
            message="Ouvrez la fiche d'un match et appuyez sur l'étoile pour suivre une équipe ou une ligue."
            actionLabel="Voir le calendrier"
            onAction={() => navigate('/')}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Calendar size={44} className="text-slate-400 dark:text-slate-500" />}
            title="Pas de match à venir"
            message="Aucun match prévu pour vos équipes/ligues favorites dans la fenêtre actuelle."
          />
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Widget compte à rebours */}
            {nextMatch && <CountdownWidget event={nextMatch} onClick={() => navigate(`/event/${encodeURIComponent(nextMatch.id)}`)} />}

            {/* Liste complète */}
            <div className="space-y-2">
              {filtered.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onClick={(e) => navigate(`/event/${encodeURIComponent(e.id)}`)}
                  showDate
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Widget affichant un compte à rebours live jusqu'au prochain match favori.
 * Se rafraîchit chaque seconde.
 */
function CountdownWidget({ event, onClick }: { event: SportEvent; onClick: () => void }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const target = new Date(event.startDate).getTime();
  const diffMs = target - now;

  // Si match en cours, afficher "EN DIRECT" au lieu du compte à rebours
  if (event.status === 'live') {
    return (
      <button
        onClick={onClick}
        className="w-full text-left rounded-xl bg-gradient-to-r from-red-600 to-red-700 p-4 shadow-md hover:shadow-lg transition-shadow"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse-live" />
          <span className="text-xs font-bold text-white uppercase tracking-widest">
            Votre match en direct
          </span>
        </div>
        <div className="text-lg font-bold text-white">
          {event.homeTeam && event.awayTeam
            ? `${event.homeTeam.name} vs ${event.awayTeam.name}`
            : event.title}
        </div>
        <div className="text-xs text-white/90 mt-0.5">{event.league}</div>
      </button>
    );
  }

  if (diffMs <= 0) return null;

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 p-4 shadow-md hover:shadow-lg transition-shadow"
    >
      <div className="text-xs font-bold text-white/80 uppercase tracking-widest mb-1">
        Prochain match favori
      </div>
      <div className="text-lg font-bold text-white leading-tight">
        {event.homeTeam && event.awayTeam
          ? `${event.homeTeam.name} vs ${event.awayTeam.name}`
          : event.title}
      </div>
      <div className="text-xs text-white/85 mt-0.5">{event.league}</div>
      <div className="flex gap-2 mt-3">
        <CountBlock label="J" value={days} />
        <CountBlock label="H" value={hours} />
        <CountBlock label="M" value={minutes} />
        <CountBlock label="S" value={seconds} />
      </div>
    </button>
  );
}

function CountBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 bg-white/15 backdrop-blur rounded-md py-1.5 text-center">
      <div className="text-xl font-bold text-white font-mono tabular-nums">
        {String(value).padStart(2, '0')}
      </div>
      <div className="text-[10px] text-white/80 uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}
