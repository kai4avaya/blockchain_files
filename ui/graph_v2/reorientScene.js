import * as THREE from "three";
import { gsap } from "gsap"; // Ensure GSAP is imported
import { normalizeAndScaleCoordinates } from '../../utils/sceneCoordsUtils.js'; // Adjust path as necessary
import {
    share3dDat,
    markNeedsRender,
    resizeCubeToFitSpheres
  } from "./create.js";
import { findAllSpheres, findAllCubes} from "./snapshot.js";
import { calculateDistance  } from "../../utils/utils";
import { createTrail, updateTrails } from './trail_effect.js';

// import {sendSceneBoundingBoxToWorker} from '../../ai/umap.js'


// Function to calculate the scene's bounding box
export function getSceneBoundingBox(scene) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
    scene.traverse(function (object) {
        if (object.isMesh) {
            const boundingBox = new THREE.Box3().setFromObject(object);
            minX = Math.min(minX, boundingBox.min.x);
            minY = Math.min(minY, boundingBox.min.y);
            minZ = Math.min(minZ, boundingBox.min.z);
            maxX = Math.max(maxX, boundingBox.max.x);
            maxY = Math.max(maxY, boundingBox.max.y);
            maxZ = Math.max(maxZ, boundingBox.max.z);
        }
    });
  
    // If scene is empty, use default bounds
    if (minX === Infinity || maxX === -Infinity) {
        const gridSize = 1000; // Replace with your actual grid size
        minX = minY = minZ = -gridSize / 2;
        maxX = maxY = maxZ = gridSize / 2;
    }
  
    return {
        min: { x: minX, y: minY, z: minZ },
        max: { x: maxX, y: maxY, z: maxZ }
    };
  }
  // Define minimum and maximum scale factors
  const MIN_SCALE = 1; // Minimum scale to prevent spheres from becoming too small
  const MAX_SCALE = 5; // Maximum scale for distant spheres
  
  // Define minimum and maximum distances for scaling
  const MIN_DISTANCE = 20; // Distance below which scaling starts
  const MAX_DISTANCE = 800; // Distance beyond which scaling stops increasing
  
  // Function to map distance to scale factor
  // Function to map distance to scale factor
  function getScaleFactor(distance) {
    // Clamp distance within min and max bounds
    distance = THREE.MathUtils.clamp(distance, MIN_DISTANCE, MAX_DISTANCE);
    
    // Linearly map distance to scale factor
    const scale = ((distance - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE)) * (MAX_SCALE - MIN_SCALE) + MIN_SCALE;
    
    return scale;
  }

  
  export function updateSphereAndCubePositions(reducedData, labels) {
    const { scene, nonBloomScene, camera } = share3dDat();
  
    // Get the scene's bounding box
    const sceneBoundingBox = getSceneBoundingBox(scene);
  
    // Normalize and scale the UMAP coordinates
    const scaledCoordinates = normalizeAndScaleCoordinates(reducedData, sceneBoundingBox);
  
    // Create a mapping from fileId (label) to scaled coordinates
    const idToCoordinates = {};
    for (let i = 0; i < labels.length; i++) {
      const fileId = labels[i];
      const coords = scaledCoordinates[i];
      idToCoordinates[fileId] = coords;
    }
  
    console.log("idToCoordinates", idToCoordinates);
  
    // Find all spheres
    const spheres = findAllSpheres([scene, nonBloomScene]);
  
    // Update sphere positions and scales using userData.id (fileId)
    spheres.forEach(sphere => {
      const fileId = sphere.userData.id;
      const coords = idToCoordinates[fileId];
      if (coords) {
        // Create a movement line (optional)
        const startPosition = sphere.position.clone();
        const endPosition = new THREE.Vector3(coords[0], coords[1], coords[2]);
        createMovementLine(startPosition, endPosition);
  
        // Create a ghost trail at the current position
        // createGhostTrail(sphere);
  
        // Animate position using GSAP
        gsap.to(sphere.position, {
          duration: 1.5,
          x: coords[0],
          y: coords[1],
          z: coords[2],
          ease: "power2.out",
          onUpdate: () => markNeedsRender(),
          onComplete: () => console.log(`Sphere ${fileId} moved to (${coords[0]}, ${coords[1]}, ${coords[2]})`)
        });
  
        // Calculate distance and scale factor
        const newPosition = new THREE.Vector3(coords[0], coords[1], coords[2]);
        const distance = calculateDistance(newPosition, camera.position);
        const scaleFactor = getScaleFactor(distance);
        console.log(`Sphere ${fileId} - Distance: ${distance.toFixed(2)}, Scale: ${scaleFactor.toFixed(2)}`);
  
        // Animate scale with capping
        if (scaleFactor < MIN_SCALE) {
          gsap.to(sphere.scale, {
            duration: 1.5,
            x: MIN_SCALE,
            y: MIN_SCALE,
            z: MIN_SCALE,
            ease: "power2.out",
            onUpdate: () => markNeedsRender(),
            onComplete: () => console.log(`Sphere ${fileId} scaled to minimum scale ${MIN_SCALE}`)
          });
        } else {
          gsap.to(sphere.scale, {
            duration: 1.5,
            x: scaleFactor,
            y: scaleFactor,
            z: scaleFactor,
            ease: "power2.out",
            onUpdate: () => markNeedsRender(),
            onComplete: () => console.log(`Sphere ${fileId} scaled to ${scaleFactor}`)
          });
        }
      } else {
        console.warn(`No coordinates found for sphere with fileId: ${fileId}`);
      }
    });
  
    // Update cube positions and sizes to fit the spheres
    const cubes = findAllCubes([scene, nonBloomScene]);
    cubes.forEach(cube => {
      resizeCubeToFitSpheres(cube);
    });
  
    // Adjust camera to fit the updated scene with animation
    adjustCameraToFitSceneAnimated();
  
    // Visualize the bounding box
    // visualizeBoundingBox(sceneBoundingBox);
  
    // Log each sphere's position
    spheres.forEach(sphere => {
      const pos = sphere.position;
      console.log(`Sphere ${sphere.userData.id} is at position: (${pos.x}, ${pos.y}, ${pos.z})`);
    });
  
    // Ensure the scene is re-rendered
    markNeedsRender();
  
    // Add animation loop for trails
    let lastTime = performance.now();
    function animate(currentTime) {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      
      updateTrails(deltaTime);
      markNeedsRender();
      
      requestAnimationFrame(animate);
    }
    
    // Start the animation loop
    requestAnimationFrame(animate);
  }
  
  
  
  // Function to create a ghost trail for a sphere
  function createGhostTrail(sphere) {
    // Clone the sphere's geometry and material
    const ghostMaterial = new THREE.MeshBasicMaterial({
      color: sphere.material.color,
      transparent: true,
      opacity: 0.5, // Semi-transparent
      depthWrite: false
    });
    const ghostSphere = new THREE.Mesh(sphere.geometry.clone(), ghostMaterial);
    
    // Set the ghost's position and scale to match the original sphere
    ghostSphere.position.copy(sphere.position);
    ghostSphere.scale.copy(sphere.scale);
    
    // Add the ghost to the scene
    scene.add(ghostSphere);
    
    // Animate the ghost's opacity to fade out
    gsap.to(ghostSphere.material, {
      duration: 20,
      opacity: 0,
      ease: "power2.out",
      onComplete: () => {
        scene.remove(ghostSphere);
        ghostSphere.geometry.dispose();
        ghostSphere.material.dispose();
      }
    });
  }
  
  
  // // Function to create a movement line for a sphere
  // function createMovementLine(startPosition, endPosition) {
  //   const { scene } = share3dDat();

  //   const material = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true });
  //   const points = [];
  //   points.push(startPosition.clone());
  //   points.push(endPosition.clone());
  //   const geometry = new THREE.BufferGeometry().setFromPoints(points);
  //   const line = new THREE.Line(geometry, material);
    
  //   scene.add(line);
    
  //   // Animate the line's opacity to fade out
  //   gsap.to(line.material, {
  //     duration: 20,
  //     opacity: 0,
  //     ease: "power2.out",
  //     onComplete: () => {
  //       scene.remove(line);
  //       geometry.dispose();
  //       material.dispose();
  //     }
  //   });
  // }


  
  // Function to create a movement line for a sphere
  function createMovementLine(startPosition, endPosition) {
    // Create particle trail instead of line
    createTrail(startPosition, endPosition, 30); // Adjust number of particles as needed
  }
  
  
  
  // function addAxesHelper() {
  //   const axesHelper = new THREE.AxesHelper(50); // Adjust size as needed
  //   axesHelper.name = 'AxesHelper';
  //   scene.add(axesHelper);
  //   console.log("Axes Helper added to the scene.");
  // }
  function addAxesHelper() {
    const axesHelper = new THREE.AxesHelper(50); // Adjust size as needed
    
    // Update vertex colors for each axis: 6 vertices (2 per axis)
    const colors = axesHelper.geometry.attributes.color;
    
    // X-axis (red by default)
    colors.setXYZ(0, 0.5, 0.5, 0.5); // First vertex
    colors.setXYZ(1, 0.5, 0.5, 0.5); // Second vertex
    
    // Y-axis (green by default)
    colors.setXYZ(2, 0.5, 0.5, 0.5); // First vertex
    colors.setXYZ(3, 0.5, 0.5, 0.5); // Second vertex
    
    // Z-axis (blue by default)
    colors.setXYZ(4, 0.5, 0.5, 0.5); // First vertex
    colors.setXYZ(5, 0.5, 0.5, 0.5); // Second vertex
    
    colors.needsUpdate = true; // Ensure the colors are updated in the rendering
    
    axesHelper.name = 'AxesHelper';
    scene.add(axesHelper);
    console.log("Stylish Axes Helper with faint colors added to the scene.");
  }
  
  
  
  
  function visualizeBoundingBox(boundingBox) {
    // Remove any existing bounding box helper
    const existingHelper = scene.getObjectByName('BoundingBoxHelper');
    if (existingHelper) {
        scene.remove(existingHelper);
    }
  
    // Create a Box3Helper to visualize the bounding box
    const box = new THREE.Box3(
        new THREE.Vector3(boundingBox.min.x, boundingBox.min.y, boundingBox.min.z),
        new THREE.Vector3(boundingBox.max.x, boundingBox.max.y, boundingBox.max.z)
    );
    const boxHelper = new THREE.Box3Helper(box, 0xff0000); // Red color
    boxHelper.name = 'BoundingBoxHelper';
    scene.add(boxHelper);
  
    // Optionally, add axes to the bounding box center
    const axesHelper = new THREE.AxesHelper(10);
    axesHelper.position.copy(box.getCenter(new THREE.Vector3()));
    axesHelper.name = 'BoundingBoxAxesHelper';
    scene.add(axesHelper);
  
    console.log("Bounding Box Helper added to the scene.");
  }
  
  export function adjustCameraToFitScene() {
    const { scene, nonBloomScene } = share3dDat();
  
    // Combine all spheres from both scenes
    const spheres = findAllSpheres([scene, nonBloomScene]);
  
    if (spheres.length === 0) {
      console.warn('No spheres found to adjust the camera.');
      return;
    }
  
    // Create a new Box3 to encompass all spheres
    const boundingBox = new THREE.Box3();
  
    spheres.forEach(sphere => {
      const sphereBox = new THREE.Box3().setFromObject(sphere);
      boundingBox.expandByPoint(sphereBox.min);
      boundingBox.expandByPoint(sphereBox.max);
    });
  
    // Compute the center and size of the bounding box
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
  
    // Compute the maximum dimension (x, y, or z)
    const maxDim = Math.max(size.x, size.y, size.z);
  
    // Compute an appropriate distance for the camera
    const fov = camera.fov * (Math.PI / 180);
    let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
  
    // Add some extra space
    cameraDistance *= 1.2; // Adjust as needed
  
    // Determine the new camera position
    const newCameraPosition = new THREE.Vector3(
      center.x,
      center.y,
      center.z + cameraDistance
    );
  
    // Determine the new controls target
    const newControlsTarget = center.clone();
  
    // Animate the camera position
    gsap.to(camera.position, {
      duration: 1.5, // Duration in seconds
      x: newCameraPosition.x,
      y: newCameraPosition.y,
      z: newCameraPosition.z,
      ease: "power2.out",
      onUpdate: () => {
        camera.lookAt(newControlsTarget);
        markNeedsRender(); // Ensure the scene re-renders during animation
      },
      onComplete: () => {
        console.log("Camera has adjusted to fit the scene.");
      }
    });
  
    // Animate the controls target
    gsap.to(controls.target, {
      duration: 1.5, // Duration in seconds
      x: newControlsTarget.x,
      y: newControlsTarget.y,
      z: newControlsTarget.z,
      ease: "power2.out",
      onUpdate: () => {
        controls.update();
        markNeedsRender(); // Ensure the scene re-renders during animation
      },
      onComplete: () => {
        console.log("OrbitControls target has been updated.");
      }
    });
  
    gsap.to(camera, {
      duration: 1.5,
      near: cameraDistance / 100,
      far: cameraDistance * 10,
      ease: "power2.out",
      onUpdate: () => {
        camera.updateProjectionMatrix();
      },
      onComplete: () => {
        console.log(`Camera near: ${camera.near}, Camera far: ${camera.far}`);
      }
    });
  
    console.log(`Target Position: (${center.x}, ${center.y}, ${center.z})`);
  }

  

export function zoomCameraToPointCloud(duration = 2) {
  const { scene, camera, controls } = share3dDat();

  // Find all points in the point cloud
  const points = scene.children.filter(child => child instanceof THREE.Points);

  if (points.length === 0) {
    console.warn('No point cloud found in the scene.');
    return;
  }

  // Calculate bounding box of all points
  const boundingBox = new THREE.Box3();
  points.forEach(points => {
    points.geometry.computeBoundingBox();
    boundingBox.union(points.geometry.boundingBox);
  });

  // Calculate center and size of bounding box
  const center = new THREE.Vector3();
  boundingBox.getCenter(center);
  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  // Calculate ideal camera position
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.1; // Reduced from 1.5 to 1.1 to zoom in closer
  const cameraPosition = new THREE.Vector3(center.x, center.y, center.z + cameraZ);

  // Animate camera position
  gsap.to(camera.position, {
    duration: duration,
    x: cameraPosition.x,
    y: cameraPosition.y,
    z: cameraPosition.z,
    ease: "power2.inOut",
    onUpdate: () => {
      camera.lookAt(center);
      markNeedsRender();
    }
  });

  // Animate controls target
  gsap.to(controls.target, {
    duration: duration,
    x: center.x,
    y: center.y,
    z: center.z,
    ease: "power2.inOut",
    onUpdate: () => {
      controls.update();
      markNeedsRender();
    }
  });

  // Set more permissive near and far planes
  camera.near = 0.1;
  camera.far = cameraZ * 1000;
  camera.updateProjectionMatrix();

  // Adjust control limits
  controls.minDistance = 0.1;
  controls.maxDistance = cameraZ * 10;

  console.log(`Camera zoomed to point cloud. New position: (${cameraPosition.x}, ${cameraPosition.y}, ${cameraPosition.z})`);
}
export function clearScenesAndHideObjects() {
  const { scene, nonBloomScene } = share3dDat();

  // Function to recursively hide objects
  function hideObject(obj) {
    obj.visible = false;
    if (obj.children) {
      obj.children.forEach(hideObject);
    }
  }

  // Hide all objects in main scene
  scene.children.forEach(hideObject);

  // Hide all objects in non-bloom scene
  nonBloomScene.children.forEach(hideObject);

  console.log(`Hidden ${scene.children.length} objects in main scene and ${nonBloomScene.children.length} objects in non-bloom scene.`);

  markNeedsRender();
}

 function adjustCameraToFitSceneAnimated() {
    const { scene, nonBloomScene, camera, controls } = share3dDat();
  
    // Combine all spheres from both scenes
    const spheres = findAllSpheres([scene, nonBloomScene]);
  
    if (spheres.length === 0) {
      console.warn('No spheres found to adjust the camera.');
      return;
    }
  
    // Create a bounding box that encompasses all spheres
    const boundingBox = new THREE.Box3();
    spheres.forEach(sphere => {
      boundingBox.expandByObject(sphere);
    });
  
    // Get the center and size of the bounding box
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
  
    // Get camera parameters
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const aspect = camera.aspect;
  
    // Calculate the distance the camera needs to be to fit the bounding box
    const distanceX = (size.x / 2) / Math.tan(fov / 2) / aspect;
    const distanceY = (size.y / 2) / Math.tan(fov / 2);
    const distance = Math.max(distanceX, distanceY);
  
    // Add some extra space
    const cameraDistance = distance * 1.2; // Adjust multiplier as needed
  
    // Compute new camera position
    const direction = new THREE.Vector3(0, 0, 1); // Assuming camera looks along the -Z axis
    const newCameraPosition = center.clone().add(direction.multiplyScalar(cameraDistance));
  
    // Update camera position and target with animation
    gsap.to(camera.position, {
      duration: 1.5,
      x: newCameraPosition.x,
      y: newCameraPosition.y,
      z: newCameraPosition.z,
      ease: "power2.out",
      onUpdate: () => {
        camera.lookAt(center);
        markNeedsRender();
      },
      onComplete: () => {
        console.log("Camera has adjusted to fit the scene.");
      }
    });
  
    // Update controls target
    gsap.to(controls.target, {
      duration: 1.5,
      x: center.x,
      y: center.y,
      z: center.z,
      ease: "power2.out",
      onUpdate: () => {
        controls.update();
        markNeedsRender();
      },
      onComplete: () => {
        console.log("Controls target updated.");
      }
    });
  
    // Adjust camera's near and far planes
    camera.near = cameraDistance / 100;
    camera.far = cameraDistance * 100;
    camera.updateProjectionMatrix();
  
    console.log(`Adjusted camera position: (${newCameraPosition.x}, ${newCameraPosition.y}, ${newCameraPosition.z})`);
  }
  
  

export function reorientCamera(scene, camera, controls) {
  const bbox = new THREE.Box3().setFromObject(scene);
  const center = bbox.getCenter(new THREE.Vector3());
  const size = bbox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;

  camera.position.set(center.x, center.y, center.z + cameraZ);
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  if (controls) {
      controls.target.copy(center);
      controls.update();
  }
}

export function rescalePositions(scene, targetSize = 100) {
  const bbox = new THREE.Box3().setFromObject(scene);
  const center = bbox.getCenter(new THREE.Vector3());
  const size = bbox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = targetSize / maxDim;

  scene.traverse((object) => {
      if (object.isObject3D) {
          object.position.sub(center).multiplyScalar(scale).add(center);
          if (object.isLine) {
              object.geometry.computeBoundingBox();
              object.geometry.scale(scale, scale, scale);
          }
      }
  });

  return { center, scale };
}

export function getScaleFactorForDistance(distance, minDistance = 1, maxDistance = 10000, minScale = 0.01, maxScale = 2) {
  return THREE.MathUtils.clamp(
      THREE.MathUtils.mapLinear(distance, minDistance, maxDistance, maxScale, minScale),
      minScale,
      maxScale
  );
}