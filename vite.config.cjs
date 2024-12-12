import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import { resolve } from 'path';
import fs from 'fs';
import { VitePWA } from 'vite-plugin-pwa';

// Read manifest from file
const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf-8'));

export default defineConfig({
  resolve: {
    alias: {
      '@': '/'
    }
  },
  plugins: [
    wasm(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest,
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/summary_worker*.js'],
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
      },
      pwaAssets: {
        disable: false,
        preset: {
          name: 'minimal-2023',
          shortName: 'Lumi',
          backgroundColor: '#ffffff',
          themeColor: '#007bff',
          preferRelatedApplications: false,
          screenshots: [],
          iconPurpose: ['any', 'maskable']
        },
        custom: {
          baseIcon: './src/assets/logo.svg',
          outDir: './public/icons',
          sizes: [72, 96, 128, 144, 152, 192, 384, 512],
          favicons: [16, 32],
          appleTouchIcon: 180
        }
      }
    }),
    {
      name: 'copy-workers',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'workers/memory_worker.js',
          source: fs.readFileSync(resolve(__dirname, 'workers/memory_worker.js'), 'utf-8')
        });
        this.emitFile({
          type: 'asset',
          fileName: 'workers/summary_worker.js',
          source: fs.readFileSync(resolve(__dirname, 'workers/summary_worker.js'), 'utf-8')
        });
      }
    }
  ],
  optimizeDeps: {
    include: [
      'onnxruntime-web',
      'compromise',
      'umap-js',
      'density-clustering',
      '@xenova/transformers',
      'pdfjs-dist/build/pdf'
    ],
    exclude: ['@xenova/transformers']
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'memory_worker': resolve(__dirname, 'workers/memory_worker.js'),
        'summary_worker': resolve(__dirname, 'workers/summary_worker.js'),
        // Add other workers here
      },
      output: {
        manualChunks: {
          'vendor': [
            'three',
            'onnxruntime-web',
            '@xenova/transformers'
          ],
          'codemirror': [
            '@codemirror/commands',
            '@codemirror/lang-markdown',
            '@codemirror/language',
            '@codemirror/state',
            '@codemirror/view'
          ]
        },
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name.includes('worker') 
            ? 'workers/[name].js'
            : '[name].[hash].js';
        }
      }
    },
    chunkSizeWarningLimit: 4000, // 4MB
  },
  worker: {
    format: 'es',
    plugins: () => [wasm()],
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  },
  experimental: {
    renderBuiltUrl(filename, { hostType }) {
      if (hostType === 'js' && filename.includes('worker')) {
        return { runtime: `new URL('${filename}', import.meta.url).href` };
      }
    }
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    },
    watch: {
      // Remove usePolling as it can cause performance issues
      included: ['**/codemirror_md_copy/**'],
      // Add these options to improve file watching
      usePolling: false,
      interval: 100,
      ignored: ['**/node_modules/**', '**/dist/**']
    },
    // Add HMR configuration
    hmr: {
      overlay: true,
      protocol: 'ws'
    }
  },
  base: '/'
});
