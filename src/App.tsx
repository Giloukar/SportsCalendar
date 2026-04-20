import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@components/Layout';
import { ErrorBoundary } from '@components/ErrorBoundary';
import { TodayScreen } from '@screens/TodayScreen';
import { CalendarScreen } from '@screens/CalendarScreen';
import { LiveScreen } from '@screens/LiveScreen';
import { FavoritesScreen } from '@screens/FavoritesScreen';
import { SettingsScreen } from '@screens/SettingsScreen';
import { IptvSettingsScreen } from '@screens/IptvSettingsScreen';
import { EventDetailScreen } from '@screens/EventDetailScreen';
import { useTheme } from '@hooks/useTheme';
import { notificationService } from '@services/notificationService';

/**
 * Racine de l'application. Monte le thème global et le routeur.
 * L'ErrorBoundary évite les écrans blancs en cas de crash React.
 */
export default function App() {
  useTheme();

  useEffect(() => {
    notificationService.initialize();

    // Force la vérification de mise à jour du service worker au démarrage
    // pour que les utilisateurs récupèrent automatiquement les nouvelles versions.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) reg.update().catch(() => {});
      });
    }
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<TodayScreen />} />
            <Route path="calendar" element={<CalendarScreen />} />
            <Route path="live" element={<LiveScreen />} />
            <Route path="favorites" element={<FavoritesScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
            <Route path="settings/iptv" element={<IptvSettingsScreen />} />
            <Route path="event/:eventId" element={<EventDetailScreen />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
