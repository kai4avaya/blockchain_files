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
// const worker = new Worker('./testEmbedsGPU_worker.js', { type: 'module' });

// // Listen for messages from the worker
// worker.addEventListener('message', (event) => {
//   const data = event.data;

//   if (data.status === 'update') {
//     // Handle progress updates
//     console.log('Progress update:', data.output);
//   } else if (data.status === 'complete') {
//     // Handle completion
//     console.timeEnd("NERD TIME")
//     console.log('Feature extraction complete:', data.output);
//     // You can parse the output if necessary
//     const features = JSON.parse(data.output);
//     console.log('Extracted features:', features);
//   } else if (data.status === 'error') {
//     // Handle errors
//     console.error('Error from worker:', data.message);
//   } else {
//     // Handle other messages
//     console.log('Message from worker:', data);
//   }
// });

// // Send a sample text to the worker
// const sampleText = `Hi Bisrat and Hagos,
// It was a pleasure to meet Haben. The​ purpose ​of this email is to summarize our meeting and describe next steps.

// INTEREST WEB
// Throughout our meeting, we used a number of visual diagramming practices to get to know each other. First, ​Haben created an interest web chart:


// image.png
// Haben described:

//     ​How he loves sports
//     He clearly benefits from moving his body throughout the day
//     I imagine sports helps him focus
//     We discussed his midfielder position in soccer
//     His interest in Euro Football.
//     Haben also likes music. He is learning the piano and finds Winter Wind (Chopin) calming).
//     Haben also likes reading -- including Harry Potter
//     He likes to draw
//     I noticed that Haben benefited from continual guidance through prompts to encourage him to add more details.
//     It is also clear that when given too many options, it was hard for Haben focus on the sequence that would allow him to complete the steps
//     However, once he understood the prompt, he was able to think deeply about his interests

// ACADEMICS 
// We used a flow chart to map out how ​Haben approaches academic work and the challenges that come up (we named the challenges 'glitches'). We considered the idea of a system and how that enables each part to depend on another part to accomplish a big goal.

// image.png
// Haben described how work is disseminated at BK Tech and how he generally approaches this (shown in the flow chart above):

//     Assignments discussed in class
//     The teachers will generally handout worksheets
//     ​Place handouts in bag
//     Bring them home to complete them
//     Turn them back in at school

// Haben described the challenges (aka glitches) that interrupt his flow (in the graph above these are represented as Glitches).
//  - He sometimes forgets assignments at school
//  - He gets stuck with homework because he does not understand them
// MINDFULNESS
// Haben and I discussed executive functions skills. We related this to mindfulness and looked at how a big process can be broken into smaller steps.
// We practiced mindfulness together. I described mindfulness as bringing awareness to the present moment. We imagined mindfulness ​by exploring how focusing on the senses allowed Haben to come back to the present moment. We brought attention to the body -- for example noticing all the sounds in the room, experiencing different physical sensations etc.

// AIMS
// ​Haben made a list of areas he'd like to focus on with a coach:


// image.png

// Haben described:

//     ​He wants to get better at organization
//     Over his overall executive function skills
//     We also discussed procrastination. Getting started on his work and staying more on task.

// NEXT STEPS
// It was a pleasure to work with ​Haben (and to reconnect, Bisrat and to meet you Hagos!). Haben should talk with you about how the meeting went. This work is best if the student feels some agency in making the decision to work with a coach.
 
// The next steps: If ​Haben is open to working with a coach: please let me know - we're happy to set something up. Generally, we'd aim to meet with Haben once a week (remotely I assume).

// Thank you so much for taking the time to meet me. I'm glad I got to meet Haben.

// Warmly,
// Kai
// `
// console.time("NERD TIME")

// worker.postMessage({ text: sampleText });





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

