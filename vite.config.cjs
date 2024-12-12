import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import { resolve } from 'path';
import fs from 'fs';
import { VitePWA } from 'vite-plugin-pwa';

// Read manifest from file
const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf-8'));

export default defineConfig(({ command }) => ({
  plugins: [
    wasm(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*'],
      manifest,
      workbox: {
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        globPatterns: [
          '*.{js,css,html}',
          '**/*.{js,css,html}',
          'icons/*.{png,ico,svg}',
          'assets/*'
        ],
        globIgnores: [
          '**/summary_worker*.js',
          '**/sw.js',
          '**/workbox-*.js',
          '**/*.wasm',
          'assets/ort-wasm-*'
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
                maxAgeSeconds: 60 * 60 * 24
              }
            }
          },
          {
            urlPattern: /\.wasm$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html'
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 8000,
    target: ['esnext'],
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.trace'],
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-core': ['three', '@codemirror/view', '@codemirror/state', '@codemirror/language'],
          'vendor-utils': ['marked', 'mermaid', 'compromise'],
          'vendor-ml': ['@xenova/transformers', 'onnxruntime-web'],
          'vendor-ui': ['gsap', 'boarding.js'],
          'vendor-network': ['socket.io-client', 'peerjs', 'y-webrtc'],
          'vendor-other': [
            'jspdf',
            'qrcode',
            'umap-js',
            'wink-nlp',
            'yjs',
            'density-clustering',
            'ml-knn'
          ]
        },
        chunkFileNames: (chunkInfo) => {
          const id = chunkInfo.facadeModuleId || chunkInfo.moduleIds[0];
          if (id && id.includes('node_modules')) {
            const name = id.toString().split('node_modules/')[1].split('/')[0].replace('@', '');
            return `assets/${name}-[hash].js`;
          }
          return 'assets/[name]-[hash].js';
        },
        assetFileNames: (assetInfo) => {
          const { name } = assetInfo;
          if (/\.(png|jpe?g|gif|svg|ico)$/.test(name ?? '')) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/\.(woff2?|ttf|eot)$/.test(name ?? '')) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
      treeshake: {
        moduleSideEffects: true,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false
      },
    },
    sourcemap: false,
    cssCodeSplit: true,
    cssMinify: true,
    reportCompressedSize: true,
    assetsInlineLimit: 4096,
  },
  esbuild: {
    drop: ['console', 'debugger'],
    pure: ['console.log', 'console.info', 'console.debug', 'console.trace'],
    legalComments: 'none',
    minify: true,
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
    treeShaking: true,
  },
  publicDir: command === 'serve' ? 'dev-dist' : 'public',
}));
