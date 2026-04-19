import { CalendarOff } from 'lucide-react';
import { ReactNode } from 'react';

interface EmptyStateProps {
  /** Icône déjà rendue, ex: <Heart size={44} /> */
  icon?: ReactNode;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const defaultIcon = <CalendarOff size={44} className="text-slate-400 dark:text-slate-500" />;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3 text-center">
      <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        {icon ?? defaultIcon}
      </div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-2">{title}</h3>
      {message && (
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs leading-relaxed">{message}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-3 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
