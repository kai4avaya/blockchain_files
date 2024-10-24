


// vite.config.js
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
//     include: ['onnxruntime-web', 'compromise'],
//     exclude: ['@xenova/transformers']
//   },
//   build: {
//     target: 'esnext',
//     minify: false,
//     commonjsOptions: {
//       include: [/node_modules/]
//     }
//   },
//   server: {
//     headers: {
//       'Cross-Origin-Opener-Policy': 'same-origin',
//       'Cross-Origin-Embedder-Policy': 'require-corp'
//     }
//   }
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
//     include: ['onnxruntime-web', 'compromise', 'umap-js','density-clustering'],
//     exclude: ['@xenova/transformers']
//   },
//   build: {
//     target: 'esnext',
//     minify: false,
//     commonjsOptions: {
//       include: [/node_modules/]
//     }
//   },
//   server: {
//     headers: {
//       'Cross-Origin-Opener-Policy': 'same-origin',
//       'Cross-Origin-Embedder-Policy': 'require-corp'
//     }
//   }
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
//     include: ['onnxruntime-web', 'compromise', 'umap-js', 'density-clustering'],
//     exclude: ['@xenova/transformers']
//   },
//   build: {
//     target: 'esnext',
//     minify: false,
//     commonjsOptions: {
//       include: [/node_modules/]
//     }
//   },
//   server: {
//     headers: {
//       'Cross-Origin-Opener-Policy': 'same-origin',
//       'Cross-Origin-Embedder-Policy': 'require-corp'
//     }
//   },
//   define: {
//     'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
//   }
// });

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
