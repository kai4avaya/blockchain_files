import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  resolve: {
    alias: {
      '@': '/'
    }
  },
  plugins: [
    wasm()
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
        preserveModules: true,
        preserveModulesRoot: 'src'
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
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  base: '/'
});
