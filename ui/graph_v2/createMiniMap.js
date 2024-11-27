import gsap from 'gsap';

export function createMiniMap(camera, scene, nonBloomScene, markNeedsRender, controls) {

    // const {} = share3dDat();
    const mapSize = 150;
    const padding = 10;
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
  
    // Add click event listener to the canvas
    canvas.addEventListener("click", (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
  
      // Convert mini-map coordinates to world coordinates
      const worldX = (x / mapSize - 0.5) * 100;
      const worldZ = (y / mapSize - 0.5) * 100;
  
      // Store initial positions
      const startPos = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        targetX: controls.target.x,
        targetY: controls.target.y,
        targetZ: controls.target.z
      };
  
      // Animate to new position
      gsap.timeline()
        .to(startPos, {
          duration: 1,
          x: worldX,
          z: worldZ,
          targetX: worldX,
          targetZ: worldZ,
          ease: "power2.inOut",
          onUpdate: () => {
            camera.position.x = startPos.x;
            camera.position.z = startPos.z;
            controls.target.x = startPos.targetX;
            controls.target.z = startPos.targetZ;
            controls.update();
            markNeedsRender("immediate");
          }
        });
    });
  
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
  
    // Initial update
    updateMiniMap();
  
    // Return the update function
    return updateMiniMap;
  }