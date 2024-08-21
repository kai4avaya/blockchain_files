export function getSceneSnapshot(scenes) {
    const snapshot = {
        cubes: [],
        spheres: [],
        containment: {}
    };

    // Traverse both scenes
    scenes.forEach((currentScene, sceneIndex) => {
        currentScene.traverse((object) => {
            if (object.isMesh) {
                if (object.geometry.type === "BoxGeometry") {
                    snapshot.cubes.push({
                        id: object.userData.id || object.uuid,
                        position: object.position.clone(),
                        scale: object.scale.clone(),
                        type: object.geometry.type,
                        scene: sceneIndex // Store the scene index or identifier
                    });
                } else if (object.geometry.type === "IcosahedronGeometry") {
                    snapshot.spheres.push({
                        id: object.userData.id || object.uuid,
                        position: object.position.clone(),
                        scale: object.scale.clone(),
                        type: object.geometry.type,
                        scene: sceneIndex // Store the scene index or identifier
                    });
                }
            }
        });
    });

    // Calculate containment
    snapshot.cubes.forEach(cube => {
        snapshot.containment[cube.id] = [];
        snapshot.spheres.forEach(sphere => {
            if (isSphereInsideCube(sphere, cube)) {
                snapshot.containment[cube.id].push(sphere.id);
            }
        });

        console.log(`Cube ${cube.id} contains spheres: `, snapshot.containment[cube.id]);
    });

    return snapshot;
}


function isSphereInsideCube(sphere, cube) {
    const spherePosition = sphere.position;
    const cubePosition = cube.position;
    const cubeHalfSize = cube.scale.x / 2; // Assuming uniform scale for simplicity
    const sphereRadius = sphere.scale.x / 2; // Assuming uniform scale for simplicity

    // Check if the sphere's center is within the cube's boundaries
    const withinX = Math.abs(spherePosition.x - cubePosition.x) <= cubeHalfSize;
    const withinY = Math.abs(spherePosition.y - cubePosition.y) <= cubeHalfSize;
    const withinZ = Math.abs(spherePosition.z - cubePosition.z) <= cubeHalfSize;

    // Check if the sphere intersects with the cube's faces
    const intersectsX = Math.abs(spherePosition.x - cubePosition.x) <= cubeHalfSize + sphereRadius;
    const intersectsY = Math.abs(spherePosition.y - cubePosition.y) <= cubeHalfSize + sphereRadius;
    const intersectsZ = Math.abs(spherePosition.z - cubePosition.z) <= cubeHalfSize + sphereRadius;

    const inside = (withinX && withinY && withinZ) || (intersectsX && intersectsY && intersectsZ);

    if (inside) {
        console.log(`Sphere ${sphere.id} is inside or intersects with Cube ${cube.id}`);
    } else {
        console.log(`Sphere ${sphere.id} is outside Cube ${cube.id}`);
    }

    return inside;
}


export function getCubeAndContainedSpheresById(snapshot, cubeId) {
    const result = {
        wireframeCube: null,
        solidCube: null,
        containedSpheres: []
    };

    // Find the wireframe cube and its corresponding solid cube
    const cubes = snapshot.cubes.filter(cube => cube.id === cubeId);
    if (cubes.length === 0) {
        console.error(`Cube with id ${cubeId} not found.`);
        return result;
    }

    // Assume the first cube is wireframe and the second (if exists) is solid
    result.wireframeCube = cubes[0];
    if (cubes.length > 1) {
        result.solidCube = cubes[1];
    }

    // Get all spheres contained within this cube
    const containedSphereIds = snapshot.containment[cubeId] || [];
    result.containedSpheres = snapshot.spheres.filter(sphere => containedSphereIds.includes(sphere.id));

    return result;
}

export function getObjectById(scenes, id) {
    const foundObjects = [];

    // Iterate through the scenes and traverse each to find the objects by ID
    scenes.forEach((currentScene) => {
        currentScene.traverse((object) => {
            if ((object.userData.id && object.userData.id === id) || object.uuid === id) {
                foundObjects.push(object);
            }
        });
    });

    return foundObjects; // Return the array of found objects
}


// Function to update the snapshot when spheres are moved
export function updateSnapshotAfterSphereDrag(snapshot, draggedSphereId, newPosition) {
    // Update the sphere's position in the snapshot
    const sphereIndex = snapshot.spheres.findIndex(s => s.id === draggedSphereId);
    if (sphereIndex !== -1) {
        snapshot.spheres[sphereIndex].position = newPosition.clone();
    }

    // Update containment
    for (let cubeId in snapshot.containment) {
        const index = snapshot.containment[cubeId].indexOf(draggedSphereId);
        if (index !== -1) {
            // Remove the sphere from this cube's containment
            snapshot.containment[cubeId].splice(index, 1);
        }
    }

    // Check if the sphere is now contained by any cube
    snapshot.cubes.forEach(cube => {
        if (isSphereInsideCube(snapshot.spheres[sphereIndex], cube)) {
            if (!snapshot.containment[cube.id]) {
                snapshot.containment[cube.id] = [];
            }
            snapshot.containment[cube.id].push(draggedSphereId);
        }
    });

    return snapshot;
}
