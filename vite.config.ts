import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the site at https://<user>.github.io/palavras-do-gabriel/
// For a root deploy (Netlify, Vercel...) build with BASE_PATH=/
const base = process.env.BASE_PATH ?? '/palavras-do-gabriel/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Palavras do Gabriel',
        short_name: 'Gabriel',
        description: 'Primeiras palavras em português, inglês e japonês',
        lang: 'pt-BR',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        theme_color: '#ffd166',
        background_color: '#fff7e6',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache every picture and every audio clip so the app works fully offline.
        globPatterns: ['**/*.{js,css,html,png,svg,ico,mp3,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
});
