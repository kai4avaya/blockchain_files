import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
// import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  resolve: {
    alias: {
      '@': '/'
    }
  },
  plugins: [
    wasm(),
   
  ],
  optimizeDeps: {
    include: [
      'onnxruntime-web',
      'compromise',
      'umap-js',
      'density-clustering',
      '@xenova/transformers',
      'pdfjs-dist/build/pdf'
    ]
  },
  build: {
    target: 'esnext',
    minify: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'worker': ['./memory/local/file_worker.ts']
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
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  base: '/'
});
