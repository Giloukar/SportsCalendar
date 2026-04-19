import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Clock, Calendar, Radio, Star, Settings } from 'lucide-react';
import { useEventsStore } from '@store/eventsStore';

/**
 * Layout persistant avec barre de navigation en bas (mobile/tablette).
 * Sur grand écran, la barre passe en latéral.
 */
export function Layout() {
  const liveCount = useEventsStore((s) => s.getLiveEvents().length);

  const tabs = [
    { to: '/', icon: Clock, label: 'À venir' },
    { to: '/calendar', icon: Calendar, label: 'Calendrier' },
    { to: '/live', icon: Radio, label: 'En direct', badge: liveCount > 0 ? liveCount : undefined },
    { to: '/favorites', icon: Star, label: 'Favoris' },
    { to: '/settings', icon: Settings, label: 'Réglages' },
  ];

  return (
    <div className="h-full flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950">
      {/* Barre latérale sur écrans larges */}
      <nav className="hidden md:flex flex-col w-56 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 py-6 px-3">
        <div className="px-3 mb-8">
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            Sport<span className="text-blue-600">Cal</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Sport + Esport</p>
        </div>
        <div className="flex flex-col gap-1">
          {tabs.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`
              }
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Contenu principal */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Barre inférieure sur mobile/tablette */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex pb-safe shadow-lg z-40">
        {tabs.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative transition-colors ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`
            }
          >
            <div className="relative">
              <Icon size={22} />
              {badge && (
                <span className="absolute -top-1 -right-2 text-[9px] font-bold bg-red-500 text-white px-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center">
                  {badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
