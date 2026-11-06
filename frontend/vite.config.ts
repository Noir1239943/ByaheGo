import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Xendit only sends people back to https addresses, so when a local certificate exists (see README, "Payments") the dev
// server uses it. Without one nothing changes: plain http on port 5173.
const certDir = fileURLToPath(new URL('./.cert', import.meta.url))
const https = existsSync(`${certDir}/localhost.pem`) ? { key: readFileSync(`${certDir}/localhost-key.pem`), cert: readFileSync(`${certDir}/localhost.pem`) } : undefined

/**
 * The website's Content-Security-Policy, written into index.html when building (the dev server needs inline scripts for hot reload, so
 * it has none). It only lets the page talk to itself, our API, OpenStreetMap (map tiles and address search) and Google Fonts, and it
 * allows WebAssembly and web workers for the face check and OCR. Frame, form and object rules that a <meta> tag can't carry are in
 * vercel.json. Set VITE_API_URL at build time so the API's address is included.
 */
function contentSecurityPolicy(apiUrl: string): Plugin {
  const api = new URL(apiUrl).origin
  const policy = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `img-src 'self' data: blob: https://*.tile.openstreetmap.org ${api}`,
    // data: and blob: are the app's own in-browser images (photos are resized and read back from memory); they can't reach any server.
    `connect-src 'self' data: blob: ${api} https://nominatim.openstreetmap.org`,
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'byahego-csp',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }],
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    contentSecurityPolicy(loadEnv(mode, process.cwd(), '').VITE_API_URL ?? 'http://localhost:8000'),
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
}))
