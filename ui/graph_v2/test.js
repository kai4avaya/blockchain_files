function updateMiniMap() {
    ctx.clearRect(0, 0, mapSize, mapSize);
  
    // Calculate bounds of all objects
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
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
  
    // Add some padding
    const padding = 10;
    minX -= padding; maxX += padding;
    minZ -= padding; maxZ += padding;
  
    // Calculate scale factor to fit all objects
    const scaleX = mapSize / (maxX - minX);
    const scaleZ = mapSize / (maxZ - minZ);
    const scaleFactor = Math.min(scaleX, scaleZ);
  
    // Function to convert world coordinates to mini-map coordinates
    function worldToMap(x, z) {
      return {
        x: (x - minX) * scaleFactor,
        y: mapSize - (z - minZ) * scaleFactor // Invert Y axis
      };
    }
  
    // Function to draw objects from a scene
    function drawSceneObjects(sceneToRender) {
      sceneToRecord.traverse((object) => {
        if (object.isMesh) {
          const { x, y } = worldToMap(object.position.x, object.position.z);
  
          let color;
          if (object.geometry.type === "IcosahedronGeometry") {
            color = 'red';
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
  
    // Draw camera position and viewpoint cone
    const { x: cameraX, y: cameraY } = worldToMap(camera.position.x, camera.position.z);
  
    // Draw camera position
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.arc(cameraX, cameraY, 5, 0, Math.PI * 2);
    ctx.fill();
  
    // Calculate view frustum
    const fov = camera.fov * Math.PI / 180;
    const aspect = camera.aspect;
    const zoom = camera.zoom;
    const gridSize = 1000; // Assuming this is the size of your grid, adjust if different
    const visibleDistance = (gridSize / 2) / zoom; // Half the grid size divided by zoom
  
    const nearDistance = 10 * scaleFactor;
    const farDistance = visibleDistance * scaleFactor;
  
    ctx.save();
    ctx.translate(cameraX, cameraY);
    ctx.rotate(-camera.rotation.y);
  
    // Draw viewpoint cone
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
    ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.tan(fov / 2) * aspect * nearDistance, -nearDistance);
    ctx.lineTo(Math.tan(fov / 2) * aspect * farDistance, -farDistance);
    ctx.lineTo(-Math.tan(fov / 2) * aspect * farDistance, -farDistance);
    ctx.lineTo(-Math.tan(fov / 2) * aspect * nearDistance, -nearDistance);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  
    ctx.restore();
  
    // Draw camera pitch indicator
    const pitchIndicatorSize = 30;
    const pitchX = 20;
    const pitchY = mapSize - 20;
  
    ctx.save();
    ctx.translate(pitchX, pitchY);
  
    // Draw the circular background
    ctx.beginPath();
    ctx.arc(0, 0, pitchIndicatorSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();
  
    // Draw the horizontal line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(-pitchIndicatorSize / 2, 0);
    ctx.lineTo(pitchIndicatorSize / 2, 0);
    ctx.stroke();
  
    // Calculate and draw the pitch line
    const pitchAngle = camera.rotation.x;
    const lineLength = pitchIndicatorSize / 2;
    const endY = -Math.sin(pitchAngle) * lineLength;
    const endX = Math.cos(pitchAngle) * lineLength;
  
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  
    // Add a dot at the end of the line for better visibility
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.arc(endX, endY, 2, 0, Math.PI * 2);
    ctx.fill();
  
    ctx.restore();
  
    // Draw a simple compass arrow
    const compassRadius = 15;
    const compassX = mapSize - compassRadius - 5;
    const compassY = compassRadius + 5;
  
    ctx.save();
    ctx.translate(compassX, compassY);
    ctx.rotate(-camera.rotation.y);
  
    ctx.strokeStyle = 'white';
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