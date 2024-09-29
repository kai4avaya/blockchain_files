import { editor } from './quillEditor.js';
// import userActionStore from './memory/stores/userActionStore';
import { showPopup } from './ui/popup.js';
import { getObjectUnderPointer } from './ui/graph_v2/move';
import { initializeFileSystem, getFileSystem } from './memory/collaboration/file_colab';
import { sceneState } from './memory/collaboration/scene_colab';
import { initializeGraph, share3dDat } from './ui/graph_v2/create';
import { p2pSync } from './network/peer2peer_simple'; // Import the P2PSync class
import embeddingWorker from './ai/embeddings.js';
import { initiate } from './memory/vectorDB/vectorDbGateway.js'; // Assuming your initiate function is exported
// import {extractFeatures} from './testEmbedsGPU.js'

const userId = "kai";
localStorage.setItem("login_block", userId);

// Initialize Quill editor
editor();

const p2pSync_instance = p2pSync

// // For testing without HTML
// const testText = "This is a test sentence for feature extraction.";
// extractFeatures(testText).then(result => {
//     console.log('Extracted features:', result);
// }).catch(error => {
//     console.error('Error during feature extraction:', error);
// });
// main.js

// Create a new Web Worker
const worker = new Worker('./testEmbedsGPU_worker.js', { type: 'module' });

// Listen for messages from the worker
worker.addEventListener('message', (event) => {
  const data = event.data;

  if (data.status === 'update') {
    // Handle progress updates
    console.log('Progress update:', data.output);
  } else if (data.status === 'complete') {
    // Handle completion
    console.log('Feature extraction complete:', data.output);
    // You can parse the output if necessary
    const features = JSON.parse(data.output);
    console.log('Extracted features:', features);
  } else if (data.status === 'error') {
    // Handle errors
    console.error('Error from worker:', data.message);
  } else {
    // Handle other messages
    console.log('Message from worker:', data);
  }
});

// Send a sample text to the worker
const sampleText = `This is a sample text for feature extraction.;
Skip to Main Content

Search
Sign In
Home  Education Sector  Educator Developer Blog  Use WebGPU + ONNX Runtime Web + Transformer.js to build RAG applications by Phi-3-mini
Back to Blog Newer ArticleOlder Article 
Use WebGPU + ONNX Runtime Web + Transformer.js to build RAG applications by Phi-3-mini
By
kinfey
Kinfey Lo
Published Jul 15 2024 12:00 PM  4,438 Views
play
undefined
Phi-3-mini is deployed in different edge devices, such as iPhone/Android, AIPC/Copilot+PC, as well as cloud and IoT, citing the cross-platform and flexibility of SLM. If you want to follow these deployment methods, you can follow the content of the Phi-3 Cookbook. In model reference, computing power is essential. Through the quantized model, SLM can be deployed and run on a GPU or a traditional CPU. In this topic, we will focus on the model reference of WebGPU.

What's WebGPU？
“WebGPU is a JavaScript API provided by a web browser that enables webpage scripts to efficiently utilize a device's graphics processing unit. This is achieved with the underlying Vulkan, Metal, or Direct3D 12 system APIs. On relevant devices, WebGPU is intended to supersede the older WebGL standard.” - Wikipedia

WebGPU allows developers to leverage the power of modern GPUs to implement web-based graphics and general computing applications on all platforms and devices, including desktops, mobile devices, and VR/AR headsets. WebGPU not only has rich prospects in front-end applications, but is also an important scenario in the field of machine learning. For example, the familiar tensorflow.js uses WebGPU to run machine learning/deep learning acceleration.

Required environment
Support Google Chrome 113+, Microsoft Edge 113+, Safari 18 (macOS 15), Firefox Nightly

Enable WebGPU

Perform the following operations in the Chrome / Microsoft Edge address bar
The chrome://flags/#enable-unsafe-webgpu flag must be enabled (not enable-webgpu-developer-features). Linux experimental support also requires launching the browser with --enable-features=Vulkan.

Safari 18 (macOS 15) is enabled by default

Firefox Nightly Enter about:config in the address bar and set dom.webgpu.enabled to true

Use js script to check whether WebGPU is supported

if (!navigator.gpu) {
  throw new Error("WebGPU not supported on this browser.");
}

Why should Phi-3-mini run on WebGPU
We hope that the application scenarios are cross-platform, not just running on a single terminal. For example, the browser, as a cross-platform Internet access tool, can quickly expand our application scenarios. For Phi-3-mini, a quantized ONNX-enabled WebGPU model has been released, which can quickly build WebApp applications through NodeJS and ONNX Rutime Web. By combining WebGPU we can build Copilot applications very simply.

Learn about ONNX Runtime Web
ONNX Runtime Web enables you to run and deploy machine learning models in your web application using JavaScript APIs and libraries. This page outlines the general flow through the development process. You can also integrate machine learning into the server side of your web application with ONNX Runtime using other language libraries, depending on your application development environment.

Starting with ONNX Runtime 1.17, ONNX Runtime Web supports WebGPU acceleration, combining the quantized Phi-3-mini-4k-instruct-onnx-web model and Tranformer.js to build a Web-based Copilot application.

Transformer.js
Transformers.js is designed to be functionally equivalent to Hugging Face’s transformers python library, meaning you can run the same pretrained models using a very similar API. These models support common tasks in different modalities, such as:

Natural Language Processing: text classification, named entity recognition, question answering, language modeling, summarization, translation, multiple choice, and text generation.
Computer Vision: image classification, object detection, and segmentation.
Audio: automatic speech recognition and audio classification.
Multimodal: zero-shot image classification.
 
Transformers.js uses ONNX Runtime to run models in the browser. The best part about it, is that you can easily convert your pretrained PyTorch, TensorFlow, or JAX models to ONNX using Optimum.

Transformers.js has supported numerous models across Natural Language Processing, Vision, Audio, Tabular and Multimodal domains.

Build Phi-3-mini-4k-instruct-onnx-web RAG WebApp application
RAG applications are the most popular scenarios for generative artificial intelligence. This example hopes to integrate Phi-3-mini-4k-instruct-onnx-web and jina-embeddings-v2-base-en vector models to build WebApp applications to build solutions in multiple terminals plan.

thumbnail image 1 of blog post titled 
	
	
	 
	
	
	
				
		
			
				
						
							Use WebGPU + ONNX Runtime Web + Transformer.js to build RAG applications by Phi-3-mini
							
						
					
			
		
	
			
	
	
	
	
	

A. Create the Phi3SLM class

Using ONNX Runtime Web as the backend of Phi-3-mini-4k-instruct-onnx-web, I built phi3_slm.js with reference to llm.js. If you want to know the complete code, please visit https://github.com/microsoft/Phi-3CookBook/tree/main/code/08.RAG/rag_webgpu_chat. The following are some relevant points.

What is set here is the location of the model when Transformer.js calls the model, and whether access to the remote model is allowed.

    constructor() {

        env.localModelPath = 'models';
        env.allowRemoteModels = 0; // disable remote models
        env.allowLocalModels = 1; // enable local models

    }


ONNX Runtime Web Setting
The standard ONNX Runtime Web library includes the following WebAssembly binary files:

SIMD: whether the Single Instruction, Multiple Data (SIMD) feature is supported.

Multi-threading: whether the WebAssembly multi-threading feature is supported.

JSEP: whether the JavaScript Execution Provider (JSEP) feature is enabled. This feature powers the WebGPU and WebNN execution providers.

Training: whether the training feature is enabled.

When using WebGPU or WebNN execution provider, the ort-wasm-simd-threaded.jsep.wasm file is used.

So add the following content to phi3_slm.js


ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;
ort.env.wasm.wasmPaths = document.location.pathname.replace('index.html', '') + 'dist/';


And set it in webpack.config.js


    plugins: [
        // Copy .wasm files to dist folder
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'node_modules/onnxruntime-web/dist/*.jsep.*',
                    to: 'dist/[name][ext]'
                },
            ],
        })
    ],

To use WebGPU we need to set it in the ORT session
like


const session = await ort.InferenceSession.create(modelPath, { ..., executionProviders: ['webgpu'] });


For other text generation, please refer to async generate(tokens, callback, options)

B. Create RAG class

Calling the jina-embeddings-v2-base-en model through Transformer.js is consistent with Python use, but there are a few things to note.

jina-embeddings-v2-base-en It is recommended to use the model of https://huggingface.co/Xenova/jina-embeddings-v2-base-en, which will have better performance after adjustment.

Because a vector database is not used, the vector similarity calculation method is used directly to complete the embeding work. This is also the most original method.


async getEmbeddings(query,kbContents) { 

    const question = query;

    let sim_result = [];

    for(const content of kbContents) {
            const output = await this.extractor([question, content], { pooling: 'mean' });
            const sim = cos_sim(output[0].data, output[1].data);
            sim_result.push({ content, sim });
    }

    sim_result.sort((a, b) => b.sim - a.sim);

    var answer = '';

    console.log(sim_result);

    answer = sim_result[0].content;

    return answer;
}


Please place jina-embeddings-v2-base-en in models and phi-3 mini in the directory of models
thumbnail image 2 of blog post titled 
	
	
	 
	
	
	
				
		
			
				
						
							Use WebGPU + ONNX Runtime Web + Transformer.js to build RAG applications by Phi-3-mini
							
						
					
			
		
	
			
	
	
	
	
	

C. Running

thumbnail image 3 of blog post titled 
	
	
	 
	
	
	
				
		
			
				
						
							Use WebGPU + ONNX Runtime Web + Transformer.js to build RAG applications by Phi-3-mini
							
						
					
			
		
	
			
	
	
	
	
	

This application implements the RAG function by uploading markdown documents. We can see that it has good performance and effects in content generation.

If you wish to run the example you can visit this link Sample Code

Resources
Learning Phi-3-mini-4k-instruct-onnx-web https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-onnx-web

Learning ONNX Runtime Web https://onnxruntime.ai/docs/tutorials/web/

Learning WebGPU https://www.w3.org/TR/webgpu/

Reading Enjoy the Power of Phi-3 with ONNX Runtime on your device https://huggingface.co/blog/Emma-N/enjoy-the-power-of-phi-3-with-onnx-runtime

Official E2E samples https://github.com/microsoft/onnxruntime-inference-examples/tree/main/js/chat

 
You must be a registered user to add a comment. If you've already registered, sign in. Otherwise, register and sign in.

Comment
Co-Authors
kinfey
kinfey
Version history
Last update:	‎Jul 16 2024 02:38 AM
Updated by:	Lee_Stott
Labels
Node.js
5
ONNX
9
Phi-3
14
WebGPU
1
Share
Skip to Primary Navigation
What's new
Surface Pro 9
Surface Laptop 5
Surface Studio 2+
Surface Laptop Go 2
Surface Laptop Studio
Surface Duo 2
Microsoft 365
Windows 11 apps
Microsoft Store
Account profile
Download Center
Microsoft Store support
Returns
Order tracking
Virtual workshops and training
Microsoft Store Promise
Flexible Payments
Education
Microsoft in education
Devices for education
Microsoft Teams for Education
Microsoft 365 Education
Education consultation appointment
Educator training and development
Deals for students and parents
Azure for students
Business
Microsoft Cloud
Microsoft Security
Dynamics 365
Microsoft 365
Microsoft Power Platform
Microsoft Teams
Microsoft Industry
Small Business
Developer & IT
Azure
Developer Center
Documentation
Microsoft Learn
Microsoft Tech Community
Azure Marketplace
AppSource
Visual Studio
Company
Careers
About Microsoft
Company news
Privacy at Microsoft
Investors
Diversity and inclusion
Accessibility
Sustainability
 Your Privacy Choices
Sitemap Contact Microsoft Privacy Manage cookies Terms of use Trademarks Safety & eco About our ads © Microsoft 2024`
worker.postMessage({ text: sampleText });





async function main() {
  // const embeddingInitPromise = initializeEmbeddingModel();

  embeddingWorker.initialize();

  await initiate('vectorDB_new');

  await initializeFileSystem();
  const fileSystem = getFileSystem();

  fileSystem.onReady(() => {
    // Perform operations that require the file system
  });

  // Initialize the graph and SceneState
  await initializeGraph();

  const {
    renderer,
    scene,
    // camera,
    nonBloomScene,
    mouseOverlay,
  } = share3dDat();


  await sceneState.initialize(scene, nonBloomScene);


  if (!renderer) {
    console.error('Renderer is not initialized.');
    return;
  }


  // Get the canvas element from the renderer
  const canvas = renderer.domElement;

  p2pSync_instance.setMouseOverlay(mouseOverlay);

  addEventListeners(canvas);

}


function handleQuickClick(event) {
  const selectedObject = getObjectUnderPointer(event, "sphere");

  if (selectedObject) {
    const nodeId = selectedObject.userData.id;
    const fileSystem = getFileSystem();
    const fileMetadata = fileSystem.getMetadata(nodeId, 'file');

    if (fileMetadata) {
      showPopup(fileMetadata, event.clientX, event.clientY);
    } 
}
}

function addEventListeners(canvas) {
  let pointerDownTime = null;
  let isDragging = false;
  const CLICK_DURATION_THRESHOLD = 300; // milliseconds
  const DRAG_THRESHOLD = 10; // pixels

  let startX = 0;
  let startY = 0;

  canvas.addEventListener('pointerdown', event => {
    pointerDownTime = Date.now();
    startX = event.clientX;
    startY = event.clientY;
    isDragging = false;
    // userActionStore.setMouseDown(userId, true, event.clientX, event.clientY, event.target);
  }, { capture: true });

  canvas.addEventListener('pointerup', event => {
    if (pointerDownTime === null) {
      return;
    }

    const pointerUpTime = Date.now();
    const clickDuration = pointerUpTime - pointerDownTime;

    // userActionStore.setMouseDown(userId, false, event.clientX, event.clientY, event.target);

    if (!isDragging && clickDuration <= CLICK_DURATION_THRESHOLD) {
      handleQuickClick(event);
    } else {
      if (isDragging) {
      } else {
      }
    }

    // Log user action
    // userActionStore.updateMousePosition(userId, event.clientX, event.clientY, event.target);

    // Reset pointerDownTime
    pointerDownTime = null;
  }, { capture: true });

  canvas.addEventListener('pointermove', event => {
    if (pointerDownTime !== null) {
      const moveX = event.clientX - startX;
      const moveY = event.clientY - startY;
      const distance = Math.sqrt(moveX * moveX + moveY * moveY);

      if (distance > DRAG_THRESHOLD) {
        isDragging = true;
      }
    }
    if (p2pSync.isConnected()) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      console.log(`Local mouse move: (${x}, ${y})`);
      p2pSync.updateMousePosition(x, y);
    }
 

    // userActionStore.updateMousePosition(userId, event.clientX, event.clientY, event.target);
  });

  // Key events can remain on the window object
  window.addEventListener('keydown', event => {
    // userActionStore.addKeyPressed(userId, event.key);
  });
  window.addEventListener('keyup', event => {
    // userActionStore.removeKeyPressed(userId, event.key);
  });
}


main().catch(error => {
  console.error("Error in main function:", error);
});


// async function initializeEmbeddingModel() {
//   try {
//     await embeddingWorker.initialize();
//     console.log('Embedding worker initialized successfully');
//     // Continue with your app initialization
// } catch (error) {
//     console.error('Failed to initialize embedding worker:', error);
// }
// }

