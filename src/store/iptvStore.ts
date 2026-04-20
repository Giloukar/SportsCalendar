import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  IptvChannel,
  IptvSourceConfig,
  BroadcastChannelMapping,
} from '../types/iptv';

/**
 * Store Zustand pour la fonctionnalité IPTV.
 *
 * Toutes les données (credentials inclus) sont stockées UNIQUEMENT sur
 * l'appareil de l'utilisateur via localStorage. Aucune synchronisation
 * réseau.
 *
 * ⚠️ Avertissement sécurité : les credentials Xtream sont stockés en clair
 * dans localStorage, ce qui est le standard des apps IPTV (Smarters fait
 * pareil). Tout script malveillant injecté pourrait les lire. C'est pour
 * ça qu'on n'utilise aucun tracker ni analytics et que le code est public.
 */

interface IptvState {
  /** Configuration de la source (M3U ou Xtream) */
  source: IptvSourceConfig | null;
  /** Liste des chaînes importées */
  channels: IptvChannel[];
  /** Correspondances manuelles définies par l'utilisateur */
  mappings: BroadcastChannelMapping[];
  /** État d'import en cours */
  isImporting: boolean;
  /** Dernière erreur d'import */
  lastImportError: string | null;

  // ── Actions ──
  setSource: (source: IptvSourceConfig | null) => void;
  setChannels: (channels: IptvChannel[]) => void;
  setImporting: (flag: boolean) => void;
  setImportError: (err: string | null) => void;
  /** Ajoute ou remplace une correspondance manuelle */
  setMapping: (broadcastName: string, iptvChannelId: string) => void;
  removeMapping: (broadcastName: string) => void;
  toggleChannelHidden: (channelId: string) => void;
  /** Supprime toutes les données IPTV (reset complet) */
  clearAll: () => void;
}

export const useIptvStore = create<IptvState>()(
  persist(
    (set) => ({
      source: null,
      channels: [],
      mappings: [],
      isImporting: false,
      lastImportError: null,

      setSource: (source) => set({ source }),
      setChannels: (channels) => set({ channels }),
      setImporting: (flag) => set({ isImporting: flag }),
      setImportError: (err) => set({ lastImportError: err }),

      setMapping: (broadcastName, iptvChannelId) =>
        set((state) => {
          const existing = state.mappings.filter(
            (m) => m.broadcastName.toLowerCase() !== broadcastName.toLowerCase()
          );
          return {
            mappings: [...existing, { broadcastName, iptvChannelId }],
          };
        }),

      removeMapping: (broadcastName) =>
        set((state) => ({
          mappings: state.mappings.filter(
            (m) => m.broadcastName.toLowerCase() !== broadcastName.toLowerCase()
          ),
        })),

      toggleChannelHidden: (channelId) =>
        set((state) => ({
          channels: state.channels.map((c) =>
            c.id === channelId ? { ...c, hidden: !c.hidden } : c
          ),
        })),

      clearAll: () =>
        set({
          source: null,
          channels: [],
          mappings: [],
          isImporting: false,
          lastImportError: null,
        }),
    }),
    {
      name: 'sportcal-iptv',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        source: state.source,
        channels: state.channels,
        mappings: state.mappings,
      }),
    }
  )
);
