import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
// import { resolve } from 'path';
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
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // 8MB - increased from 5MB
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
    chunkSizeWarningLimit: 8000, // 8MB
    target: ['esnext'],
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunk into smaller pieces
          'vendor-core': ['three', '@codemirror/view', '@codemirror/state', '@codemirror/language'],
          'vendor-utils': ['marked', 'mermaid', 'compromise'],
          'vendor-ml': ['@xenova/transformers', 'onnxruntime-web'],
          'vendor-ui': ['gsap', 'boarding.js'],
          'vendor-network': ['socket.io-client', 'peerjs', 'y-webrtc'],
          // Other dependencies will go into a default vendor chunk
          'vendor-other': [
            'jspdf',
            'qrcode',
            'umap-js',
            'wink-nlp',
            'yjs',
            'density-clustering',
            'ml-knn'
          ]
        }
      }
    }
  }
});
