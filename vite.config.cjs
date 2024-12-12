import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import { resolve } from 'path';
import fs from 'fs';
import { VitePWA } from 'vite-plugin-pwa';

// Read manifest from file
const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf-8'));

export default defineConfig({
  plugins: [
    wasm(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*'],
      manifest,
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        globPatterns: [
          '**/*.{js,css,html}',
          'icons/*.{ico,png,svg}',
          'assets/*.{woff2,png,svg}'
        ],
        globIgnores: [
          '**/summary_worker*.js',
          'sw.js',
          'workbox-*.js'
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/workers\/.*\.js$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'workers-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 4000, // 4MB
    target: ['esnext'], // Updated target for top-level await support
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
});
