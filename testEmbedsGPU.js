// feature-extraction-worker.js

// import * as ort from 'onnxruntime-web';
// import * as ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/esm/ort.webgpu.min.js";
import {pipeline, AutoTokenizer, AutoModel, Tensor, mean_pooling, env } from '@xenova/transformers';

import * as ort from 'onnxruntime-web';
// ort.env.wasm.wasmPaths="/dist/"
ort.env.wasm.wasmPaths = "/onnxruntime-web/dist/esm/"
ort.env.wasm.logLevel = 'verbose';
// Set WASM path
// ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = false;

// ort.ready().then(() => {
//     console.log('ONNX Runtime initialized successfully');
// }).catch((error) => {
//     console.error('Failed to initialize ONNX Runtime:', error);
// });

// Utility functions
async function tryCache(cache, ...names) {
    for (let name of names) {
        try {
            let result = await cache.match(name);
            if (result) return result;
        } catch (e) {
            continue;
        }
    }
    return undefined;
}

function pathJoin(...parts) {
    parts = parts.map((part, index) => {
        if (index) {
            part = part.replace(new RegExp('^/'), '');
        }
        if (index !== parts.length - 1) {
            part = part.replace(new RegExp('/$'), '');
        }
        return part;
    })
    return parts.join('/');
}

export class PipelineSingleton {
    static task = 'feature-extraction';
    static model_name_or_path = 'Xenova/all-MiniLM-L6-v2';
    static quantized = false;
    static tokenizer = null;
    static model_buffer = null;
    static instance = null;

    static async getTokenizer(progress_callback = null) {
        env.allowLocalModels = false;
        if (this.tokenizer === null) {
            this.tokenizer = await AutoTokenizer.from_pretrained(this.model_name_or_path, {
                quantized: this.quantized,
                progress_callback
            });
        }
        return this.tokenizer;
    }
    // static async getModelBuffer(progress_callback = null) {
    //     env.allowLocalModels = false;
    //     if (this.model_buffer === null) {
    //       let cache = await caches.open('transformers-cache');
    //       let fileName = 'model';
    //       let modelFileName = `onnx/${fileName}${this.quantized ? '_quantized' : ''}.onnx`;
    //       const revision = 'main';
    
    //       let requestURL = pathJoin(this.model_name_or_path, modelFileName);
    //       let localPath = pathJoin(env.localModelPath, requestURL);
    
    //       let remoteURL = pathJoin(
    //         env.remoteHost,
    //         env.remotePathTemplate
    //           .replaceAll('{model}', this.model_name_or_path)
    //           .replaceAll('{revision}', encodeURIComponent(revision)),
    //         modelFileName
    //       );
    //       let proposedCacheKey = remoteURL;
    //       let response = await tryCache(cache, localPath, proposedCacheKey);
    
    //       if (response) {
    //         this.model_buffer = new Uint8Array(await response.arrayBuffer());
    //       } else {
    //         // If not in cache, fetch the model
    //         let model = await AutoModel.from_pretrained(this.model_name_or_path, {
    //           quantized: this.quantized,
    //           progress_callback
    //         });
    //         this.model_buffer = await model.serialize();
    //         model.dispose();
    
    //         // Cache the model for future use
    //         await cache.put(proposedCacheKey, new Response(this.model_buffer));
    //       }
    //     }
    //     return this.model_buffer;
    //   }
    // }

    static async getInstance(progress_callback = null) {
        env.allowLocalModels = false    //this is a must and if it's true by default for the first time, wrong data is cached to keep failing after this line is added, until the cache is cleared in browser!
        if (this.instance === null) {
            console.log(env)
            this.instance = pipeline(this.task, this.model_name_or_path, { quantized:this.quantized, progress_callback /*more options: https://huggingface.co/docs/transformers.js/api/utils/hub#module_utils/hub..PretrainedOptions*/});
        }

        return this.instance;
    };

    static async getTokenizer(progress_callback = null) {
        env.allowLocalModels = false    //this is a must and if it's true by default for the first time, wrong data is cached to keep failing after this line is added, until the cache is cleared in browser!
        if (this.tokenizer === null) {
            this.tokenizer = await AutoTokenizer.from_pretrained(this.model_name_or_path, {quantized:this.quantized, progress_callback});
        }
        return this.tokenizer;
    };
    static async getModelBuffer(progress_callback = null) {
        env.allowLocalModels = false    //this is a must and if it's true by default for the first time, wrong data is cached to keep failing after this line is added, until the cache is cleared in browser!
        if (this.model_buffer === null){
            let model = await AutoModel.from_pretrained(this.model_name_or_path, { quantized:this.quantized, progress_callback});
            model.dispose();
            let cache = await caches.open('transformers-cache');
            let fileName = 'model';
            let modelFileName = `onnx/${fileName}${this.quantized ? '_quantized' : ''}.onnx`;
            const revision = 'main';

            let requestURL = pathJoin(this.model_name_or_path, modelFileName);
            let localPath = pathJoin(env.localModelPath, requestURL);

            let remoteURL = pathJoin(
                env.remoteHost,
                env.remotePathTemplate
                    .replaceAll('{model}', this.model_name_or_path)
                    .replaceAll('{revision}', encodeURIComponent(revision)),
                modelFileName
            );
            let proposedCacheKey = remoteURL;
            let response = await tryCache(cache, localPath, proposedCacheKey);
            if (response)
                this.model_buffer = new Uint8Array(await response.arrayBuffer());

        }
        return this.model_buffer;
    }

    // static async getModelBuffer(progress_callback = null) {
    //     env.allowLocalModels = false    //this is a must and if it's true by default for the first time, wrong data is cached to keep failing after this line is added, until the cache is cleared in browser!
    //     if (this.model_buffer === null){
    //         let model = await AutoModel.from_pretrained(this.model_name_or_path, { quantized:this.quantized, progress_callback});
    //         model.dispose();
    //         let cache = await caches.open('transformers-cache');
    //         let fileName = 'model';
    //         let modelFileName = `onnx/${fileName}${this.quantized ? '_quantized' : ''}.onnx`;
    //         const revision = 'main';

    //         let requestURL = pathJoin(this.model_name_or_path, modelFileName);
    //         let localPath = pathJoin(env.localModelPath, requestURL);

    //         let remoteURL = pathJoin(
    //             env.remoteHost,
    //             env.remotePathTemplate
    //                 .replaceAll('{model}', this.model_name_or_path)
    //                 .replaceAll('{revision}', encodeURIComponent(revision)),
    //             modelFileName
    //         );
    //         let proposedCacheKey = remoteURL;
    //         let response = await tryCache(cache, localPath, proposedCacheKey);
    //         if (response)
    //             this.model_buffer = new Uint8Array(await response.arrayBuffer());

    //     }
    //     return this.model_buffer;
    // }
}
// Utility functions
// function validateInputs(session, inputs) {
//     const checkedInputs = Object.create(null);
//     const missingInputs = [];
//     for (const inputName of session.inputNames) {
//         const tensor = inputs[inputName];
//         if (!(tensor instanceof ort.Tensor)) {
//             missingInputs.push(inputName);
//             continue;
//         }
//         checkedInputs[inputName] = tensor;
//     }
//     if (missingInputs.length > 0) {
//         throw new Error(`Missing the following inputs: ${missingInputs.join(', ')}.`);
//     }
//     return checkedInputs;
// }

// async function sessionRun(session, inputs) {
//     const checkedInputs = validateInputs(session, inputs);
//     try {
//         let output = await session.run(checkedInputs);
//         return output;
//     } catch (e) {
//         console.error(`An error occurred during model execution: "${e}".`);
//         console.error('Inputs given to model:', checkedInputs);
//         throw e;
//     }
// }

// export async function encoderForward(session, model_inputs) {
//     const encoderFeeds = Object.create(null);
//     for (const key of session.inputNames) {
//         encoderFeeds[key] = model_inputs[key];
//     }
//     if (session.inputNames.includes('token_type_ids') && !encoderFeeds.token_type_ids) {
//         encoderFeeds.token_type_ids = new ort.Tensor(
//             'int64',
//             new BigInt64Array(encoderFeeds.input_ids.data.length),
//             encoderFeeds.input_ids.dims
//         );
//     }
//     return await sessionRun(session, encoderFeeds);
// }

export async function extractFeatures(text) {
    try {
      const tokenizer = await PipelineSingleton.getTokenizer(x => {
        console.log('Tokenizer progress:', x);
      });
      const modelBuffer = await PipelineSingleton.getModelBuffer(x => {
        console.log('Model progress:', x);
      });
  
      const model_inputs = await tokenizer(text, {
        padding: true,
        truncation: true,
      });
  
      // Create session, set options
      const webGpuOpt = {
        executionProviders: ['webgpu'],
        graphOptimizationLevel: 'all',
        enableCpuMemArena: false,
        enableMemPattern: false,
        executionMode: 'sequential',
        extra: {
          session: {
            use_ort_model_bytes_directly: '1',
          }
        }
      };
  
      const cpuOpt = {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
        enableMemPattern: true,
        executionMode: 'sequential',
        extra: {
          session: {
            use_ort_model_bytes_directly: '1',
          }
        }
      };
  
      let session;
      try {
        console.log("Trying WebGPU backend...");
        session = await ort.InferenceSession.create(modelBuffer, webGpuOpt);
      } catch (webGpuError) {
        console.warn("WebGPU initialization failed, falling back to CPU:", webGpuError);
        try {
          console.log("Trying CPU backend...");
          session = await ort.InferenceSession.create(modelBuffer, cpuOpt);
        } catch (cpuError) {
          console.error("CPU initialization also failed:", cpuError);
          throw new Error("Failed to initialize any backend.");
        }
      }
  
      console.log("Session created successfully");
  
      let encoder_outputs = await encoderForward(session, model_inputs);
      let result = encoder_outputs.last_hidden_state ?? encoder_outputs.logits;
      result = mean_pooling(result, model_inputs.attention_mask);
      result = result.normalize(2, -1);
  
      return result.data;
    } catch (error) {
      console.error('Error in extractFeatures:', error);
      throw error;
    }
  }


  
  //adapted from models.js
/**
 * Validate model inputs
 * @param {InferenceSession} session The InferenceSession object that will be run.
 * @param {Record<string, Tensor>} inputs The inputs to check.
 * @returns {Record<string, Tensor>} The checked inputs.
 * @throws {Error} If any inputs are missing.
 * @private
 */
function validateInputs(session, inputs) {
    /**
     * NOTE: Create either a shallow or deep copy based on `onnx.wasm.proxy`
     * @type {Record<string, Tensor>}
     */
    const checkedInputs = Object.create(null);
    const missingInputs = [];
    for (const inputName of session.inputNames) {
        const tensor = inputs[inputName];
        // Rare case where one of the model's input names corresponds to a built-in
        // object name (e.g., toString), which would cause a simple (!tensor) check to fail,
        // because it's not undefined but a function.
        if (!(tensor instanceof Tensor)) {
            missingInputs.push(inputName);
            continue;
        }
        // NOTE: When `env.wasm.proxy is true` the tensor is moved across the Worker
        // boundary, transferring ownership to the worker and invalidating the tensor.
        // So, in this case, we simply sacrifice a clone for it.
        //console.log(ort.env.wasm.proxy);//false on onnxruntime/webgpu 1.17.0
        //checkedInputs[inputName] = ort.env.wasm.proxy ? tensor.clone() : tensor;
        checkedInputs[inputName] =  new ort.Tensor(tensor.type, tensor.data, tensor.dims);
    }
    if (missingInputs.length > 0) {
        throw new Error(
            `An error occurred during model execution: "Missing the following inputs: ${missingInputs.join(', ')}.`);
    }

    const numInputsProvided = Object.keys(inputs).length;
    const numInputsNeeded = session.inputNames.length;
    if (numInputsProvided > numInputsNeeded) {
        // No missing inputs, but too many inputs were provided.
        // Warn the user and ignore the extra inputs.
        let ignored = Object.keys(inputs).filter(inputName => !session.inputNames.includes(inputName));
        console.warn(`WARNING: Too many inputs were provided (${numInputsProvided} > ${numInputsNeeded}). The following inputs will be ignored: "${ignored.join(', ')}".`);
    }

    return checkedInputs;
}
/**
 * Executes an InferenceSession using the specified inputs.
 * NOTE: `inputs` must contain at least the input names of the model.
 *  - If additional inputs are passed, they will be ignored.
 *  - If inputs are missing, an error will be thrown.
 * 
 * @param {InferenceSession} session The InferenceSession object to run.
 * @param {Object} inputs An object that maps input names to input tensors.
 * @returns {Promise<Object>} A Promise that resolves to an object that maps output names to output tensors.
 * @private
 */
async function sessionRun(session, inputs) {
    const checkedInputs = validateInputs(session, inputs);
    try {
        // @ts-ignore
        let output = await session.run(checkedInputs);
        return output;
    } catch (e) {
        // This usually occurs when the inputs are of the wrong type.
        console.error(`An error occurred during model execution: "${e}".`);
        console.error('Inputs given to model:', checkedInputs);
        throw e;
    }
}

/**
 * Forward pass of an encoder model.
 * @param {Object} ONNX session.
 * @param {Object} model_inputs The input data to be used for the forward pass.
 * @returns {Promise<Object>} Promise that resolves with an object containing the model's outputs.
 * @private
 */
export async function encoderForward(session, model_inputs) {
    const encoderFeeds = Object.create(null);
    for (const key of session.inputNames) {
        encoderFeeds[key] = model_inputs[key];
    }
    if (session.inputNames.includes('token_type_ids') && !encoderFeeds.token_type_ids) {
        // Assign default `token_type_ids` (all zeroes) to the `encoderFeeds` if the model expects it,
        // but they weren't created by the tokenizer.
        encoderFeeds.token_type_ids = new ort.Tensor(
            'int64',
            new BigInt64Array(encoderFeeds.input_ids.data.length),
            encoderFeeds.input_ids.dims
        )
    }
    return await sessionRun(session, encoderFeeds);
}