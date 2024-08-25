import * as THREE from 'three';
import graphStore from './memory/stores/graphStore';

// Comprehensive function to create scene snapshot with bounding boxes, containment, and debug visuals
export function createSceneSnapshot(scenes) {
    const snapshot = {
        objects: [],
        boxes: [],
        containment: {},
        debugObjects: new THREE.Group()
    };

    // Create a Map to store bounding boxes for quick lookup
    const boundingBoxes = new Map();

    scenes.forEach((currentScene, sceneIndex) => {
        currentScene.traverse((object) => {
            if (object.isMesh || object instanceof THREE.LineSegments) {
                const objectData = {
                    id: object.userData.id || object.uuid,
                    object: object,
                    type: object.geometry.type,
                    scene: sceneIndex
                };

                snapshot.objects.push(objectData);

                // Handle boxes (both wireframe and solid versions)
                if (object.geometry.type === "BoxGeometry" || object.geometry instanceof THREE.EdgesGeometry) {
                    const boxId = object.userData.id || object.uuid;
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

                        // Add debug visual for bounding box
                        const boxHelper = new THREE.Box3Helper(boundingBox, new THREE.Color(0xff0000));
                        snapshot.debugObjects.add(boxHelper);
                    }
                }

                // Add debug visual for all objects
                const objectBoundingBox = new THREE.Box3().setFromObject(object);
                const objectHelper = new THREE.Box3Helper(objectBoundingBox, new THREE.Color(0x00ff00));
                snapshot.debugObjects.add(objectHelper);
            }
        });
    });

   // Compute containment
   snapshot.boxes.forEach(box => {
    const boxBoundingBox = boundingBoxes.get(box.id);
    snapshot.containment[box.id] = [];

    snapshot.objects.forEach(obj => {
        if (obj.type === "IcosahedronGeometry" || obj.type === "SphereGeometry") {
            const sphereBoundingBox = new THREE.Box3().setFromObject(obj.object);
            if (boxBoundingBox.intersectsBox(sphereBoundingBox)) {  // Changed from containsBox to intersectsBox
                snapshot.containment[box.id].push(obj.id);
            }

            // Add debug line between box center and sphere center
            const boxCenter = new THREE.Vector3();
            boxBoundingBox.getCenter(boxCenter);
            const sphereCenter = new THREE.Vector3();
            sphereBoundingBox.getCenter(sphereCenter);
            const geometry = new THREE.BufferGeometry().setFromPoints([boxCenter, sphereCenter]);
            const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
            const line = new THREE.Line(geometry, material);
            snapshot.debugObjects.add(line);
        }
    });
});

return snapshot;
}

export async function updateGraphStore(snapshot){
    await graphStore.updateFromSnapshot(snapshot);
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