// workers\compress_worker.js

let idleTimeout;

const terminateWorker = () => {
  clearTimeout(idleTimeout);
  self.close(); // Terminates the worker
};

self.onmessage = async function (event) {
  const { action, data } = event.data;

  try {
    if (action === "compress") {
      const compressedData = await compressData(data);
      self.postMessage({ success: true, compressedData });
    } else if (action === "decompress") {
      const decompressedData = await decompressData(data);
      self.postMessage({ success: true, decompressedData });
    } else {
      throw new Error("Invalid action");
    }

    // Reset the idle timer
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(terminateWorker, 30000); // Close worker after 30 seconds of inactivity
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
};

async function compressData(arrayBuffer) {
  const stream = new CompressionStream("brotli");
  const writable = stream.writable.getWriter();
  writable.write(new Uint8Array(arrayBuffer));
  writable.close();
  const response = await new Response(stream.readable).arrayBuffer();
  return response;
}

async function decompressData(arrayBuffer) {
  const stream = new DecompressionStream("brotli");
  const writable = stream.writable.getWriter();
  writable.write(new Uint8Array(arrayBuffer));
  writable.close();
  const response = await new Response(stream.readable).arrayBuffer();
  return response;
}
