import * as THREE from 'three';
import config from '../../configs/config.json';

export function createSceneSnapshot(scenes) {
    const snapshot = {
        objects: [],
        boxes: [],
        containment: {},
        debugObjects: new THREE.Group()
    };

    const boundingBoxes = new Map();

    scenes.forEach((currentScene, sceneIndex) => {
        currentScene.traverse((object) => {
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