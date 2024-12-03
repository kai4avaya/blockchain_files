function WorkerWrapper(options) {
          return new Worker(
            "/assets/umap_worker-CbUWVKbX.js",
            {
        type: "module",
        name: options?.name
      }
          );
        }

export { WorkerWrapper as default };
