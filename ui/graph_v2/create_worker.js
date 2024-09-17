// main.js

// Create a visible canvas and append it to the DOM
const displayCanvas = document.createElement('canvas');
displayCanvas.id = "mainCanvas";
displayCanvas.width = window.innerWidth;
displayCanvas.height = window.innerHeight;
displayCanvas.style.position = 'absolute';
displayCanvas.style.top = '0';
displayCanvas.style.left = '0';
document.body.appendChild(displayCanvas);

// Transfer control of the canvas to OffscreenCanvas
const offscreen = displayCanvas.transferControlToOffscreen();

// Initialize the worker
const renderWorker = new Worker(new URL('../../workers/render_worker.js', import.meta.url), { type: 'module' });
console.log("Worker created");

// Send the OffscreenCanvas to the worker
renderWorker.postMessage({
  type: 'init',
  canvas: offscreen,
  width: window.innerWidth,
  height: window.innerHeight
}, [offscreen]);

// Listen for messages from the worker
renderWorker.onmessage = function(event) {
  const msg = event.data;
  switch (msg.type) {
    case 'initialized':
      console.log('Worker initialized successfully.');
      // Create a cube and a sphere after initialization
      createObject('cube');
      createObject('sphere');
      break;
    case 'error':
      console.error('Render worker error:', msg.message);
      console.error('Error stack:', msg.stack);
      break;
    default:
      console.warn('Unknown message type from worker:', msg.type);
  }
};

renderWorker.onerror = function(error) {
  console.error('Worker encountered an error:', error);
};

// Variables to handle camera controls
let isDragging = false;
let previousPointerPosition = { x: 0, y: 0 };

// Sensitivity factor
const rotationSensitivity = 0.01;

// Pointer event handlers
function onPointerDown(e) {
  isDragging = true;
  previousPointerPosition = {
    x: e.clientX,
    y: e.clientY
  };
  console.log('Pointer down:', previousPointerPosition);
}

function onPointerMove(e) {
  if (isDragging) {
    const deltaMove = {
      x: e.clientX - previousPointerPosition.x,
      y: e.clientY - previousPointerPosition.y
    };

    console.log('Pointer move, delta:', deltaMove);

    // Send the rotation delta to the worker
    const rotationMessage = {
      type: 'rotate',
      deltaX: deltaMove.x * rotationSensitivity,
      deltaY: deltaMove.y * rotationSensitivity
    };
    renderWorker.postMessage(rotationMessage);
    console.log('Rotation message sent to worker:', rotationMessage);

    previousPointerPosition = {
      x: e.clientX,
      y: e.clientY
    };
  }
}

function onPointerUp() {
  isDragging = false;
  console.log('Pointer up');
}

// Add pointer event listeners
displayCanvas.addEventListener("pointerdown", onPointerDown);
displayCanvas.addEventListener("pointermove", onPointerMove);
displayCanvas.addEventListener("pointerup", onPointerUp);
displayCanvas.addEventListener("pointerleave", onPointerUp);

// Function to create objects (cube or sphere)
function createObject(objectType) {
  const message = {
    type: 'createObject',
    object: objectType
  };
  renderWorker.postMessage(message);
  console.log('Create object message sent to worker:', message);
}

// Handle window resize
window.onresize = function () {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Adjust the display canvas CSS size
  displayCanvas.style.width = `${width}px`;
  displayCanvas.style.height = `${height}px`;

  // Inform the worker about the resize
  const resizeMessage = {
    type: 'resize',
    width: width,
    height: height
  };
  renderWorker.postMessage(resizeMessage);
  console.log('Resize message sent to worker:', resizeMessage);
};

// Prevent context menu on right-click
displayCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Log when the page is fully loaded
window.addEventListener('load', () => {
  console.log('Page fully loaded');
});