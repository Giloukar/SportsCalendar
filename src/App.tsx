import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@components/Layout';
import { TodayScreen } from '@screens/TodayScreen';
import { CalendarScreen } from '@screens/CalendarScreen';
import { LiveScreen } from '@screens/LiveScreen';
import { FavoritesScreen } from '@screens/FavoritesScreen';
import { SettingsScreen } from '@screens/SettingsScreen';
import { EventDetailScreen } from '@screens/EventDetailScreen';
import { useTheme } from '@hooks/useTheme';
import { notificationService } from '@services/notificationService';

/**
 * Racine de l'application. Monte le thème global et le routeur.
 */
export default function App() {
  useTheme();

  useEffect(() => {
    notificationService.initialize();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<TodayScreen />} />
          <Route path="calendar" element={<CalendarScreen />} />
          <Route path="live" element={<LiveScreen />} />
          <Route path="favorites" element={<FavoritesScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="event/:eventId" element={<EventDetailScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
