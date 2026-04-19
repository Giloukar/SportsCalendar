import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserPreferences, SportId, EventTier, NotificationSettings, GoogleCalendarSettings, ThemeMode } from '@app-types/index';
import { DEFAULT_SELECTED_SPORTS } from '@constants/sports';

/**
 * Version web du store de préférences. Persistance via localStorage
 * (au lieu de AsyncStorage). Même API que la version React Native.
 */

const DEFAULT_PREFERENCES: UserPreferences = {
  selectedSports: DEFAULT_SELECTED_SPORTS,
  favoriteTeams: [],
  favoriteLeagues: [],
  minTier: 'C',
  notifications: {
    enabled: true,
    reminderMinutes: [30, 10],
    onlyImportant: false,
    onLiveStart: true,
  },
  googleCalendar: {
    enabled: false,
    autoSync: false,
    onlyImportant: true,
  },
  theme: 'auto',
  language: 'fr',
};

interface PreferencesState {
  preferences: UserPreferences;
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  toggleSport: (sportId: SportId) => void;
  setSelectedSports: (sportIds: SportId[]) => void;
  toggleFavoriteTeam: (teamId: string) => void;
  toggleFavoriteLeague: (league: string) => void;
  setMinTier: (tier: EventTier) => void;
  setTheme: (theme: ThemeMode) => void;
  updateNotifications: (settings: Partial<NotificationSettings>) => void;
  updateGoogleCalendar: (settings: Partial<GoogleCalendarSettings>) => void;
  setLastSyncAt: (timestamp: string) => void;
  resetPreferences: () => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      preferences: DEFAULT_PREFERENCES,

      setPreferences: (prefs) =>
        set((state) => ({ preferences: { ...state.preferences, ...prefs } })),

      toggleSport: (sportId) =>
        set((state) => {
          const current = state.preferences.selectedSports;
          const isSelected = current.includes(sportId);
          return {
            preferences: {
              ...state.preferences,
              selectedSports: isSelected
                ? current.filter((s) => s !== sportId)
                : [...current, sportId],
            },
          };
        }),

      setSelectedSports: (sportIds) =>
        set((state) => ({
          preferences: { ...state.preferences, selectedSports: sportIds },
        })),

      toggleFavoriteTeam: (teamId) =>
        set((state) => {
          const current = state.preferences.favoriteTeams;
          return {
            preferences: {
              ...state.preferences,
              favoriteTeams: current.includes(teamId)
                ? current.filter((t) => t !== teamId)
                : [...current, teamId],
            },
          };
        }),

      toggleFavoriteLeague: (league) =>
        set((state) => {
          const current = state.preferences.favoriteLeagues;
          return {
            preferences: {
              ...state.preferences,
              favoriteLeagues: current.includes(league)
                ? current.filter((l) => l !== league)
                : [...current, league],
            },
          };
        }),

      setMinTier: (tier) =>
        set((state) => ({ preferences: { ...state.preferences, minTier: tier } })),

      setTheme: (theme) =>
        set((state) => ({ preferences: { ...state.preferences, theme } })),

      updateNotifications: (settings) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            notifications: { ...state.preferences.notifications, ...settings },
          },
        })),

      updateGoogleCalendar: (settings) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            googleCalendar: { ...state.preferences.googleCalendar, ...settings },
          },
        })),

      setLastSyncAt: (timestamp) =>
        set((state) => ({ preferences: { ...state.preferences, lastSyncAt: timestamp } })),

      resetPreferences: () => set({ preferences: DEFAULT_PREFERENCES }),
    }),
    {
      name: 'sportcalendar-preferences',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
