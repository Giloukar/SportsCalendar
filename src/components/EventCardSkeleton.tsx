/**
 * Skeleton de chargement pour les cartes d'événements.
 * Affiche une animation subtile pendant que la sync initiale remplit le cache.
 */
export function EventCardSkeleton() {
  return (
    <div className="w-full relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-pulse">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200 dark:bg-slate-700" />
      <div className="pl-4 pr-4 py-4 flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-[18px] h-[18px] rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
            </div>
          </div>
          <div className="h-5 w-8 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
        </div>
        <div className="flex gap-3">
          <div className="h-3 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * Liste de skeletons (3 cartes pour ne pas encombrer).
 */
export function EventListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}
