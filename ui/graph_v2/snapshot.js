import * as THREE from 'three';

// Comprehensive function to create scene snapshot with bounding boxes and containment
export function createSceneSnapshot(scenes) {
    const snapshot = {
        objects: [],
        boxes: [],
        containment: {}
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
            if (obj.type === "IcosahedronGeometry" || obj.type === "SphereGeometry") {
                const sphereBoundingBox = new THREE.Box3().setFromObject(obj.object);
                if (boxBoundingBox.containsBox(sphereBoundingBox)) {
                    snapshot.containment[box.id].push(obj.id);
                }
            }
        });
    });

    return snapshot;
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