import * as THREE from 'three';
import { share3dDat, render} from './graph';
import { getSceneSnapshot,getCubeAndContainedSpheresById, getObjectById } from './graph_snapshot';
import { moveSphere } from './graph';

const cubeGroups = new Map(); // Map of cube UUIDs to arrays of spheres inside them
let dragging = false;
let selectedObject = null;
let currentSnapshot = null;


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


export function dragCube(event, cube, intersectPoint, snapshot) {
    if (!cube) {
        console.error("No cube provided to drag."); // Log if the cube is undefined
        return;
    }
    const { nonBloomScene, scene } = share3dDat();


    const cubeId = cube.wireframeCube.id || cube.wireframeCube.uuid;

    const cubes = getObjectById([nonBloomScene, scene], cubeId)

    console.log("Dragging cube by:", intersectPoint); 
    cubes[0].position.copy(intersectPoint);
    cubes[1].position.copy(intersectPoint);

    console.log(" cubes[0] ", cubes[0]);
    console.log(" cubes[1]", cubes[1]);
    

    cube.wireframeCube.frustumCulled = false;
    cube.solidCube.frustumCulled = false;

    // Move all spheres inside this cube
    const containedSphereIds = snapshot.containment[cubeId];
    if (containedSphereIds && containedSphereIds.length > 0) {
        containedSphereIds.forEach(sphereId => {
            let sphere = findSphereById(snapshot.spheres, sphereId);
            if (sphere) {
                const {nonBloomScene, scene} = share3dDat();
                sphere = getObjectById([nonBloomScene, scene], sphereId)[0]
                moveSphere(event,sphere)
            }
        });
    }
    // render();

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


document.addEventListener('pointerdown', (event) => {
    const selectedCube = getCubeUnderPointer(event);
    if (selectedCube) {
        console.log("Pointer down on cube:", selectedCube); // Log when a cube is selected for dragging
        dragging = true;
        selectedObject = selectedCube;
    } else {
        console.log("No cube selected.");
    }
});

document.addEventListener('pointermove', (event) => {
    if (dragging && selectedObject) {
        console.log("Pointer move while dragging.", selectedObject); // Log when dragging is in progress
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
});

document.addEventListener('pointerup', () => {
    const { controls } = share3dDat();
    console.log("Pointer up. Dragging ended."); // Log when dragging ends
    dragging = false;
    selectedObject = null;
    currentSnapshot = null; // Clear the snapshot after dragging ends
    controls.enabled = true;
});
