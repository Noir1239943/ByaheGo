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
      registerType: 'autoUpdate',
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
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        globIgnores: ['models/**', 'tesseract/**'], // big face / OCR files are fetched on demand, not precached
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Only pictures shown through <img> tags, which carry no sign-in: these are the public vehicle photos. Private files
            // (licenses, trip photos) are loaded with the sign-in token, are never put in this shared cache, and are kept by the
            // browser's own HTTP cache for the signed-in user only.
            urlPattern: ({ url, request }) => request.destination === 'image' && url.pathname.startsWith('/api/media/'),
            handler: 'CacheFirst',
            options: { cacheName: 'vehicle-photos', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 14 } },
          },
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
