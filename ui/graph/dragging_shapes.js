//  TO DO  call this cube drag

import * as THREE from 'three';
import { share3dDat, render} from './graph';
import { getSceneSnapshot,getCubeAndContainedSpheresById, getObjectById } from './graph_snapshot';
import {checkIntersections} from './graph_drag'

const cubeGroups = new Map(); // Map of cube UUIDs to arrays of spheres inside them
let dragging = false;
let selectedObject = null;
let currentSnapshot = null;
let selectedSphere = null;

function getCubeUnderPointer(event) {
    const { camera, raycaster,scene, nonBloomScene, mouse, controls } = share3dDat();
    
    // Update mouse position
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Cast a ray from the camera to the mouse position
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nonBloomScene.children, true);

    if (intersects.length > 0) {
        currentSnapshot = getSceneSnapshot([scene, nonBloomScene]); // Pass the scenes to get the snapshot

        console.log("currentSnapshot!!!", currentSnapshot);
        for (const intersectedObject of intersects) {
            // Find the intersected object in the snapshot cubes using the userData.id or uuid
            const matchingCube = currentSnapshot.cubes.find(cube => 
                cube.id === intersectedObject.object.userData.id || 
                cube.id === intersectedObject.object.uuid
            );

            if (matchingCube) {
                controls.enabled = false; // Disable OrbitControls during dragging

                // Use the matching cube's ID to get the full cube and contained spheres
                const result = getCubeAndContainedSpheresById(currentSnapshot, matchingCube.id);

                return result; // Return the cube, its twin, and the contained spheres
            }
        }
    }
    
    return null; // Return null if no cube is found
}


// export function dragCube(event, cube, intersectPoint, snapshot) {
//     if (!cube) {
//         return;
//     }
//     const { nonBloomScene, scene } = share3dDat();


//     const cubeId = cube.wireframeCube.id || cube.wireframeCube.uuid;

//     const cubes = getObjectById([nonBloomScene, scene], cubeId)

//     cubes[0].position.copy(intersectPoint);
//     cubes[1].position.copy(intersectPoint);

//     console.log("i am cube 0", cubes[0])
//     console.log("i am cube 1", cubes[1])

//     // Move all spheres inside this cube
//     const containedSphereIds = snapshot.containment[cubeId];

//     console.log("containedSphereIds", containedSphereIds)
//     if (containedSphereIds && containedSphereIds.length > 0) {
//         containedSphereIds.forEach(sphereId => {
//             let sphere = findSphereById(snapshot.spheres, sphereId);
//             if (sphere) {
//                 console.log("i am sphere", sphere)
//                 // const {nonBloomScene, scene} = share3dDat();
//                 sphere = getObjectById([nonBloomScene, scene], sphereId)[0]
//                 moveSphere(event,sphere, intersectPoint)
//             }
//         });
//     }
//     // render();

// }


let camera; // Make sure to initialize this with your camera

export function dragCube(event, cube, intersectPoint, snapshot) {
    if (!cube) return;
    if(!cube.wireframeCube) return

    const { nonBloomScene, scene } = share3dDat();

    const cubeId = cube.wireframeCube.id || cube.wireframeCube.uuid;
    const cubes = getObjectById([nonBloomScene, scene], cubeId);

    // Calculate the movement delta
    const movementDelta = new THREE.Vector3().subVectors(intersectPoint, cubes[0].position);

    // Update cube positions
    cubes.forEach(cubeObj => {
        cubeObj.position.add(movementDelta);
    });

    // Move all spheres inside this cube
    const containedSphereIds = snapshot.containment[cubeId];

    console.log("containedSphereIds", containedSphereIds);
    if (containedSphereIds && containedSphereIds.length > 0) {
        containedSphereIds.forEach(sphereId => {
            const sphereObjects = getObjectById([nonBloomScene, scene], sphereId);
            sphereObjects.forEach(sphereObj => {
                // Move sphere by the same delta as the cube
                sphereObj.position.add(movementDelta);
            });
        });
    }

    render();
}

function findSphereById(spheres, id) {
    return spheres.find(sphere => sphere.id === id);
}


export function isSphereInsideCube(sphere, cube) {
    const spherePosition = sphere.position;
    const cubePosition = cube.position;
    const cubeSize = cube.scale.x; // Assuming uniform scale for simplicity

    return (
        Math.abs(spherePosition.x - cubePosition.x) <= cubeSize / 2 &&
        Math.abs(spherePosition.y - cubePosition.y) <= cubeSize / 2 &&
        Math.abs(spherePosition.z - cubePosition.z) <= cubeSize / 2
    );
}


export function removeSphereFromCube(sphere, cube) {
    const spheres = cubeGroups.get(cube.uuid);
    if (spheres) {
        const index = spheres.indexOf(sphere);
        if (index !== -1) {
            spheres.splice(index, 1); // Remove sphere from group
        }
    }
}


// // removing this for now..
// export function resizeCubeToFitSpheres(cube) {
//     const spheres = cubeGroups.get(cube.uuid);
//     if (!spheres || spheres.length === 0) return;

//     // Calculate the bounding box that fits all spheres
//     let minX = Infinity, minY = Infinity, minZ = Infinity;
//     let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

//     spheres.forEach(sphere => {
//         const spherePosition = sphere.position;
//         const sphereRadius = sphere.scale.x; // Assuming uniform scale for simplicity

//         minX = Math.min(minX, spherePosition.x - sphereRadius);
//         minY = Math.min(minY, spherePosition.y - sphereRadius);
//         minZ = Math.min(minZ, spherePosition.z - sphereRadius);
//         maxX = Math.max(maxX, spherePosition.x + sphereRadius);
//         maxY = Math.max(maxY, spherePosition.y + sphereRadius);
//         maxZ = Math.max(maxZ, spherePosition.z + sphereRadius);
//     });

//     // Set the cube size to fit all spheres
//     const newCubeSize = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
//     cube.scale.set(newCubeSize, newCubeSize, newCubeSize);
// }

export function resizeCubeToFitSpheres(cube, minSizeAllowed = false, buffer = 5) {
    const spheres = cubeGroups.get(cube.uuid);
    if (!spheres || spheres.length === 0) return;

    // Calculate the bounding box that fits all spheres
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    spheres.forEach(sphere => {
        const spherePosition = sphere.position;
        const sphereRadius = sphere.scale.x; // Assuming uniform scale for simplicity

        minX = Math.min(minX, spherePosition.x - sphereRadius);
        minY = Math.min(minY, spherePosition.y - sphereRadius);
        minZ = Math.min(minZ, spherePosition.z - sphereRadius);
        maxX = Math.max(maxX, spherePosition.x + sphereRadius);
        maxY = Math.max(maxY, spherePosition.y + sphereRadius);
        maxZ = Math.max(maxZ, spherePosition.z + sphereRadius);
    });

    // Add buffer to the bounding box dimensions
    minX -= buffer;
    minY -= buffer;
    minZ -= buffer;
    maxX += buffer;
    maxY += buffer;
    maxZ += buffer;

    // Calculate the new size of the cube based on the bounding box
    const newCubeSize = Math.max(maxX - minX, maxY - minY, maxZ - minZ);

    // Get the current size of the cube
    const currentCubeSize = cube.scale.x; // Assuming uniform scale for simplicity

    // Determine the final cube size
    let finalCubeSize;
    if (minSizeAllowed) {
        // Allow shrinking to the new calculated size with the buffer
        finalCubeSize = newCubeSize;
    } else {
        // Do not allow shrinking below the current size
        finalCubeSize = Math.max(newCubeSize, currentCubeSize);
    }

    // Set the cube size to the final calculated size
    cube.scale.set(finalCubeSize, finalCubeSize, finalCubeSize);
}



export function getObjectUnderPointer(event) {
    const { camera, raycaster, mouse, scene, nonBloomScene } = share3dDat();
    
    // Update mouse position
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Cast a ray from the camera to the mouse position
    raycaster.setFromCamera(mouse, camera);

    // Check for intersections in both scenes
    const intersects = raycaster.intersectObjects([...scene.children, ...nonBloomScene.children], true);

    if (intersects.length > 0) {
        return intersects[0].object; // Return the first intersected object
    }

    return null; // Return null if no object is found
}


// document.addEventListener('pointerdown', (event) => {
//     const selectedCube = getCubeUnderPointer(event);
//     if (selectedCube) {
//         dragging = true;
//         selectedObject = selectedCube;
//     } else {

//     }
// });



document.addEventListener('pointerdown', (event) => {
    const { camera, scene, nonBloomScene, raycaster, mouse } = share3dDat();

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const allIntersects = checkIntersections(raycaster, [scene, nonBloomScene]);

    // First, check for sphere intersections
    const sphereIntersect = allIntersects.find(intersect => 
        intersect.object.geometry.type === "IcosahedronGeometry" || 
        intersect.object.geometry.type === "SphereGeometry"
    );

    if (sphereIntersect) {
        dragging = true;
        selectedSphere = sphereIntersect.object;
        selectedObject = selectedSphere;
    } else {
        // If no sphere is intersected, check for cube intersections
        const selectedCube = getCubeUnderPointer(event);
        if (selectedCube) {
            dragging = true;
            selectedObject = selectedCube;
        }
    }

    if (dragging) {
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
    }
});

document.addEventListener('pointermove', (event) => {
    onPointerMove(event);
});

function onPointerMove(event) {
    if (dragging && selectedObject) {
        const { camera, raycaster, mouse } = share3dDat();
        // Convert mouse movement to scene coordinates
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion), 0);
        const intersectPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersectPoint);
        dragCube(event, selectedObject, intersectPoint, currentSnapshot);
    }

}

document.addEventListener('pointerup', () => {
    onPointerUp()
});

function onPointerUp () {
    const { controls } = share3dDat();
    dragging = false;
    selectedObject = null;
    currentSnapshot = null; // Clear the snapshot after dragging ends
    controls.enabled = true;
}
// Make sure to call this function when you set up your scene
export function initializeDragFunctions(cameraInstance) {
    camera = cameraInstance;
}