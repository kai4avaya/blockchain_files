import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  resolve: {
    alias: {
      '@': '/'
    }
  },
  plugins: [
    wasm(),
    topLevelAwait()
  ],
  optimizeDeps: {
    include: [
      'onnxruntime-web',
      'compromise',
      'umap-js',
      'density-clustering',
      '@xenova/transformers'
    ]
  },
  build: {
    target: 'esnext',
    minify: false,
    commonjsOptions: {
      include: [/node_modules/]
    },
    rollupOptions: {
      output: {
        format: 'es'
      }
    }
  },
  worker: {
    format: 'es'
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
  }
});
