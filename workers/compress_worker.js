// workers\compress_worker.js
let idleTimeout;

const terminateWorker = () => {
  clearTimeout(idleTimeout);
  self.close();
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

    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(terminateWorker, 30000);
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
};

async function createCompressionStream() {
  try {
    return new CompressionStream('brotli');
  } catch (e) {
    console.log('Brotli compression not supported, falling back to gzip');
    return new CompressionStream('gzip');
  }
}

async function createDecompressionStream(data) {
  // Attempt to detect the compression method used
  // You might want to pass this information along with the compressed data
  try {
    return new DecompressionStream('brotli');
  } catch (e) {
    console.log('Brotli decompression not supported, falling back to gzip');
    return new DecompressionStream('gzip');
  }
}

async function compressData(arrayBuffer) {
  const stream = await createCompressionStream();
  const writable = stream.writable.getWriter();
  writable.write(new Uint8Array(arrayBuffer));
  writable.close();
  const response = await new Response(stream.readable).arrayBuffer();
  return response;
}

async function decompressData(arrayBuffer) {
  const stream = await createDecompressionStream();
  const writable = stream.writable.getWriter();
  writable.write(new Uint8Array(arrayBuffer));
  writable.close();
  const response = await new Response(stream.readable).arrayBuffer();
  return response;
}