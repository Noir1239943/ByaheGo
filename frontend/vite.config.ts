import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Xendit only sends people back to https addresses, so when a local certificate exists (see README, "Payments") the dev
// server uses it. Without one nothing changes: plain http on port 5173.
const certDir = fileURLToPath(new URL('./.cert', import.meta.url))
const https = existsSync(`${certDir}/localhost.pem`) ? { key: readFileSync(`${certDir}/localhost-key.pem`), cert: readFileSync(`${certDir}/localhost.pem`) } : undefined

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt', // a new version waits until the person taps "Refresh" (see PwaStatus)
      includeAssets: ['icons/favicon-32.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'ByaheGo – Car Rental in Cebu',
        short_name: 'ByaheGo',
        description: 'Rent cars, SUVs, vans and motorcycles from trusted local hosts across Cebu.',
        theme_color: '#0D7C6B',
        background_color: '#F7F8FA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['travel', 'navigation'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app shell opens offline; the API is never routed to it and never cached.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        globIgnores: ['models/**', 'tesseract/**'], // big face / OCR files are fetched on demand, not precached
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          // No rule for /api/*: API answers, documents and photos are never stored by the service worker (they are
          // personal, and the browser's own HTTP cache already keeps public photos). Only map tiles, which are public:
          {
            urlPattern: ({ url }) => url.hostname.endsWith('tile.openstreetmap.org'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 7 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173, https },
})
