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


// Example isSphereInsideCube function
function isSphereInsideCube(sphere, cube) {
    const spherePosition = sphere.position;
    const cubePosition = cube.position;
    const cubeSize = cube.scale.x; // Assuming uniform scale for simplicity
    const sphereRadius = sphere.scale.x / 2; // Assuming uniform scale for simplicity

    const inside = (
        Math.abs(spherePosition.x - cubePosition.x) + sphereRadius <= cubeSize / 2 &&
        Math.abs(spherePosition.y - cubePosition.y) + sphereRadius <= cubeSize / 2 &&
        Math.abs(spherePosition.z - cubePosition.z) + sphereRadius <= cubeSize / 2
    );

    if (inside) {
        console.log(`Sphere ${sphere.id} is inside Cube ${cube.id}`);
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
    const cube = snapshot.cubes.find(cube => cube.id === cubeId);
    if (!cube) {
        console.error(`Cube with id ${cubeId} not found.`);
        return result; // Return an empty result if the cube isn't found
    }

    // Traverse the scenes to find the wireframe and solid cubes
    snapshot.cubes.forEach(cubeData => {
        if (cubeData.id === cubeId) {
            result.wireframeCube = cubeData;
        }
    });

    // The solid cube should share the same id as the wireframe cube
    snapshot.cubes.forEach(cubeData => {
        if (cubeData.id === cubeId && cubeData.type === "BoxGeometry") {
            result.solidCube = cubeData;
        }
    });

    // Get the IDs of the spheres contained within this cube
    const containedSphereIds = snapshot.containment[cubeId];
    if (containedSphereIds && containedSphereIds.length > 0) {
        containedSphereIds.forEach(sphereId => {
            const sphere = snapshot.spheres.find(sphere => sphere.id === sphereId);
            if (sphere) {
                result.containedSpheres.push(sphere);
            }
        });
    }

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