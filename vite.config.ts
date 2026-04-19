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
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/www\.thesportsdb\.com\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sportsdb-api',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/api\.pandascore\.co\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pandascore-api',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
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
