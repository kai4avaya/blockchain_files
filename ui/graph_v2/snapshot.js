import * as THREE from 'three';
import config from '../../configs/config.json';
import { share3dDat } from './create';



export function createSceneSnapshot(scenes) {
    const { ghostCube } = share3dDat(); 

    const snapshot = {
        objects: [],
        boxes: [],
        containment: {}
    };

    const boundingBoxes = new Map();

    scenes.forEach((currentScene, sceneIndex) => {
        currentScene.traverse((object) => {

            if (object === ghostCube) {
                // Skip the ghostCube
                return;
              }

            if (isRelevantObject(object)) {
                const objectId = getObjectId(object);
                const objectData = {
                    id: objectId,
                    object: object,
                    type: object.geometry.type,
                    scene: sceneIndex
                };

                snapshot.objects.push(objectData);

                // Handle boxes (both wireframe and solid versions)
                if (isBoxObject(object)) {
                    const boxId = getBoxId(object);
                    let existingBox = snapshot.boxes.find(box => box.id === boxId);
                    
                    if (!existingBox) {
                        existingBox = { id: boxId, wireframe: null, solid: null };
                        snapshot.boxes.push(existingBox);
                    }

                    if (object instanceof THREE.LineSegments) {
                        existingBox.wireframe = object;
                    } else {
                        existingBox.solid = object;
                    }

                    // Create bounding box if not exists
                    if (!boundingBoxes.has(boxId)) {
                        const boundingBox = new THREE.Box3().setFromObject(object);
                        boundingBoxes.set(boxId, boundingBox);
                    }
                }
            }
        });
    });

    // Compute containment
    snapshot.boxes.forEach(box => {
        const boxBoundingBox = boundingBoxes.get(box.id);
        snapshot.containment[box.id] = [];

        snapshot.objects.forEach(obj => {
            if (isSphereObject(obj.object)) {
                const sphereBoundingBox = new THREE.Box3().setFromObject(obj.object);
                if (boxBoundingBox.intersectsBox(sphereBoundingBox)) {
                    snapshot.containment[box.id].push(obj.id);
                }
            }
        });
    });

    return snapshot;
}


function isRelevantObject(object) {
    if (!(object.isMesh || object instanceof THREE.LineSegments)) {
        return false;
    }
    
    if (!object.geometry) {
        return false;
    }

    const geometryType = object.geometry.type;
    const objectType = object.type;

    return !config.excluded.includes(geometryType) && !config.excluded.includes(objectType);
}

function isBoxObject(object) {
    return object.geometry.type === "BoxGeometry" || 
           (object instanceof THREE.LineSegments && object.geometry.type === "EdgesGeometry");
}

function isSphereObject(object) {
    return object.geometry.type === "IcosahedronGeometry" || object.geometry.type === "SphereGeometry";
}

function getObjectId(object) {
    if (object.userData && typeof object.userData.id === 'string') {
        return object.userData.id;
    }
    return object.uuid;
}

function getBoxId(object) {
    const id = getObjectId(object);
    return id.endsWith('_solid') ? id.replace('_solid', '') : id.replace('-solid', '');
}

// Function to retrieve a specific object by ID
export function getObjectById(snapshot, id) {
    // Check in objects
    const object = snapshot.objects.find(obj => obj.id === id);
    if (object) return object;

    // Check in boxes
    const box = snapshot.boxes.find(box => box.id === id);
    if (box) return box;

    // If not found
    return null;
}

// Function to add debug visuals to a scene
export function addDebugVisualsToScene(scene, snapshot) {
    scene.add(snapshot.debugObjects);
}


export function getCubeContainingSphere(sphere) {
    const { nonBloomScene } = share3dDat();
    let containingCube = null;
  
    nonBloomScene.traverse((object) => {
      if (object.geometry && object.geometry.type === "BoxGeometry") {
        const cube = object;
        const cubePosition = cube.position;
        const cubeSize = cube.scale.x; // Assuming uniform scale
  
        const halfSize = cubeSize / 2;
        const minX = cubePosition.x - halfSize;
        const maxX = cubePosition.x + halfSize;
        const minY = cubePosition.y - halfSize;
        const maxY = cubePosition.y + halfSize;
        const minZ = cubePosition.z - halfSize;
        const maxZ = cubePosition.z + halfSize;
  
        const spherePos = sphere.position;
  
        if (
          spherePos.x >= minX &&
          spherePos.x <= maxX &&
          spherePos.y >= minY &&
          spherePos.y <= maxY &&
          spherePos.z >= minZ &&
          spherePos.z <= maxZ
        ) {
          containingCube = cube;
          return; // Stop traversal
        }
      }
    });
  
    return containingCube;
  }
  

  
export function findSpheresInCube(cube) {
    const { scene, nonBloomScene } = share3dDat();
    const spheres = [];
    const cubeBox = new THREE.Box3().setFromObject(cube);
  
    [scene, nonBloomScene].forEach(currentScene => {
      currentScene.traverse((object) => {
        if (object.geometry && object.geometry.type === "IcosahedronGeometry") {
          const sphereBox = new THREE.Box3().setFromObject(object);
          if (cubeBox.intersectsBox(sphereBox)) {
            spheres.push(object);
          }
        }
      });
    });
  
    return spheres;
  }
  