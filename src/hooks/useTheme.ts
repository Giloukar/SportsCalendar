import { useEffect } from 'react';
import { usePreferencesStore } from '@store/preferencesStore';

/**
 * Applique le thème (light/dark) à la racine HTML pour activer
 * le modifier `dark:` de Tailwind.
 */
export function useTheme() {
  const themeMode = usePreferencesStore((s) => s.preferences.theme);

  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const isDark =
        themeMode === 'dark' ||
        (themeMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

      root.classList.toggle('dark', isDark);

      // Ajuste la barre d'état PWA
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', isDark ? '#0B1120' : '#1E40AF');
      }
    };

    apply();

    if (themeMode === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [themeMode]);
}
