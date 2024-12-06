import gsap from 'gsap';



export function createMiniMap(camera, scene, nonBloomScene, markNeedsRender, controls) {

    // const {} = share3dDat();
    const mapSize = 150;
    const borderWidth = 2;
  
    // Create container div with the new class
    const container = document.createElement("div");
    container.className = "minimap-container";
    container.style.width = `${mapSize + 2 * borderWidth}px`;
    container.style.height = `${mapSize + 2 * borderWidth}px`;
    container.style.padding = `${borderWidth}px`;
    document.body.appendChild(container);
  
    // Add recenter button with animation
    const recenterBtn = document.createElement("button");
    recenterBtn.className = "minimap-recenter-btn";
    recenterBtn.innerHTML = "⌖";
    recenterBtn.title = "Recenter view";


// Add drag functionality
let isDragging = false;
let currentX;
let currentY;

container.addEventListener("mousedown", dragStart, { passive: false });

function dragStart(e) {
    if (e.target === recenterBtn) return; // Prevent dragging when clicking recenter button
    
    e.preventDefault();
    e.stopPropagation();
    
    isDragging = true;
    currentX = e.clientX - container.offsetLeft;
    currentY = e.clientY - container.offsetTop;
    container.style.transition = "none"; // Disable transitions while dragging
    
    // Disable OrbitControls while dragging minimap
    controls.enabled = false;
    
    // Add listeners only when dragging starts
    document.addEventListener("mousemove", drag, { capture: true });
    document.addEventListener("mouseup", dragEnd, { capture: true });
}

function drag(e) {
    if (!isDragging) return;

    e.preventDefault();
    e.stopPropagation();
    
    const newX = e.clientX - currentX;
    const newY = e.clientY - currentY;

    // Keep minimap within viewport bounds
    const maxX = window.innerWidth - container.offsetWidth;
    const maxY = window.innerHeight - container.offsetHeight;
    
    container.style.left = `${Math.min(Math.max(0, newX), maxX)}px`;
    container.style.top = `${Math.min(Math.max(0, newY), maxY)}px`;

    // Stop event propagation
    e.stopImmediatePropagation();
}

function dragEnd(e) {
    if (!isDragging) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    isDragging = false;
    container.style.transition = ""; // Re-enable transitions
    
    // Re-enable OrbitControls after dragging
    controls.enabled = true;
    
    // Remove listeners
    document.removeEventListener("mousemove", drag, { capture: true });
    document.removeEventListener("mouseup", dragEnd, { capture: true });

    // Stop event propagation
    e.stopImmediatePropagation();
}
  
    recenterBtn.addEventListener("click", (e) => {
      e.stopPropagation();
  
      // Store initial positions
      const startPos = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        targetX: controls.target.x,
        targetY: controls.target.y,
        targetZ: controls.target.z,
        zoom: camera.zoom
      };
  
      // Create animation timeline
      gsap.timeline()
        .to(startPos, {
          duration: 1,
          x: 0,
          y: 0,
          z: 20,
          targetX: 0,
          targetY: 0,
          targetZ: 0,
          zoom: 1,
          ease: "power2.inOut",
          onUpdate: () => {
            // Update camera position
            camera.position.set(startPos.x, startPos.y, startPos.z);
            // Update controls target
            controls.target.set(startPos.targetX, startPos.targetY, startPos.targetZ);
            // Update zoom
            camera.zoom = startPos.zoom;
            camera.updateProjectionMatrix();
            // Update controls and render
            controls.update();
            markNeedsRender("immediate");
          }
        });
    });
    
    container.appendChild(recenterBtn);
  
    // Create canvas with the new class
    const canvas = document.createElement("canvas");
    canvas.className = "minimap-canvas";
    canvas.width = mapSize;
    canvas.height = mapSize;
    container.appendChild(canvas);
  
    const ctx = canvas.getContext("2d");
  
    function updateMiniMap() {
        ctx.clearRect(0, 0, mapSize, mapSize);
  
        const centerX = mapSize / 2;
        const centerY = mapSize * 0.8; // Position camera dot near the bottom
  
        // Calculate bounds of all objects
        let minX = Infinity,
          maxX = -Infinity,
          minZ = Infinity,
          maxZ = -Infinity;
        function updateBounds(sceneToCheck) {
          sceneToCheck.traverse((object) => {
            if (object.isMesh) {
              minX = Math.min(minX, object.position.x);
              maxX = Math.max(maxX, object.position.x);
              minZ = Math.min(minZ, object.position.z);
              maxZ = Math.max(maxZ, object.position.z);
            }
          });
        }
        updateBounds(scene);
        updateBounds(nonBloomScene);
  
        // Add padding
        const padding = 50;
        minX -= padding;
        maxX += padding;
        minZ -= padding;
        maxZ += padding;
  
        // Ensure the view area is square
        const range = Math.max(maxX - minX, maxZ - minZ);
  
        // Calculate scale factor to fit all objects
        const scaleFactor = (mapSize * 0.6) / range; // 60% of map size to leave margin
  
        // Function to convert world coordinates to mini-map coordinates
        function worldToMap(x, z) {
          return {
            x: centerX + (x - camera.position.x) * scaleFactor,
            y: centerY - (z - camera.position.z) * scaleFactor,
          };
        }
  
        // Function to draw objects from a scene
        function drawSceneObjects(sceneToRender) {
          sceneToRender.traverse((object) => {
            if (object.isMesh) {
              const { x, y } = worldToMap(object.position.x, object.position.z);
  
              let color;
              if (object.geometry.type === "IcosahedronGeometry") {
                color = "red";
              } else if (object.geometry.type === "BoxGeometry") {
                color = object.material.color.getStyle();
              } else {
                return;
              }
  
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(x, y, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          });
        }
  
        // Draw objects from both scenes
        drawSceneObjects(scene);
        drawSceneObjects(nonBloomScene);
  
        // Calculate camera's visible range based on zoom
        const visibleRange = 100 / camera.zoom; // Adjust this factor as needed
        const cameraY = centerY + (visibleRange / 2) * scaleFactor;
  
        // Draw camera position
        ctx.fillStyle = "yellow";
        ctx.beginPath();
        ctx.arc(centerX, cameraY, 5, 0, Math.PI * 2);
        ctx.fill();
  
        // Calculate view frustum
        const fov = (camera.fov * Math.PI) / 180;
        const aspect = camera.aspect;
        const nearDistance = 10 * scaleFactor;
        const farDistance = visibleRange * scaleFactor;
  
        // Draw viewpoint cone
        ctx.strokeStyle = "rgba(255, 255, 0, 0.5)";
        ctx.fillStyle = "rgba(255, 255, 0, 0.1)";
        ctx.beginPath();
        ctx.moveTo(centerX, cameraY);
        ctx.lineTo(
          centerX + Math.tan(fov / 2) * aspect * nearDistance,
          cameraY - nearDistance
        );
        ctx.lineTo(
          centerX + Math.tan(fov / 2) * aspect * farDistance,
          cameraY - farDistance
        );
        ctx.lineTo(
          centerX - Math.tan(fov / 2) * aspect * farDistance,
          cameraY - farDistance
        );
        ctx.lineTo(
          centerX - Math.tan(fov / 2) * aspect * nearDistance,
          cameraY - nearDistance
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
  
        // Draw compass
        const compassRadius = 15;
        const compassX = mapSize - compassRadius - 5;
        const compassY = compassRadius + 5;
  
        ctx.save();
        ctx.translate(compassX, compassY);
        ctx.rotate(-camera.rotation.y);
  
        ctx.strokeStyle = "white";
        ctx.beginPath();
        ctx.moveTo(0, -compassRadius);
        ctx.lineTo(0, compassRadius);
        ctx.moveTo(0, -compassRadius);
        ctx.lineTo(-compassRadius / 2, 0);
        ctx.moveTo(0, -compassRadius);
        ctx.lineTo(compassRadius / 2, 0);
        ctx.stroke();
  
        ctx.restore();
    }
  
    // Add observer for chatSlideout
    const chatSlideout = document.getElementById('chatSlideout');
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (chatSlideout.classList.contains('active')) {
                    container.classList.add('slide-left');
                    const actionPanel = document.querySelector('.action-panel');
                    if (actionPanel) {
                        actionPanel.classList.add('slide-left');
                    }
                } else {
                    container.classList.remove('slide-left');
                    const actionPanel = document.querySelector('.action-panel');
                    if (actionPanel) {
                        actionPanel.classList.remove('slide-left');
                    }
                }
            }
        });
    });

    observer.observe(chatSlideout, {
        attributes: true,
        attributeFilter: ['class']
    });
  
    // Initial update
    updateMiniMap();
  
    // Return the update function
    return updateMiniMap;
  }


