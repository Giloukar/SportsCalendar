import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, format, addMonths, subMonths,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { SportEvent } from '@app-types/index';
import { getTierDotColor } from '@theme/index';

interface CalendarGridProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  currentMonth: Date;
  onChangeMonth: (month: Date) => void;
  events: SportEvent[];
}

/**
 * Grille calendrier maison, légère et fluide.
 * Chaque jour affiche jusqu'à 4 points colorés selon les tiers présents.
 */
export function CalendarGrid({
  selectedDate, onSelectDate, currentMonth, onChangeMonth, events,
}: CalendarGridProps) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { locale: fr });
    const end = endOfWeek(endOfMonth(currentMonth), { locale: fr });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  /**
   * Map jour (YYYY-MM-DD) → ensemble de couleurs de tiers présents.
   */
  const dotsByDay = useMemo(() => {
    const map = new Map<string, Set<string>>();
    events.forEach((e) => {
      const key = e.startDate.substring(0, 10);
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(getTierDotColor(e.tier));
    });
    return map;
  }, [events]);

  const weekDayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* En-tête : mois + navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <button
          onClick={() => onChangeMonth(subMonths(currentMonth, 1))}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </h2>
        <button
          onClick={() => onChangeMonth(addMonths(currentMonth, 1))}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 text-center py-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
        {weekDayLabels.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>

      {/* Jours */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dots = Array.from(dotsByDay.get(key) ?? []);
          const inMonth = isSameMonth(day, currentMonth);
          const isSelected = isSameDay(day, selectedDate);
          const todayFlag = isToday(day);

          return (
            <button
              key={key}
              onClick={() => onSelectDate(day)}
              className={`aspect-square flex flex-col items-center justify-start pt-2 relative transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : todayFlag
                  ? 'bg-blue-50 dark:bg-blue-900/30'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <span
                className={`text-sm font-semibold ${
                  isSelected
                    ? 'text-white'
                    : !inMonth
                    ? 'text-slate-300 dark:text-slate-600'
                    : todayFlag
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                {format(day, 'd')}
              </span>
              {dots.length > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {dots.slice(0, 4).map((color, i) => (
                    <span
                      key={i}
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: isSelected ? '#FFFFFF' : color }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Légende */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-3 flex-wrap text-[11px] text-slate-500 dark:text-slate-400">
        <span className="font-bold uppercase tracking-wider">Légende</span>
        {(['S', 'A', 'B', 'C'] as const).map((tier) => (
          <span key={tier} className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getTierDotColor(tier) }}
            />
            Tier {tier}
          </span>
        ))}
      </div>
    </div>
  );
}
