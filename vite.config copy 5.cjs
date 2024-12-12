import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig({
  resolve: {
    alias: {
      '@': '/'
    }
  },
  plugins: [
    wasm(),
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
        // Add other workers as needed
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
    }
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
