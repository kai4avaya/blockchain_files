import { encoderForward, PipelineSingleton } from "./testEmbedsGPU";
// import * as ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/esm/ort.webgpu.min.js";

import * as ort from 'onnxruntime-web';
// ort.env.wasm.wasmPaths="/dist/"
ort.env.wasm.wasmPaths = "/onnxruntime-web/dist/esm/"
ort.env.wasm.logLevel = 'verbose';
self.addEventListener("message", async (event) => {
  let pipeline = await PipelineSingleton.getInstance((x) => {
    // We also add a progress callback to the pipeline so that we can
    // track model loading.
    self.postMessage(x);
  });

  let output = await pipeline(event.data.text, {
    pooling: "mean",
    normalize: true,

    // Allows for partial output
    callback_function: (x) => {
      console.log("update", x);
      self.postMessage({
        status: "update",
        output: JSON.stringify(x, null, 2),
      });
    },
  });

  // Send the output back to the main thread
  self.postMessage({
    status: "complete",
    output: JSON.stringify(output, null, 2),
  });

  const tokenizer = await PipelineSingleton.getTokenizer((x) => {
    // We also add a progress callback to the pipeline so that we can
    // track model loading.
    self.postMessage(x);
  });
  const model = await PipelineSingleton.getModelBuffer((x) => {
    // We also add a progress callback to the pipeline so that we can
    // track model loading.
    self.postMessage(x);
  });

  //adapted from pipeline.js FeatureExtractionPipeline._call(texts, {
  //     pooling = /** @type {'none'} */('none'),
  //     normalize = false,
  // } = {})
  const model_inputs = await tokenizer(event.data.text, {
    padding: true,
    truncation: true,
  });
  //console.log("input_ids=",model_inputs.input_ids);
  console.log("model_inputs=", model_inputs);

  // create session, set options
  const opt = {
    executionProviders: [
      {
        name: "webgpu",
        preferredLayout: "NHWC",
      },
    ],
    enableProfiling: false,
    enableMemPattern: false,
    enableCpuMemArena: false,
    extra: {
      session: {
        disable_prepacking: "1",
        use_device_allocator_for_initializers: "1",
        use_ort_model_bytes_directly: "1",
        use_ort_model_bytes_for_initializers: "1",
        disable_cpu_ep_fallback: "0",
      },
    },
    freeDimensionOverrides: { batch_size: 1 },
  };

  let session = await ort.InferenceSession.create(model, opt);
  console.log("session.inputNames", session.inputNames);
  console.log("session.outputNames", session.outputNames);

  let encoder_outputs = await encoderForward(session, model_inputs);
  console.log("encoder_outputs=", encoder_outputs);

  let result = encoder_outputs.last_hidden_state ?? encoder_outputs.logits;
  //pooling === 'mean'
  result = mean_pooling(result, model_inputs.attention_mask);
  //normalize === true
  result = result.normalize(2, -1);
  console.log("WebGPU result=", JSON.stringify(result, null, 2));
});
