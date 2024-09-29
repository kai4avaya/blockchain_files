// // vite.config.js
// import { defineConfig } from 'vite';
// import wasm from 'vite-plugin-wasm';
// import topLevelAwait from 'vite-plugin-top-level-await';

// export default defineConfig({
//   resolve: {
//     alias: {
//       '@': '/'
//     }
//   },
//   plugins: [
//     wasm(),
//     topLevelAwait()
//   ],
// });
// import { defineConfig } from 'vite';
// import wasm from 'vite-plugin-wasm';
// import topLevelAwait from 'vite-plugin-top-level-await';

// export default defineConfig({
//   resolve: {
//     alias: {
//       '@': '/'
//     }
//   },
//   plugins: [
//     wasm(),
//     topLevelAwait()
//   ],
//   worker: {
//     format: 'es',
//     plugins: [
//       wasm(),
//       topLevelAwait()
//     ]
//   },
//   optimizeDeps: {
//     include: ['onnxruntime-web'],
//     exclude: ['@xenova/transformers']
//   },
//   build: {
//     target: 'esnext',
//     minify: false
//   },
//   server: {
//     headers: {
//       'Cross-Origin-Opener-Policy': 'same-origin',
//       'Cross-Origin-Embedder-Policy': 'credentialless'
//     }
//   }
// });


// vite.config.js
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
  worker: {
    format: 'es',
    plugins: [
      wasm(),
      topLevelAwait()
    ]
  },
  optimizeDeps: {
    include: ['onnxruntime-web'],
    exclude: ['@xenova/transformers']
  },
  build: {
    target: 'esnext',
    minify: false
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp' // Changed from 'credentialless'
    }
  }
});
