import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'url';

// Helper pour résoudre les chemins en ESM (remplace __dirname)
const resolve = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Sport Calendar',
        short_name: 'SportCal',
        description: 'Calendrier sportif et esportif avec notifications',
        theme_color: '#1E40AF',
        background_color: '#0B1120',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Force la mise à jour immédiate du service worker
        clientsClaim: true,
        skipWaiting: true,
        // Nettoie les anciens caches des versions précédentes
        cleanupOutdatedCaches: true,
        // Exclut hls.js du precache (trop gros, chargé à la demande)
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Les Netlify Functions ne doivent jamais être cachées
        navigateFallbackDenylist: [/^\/\.netlify\/functions\//],
        // Augmente la taille max (hls.js fait ~500 KB)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/www\.thesportsdb\.com\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sportsdb-api',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // hls.js dans son propre chunk pour lazy-loading efficace
          'hls': ['hls.js'],
        },
      },
    },
    // Pas de warning sur la taille (on sait que hls.js est gros)
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@': resolve('./src'),
      '@components': resolve('./src/components'),
      '@screens': resolve('./src/screens'),
      '@services': resolve('./src/services'),
      '@store': resolve('./src/store'),
      '@hooks': resolve('./src/hooks'),
      '@utils': resolve('./src/utils'),
      '@app-types': resolve('./src/types'),
      '@constants': resolve('./src/constants'),
      '@theme': resolve('./src/theme'),
    },
  },
  server: { host: true, port: 5173 },
});
