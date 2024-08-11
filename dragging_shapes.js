import * as THREE from 'three';



const cubeGroups = new Map(); // Map of cube UUIDs to arrays of spheres inside them
let dragging = false;
let selectedObject = null;

export function dragCube(cube, deltaX, deltaY, deltaZ) {
    // Move the cube by the delta values
    cube.position.x += deltaX;
    cube.position.y += deltaY;
    cube.position.z += deltaZ;

    // Move all spheres inside this cube
    const spheres = cubeGroups.get(cube.uuid);
    if (spheres) {
        spheres.forEach(sphere => {
            sphere.position.x += deltaX;
            sphere.position.y += deltaY;
            sphere.position.z += deltaZ;

            // Check if the sphere is still inside the cube
            if (!isSphereInsideCube(sphere, cube)) {
                // If the sphere is outside, remove it from the group
                removeSphereFromCube(sphere, cube);
            }
        });
    }

    // Resize the cube to fit remaining spheres
    resizeCubeToFitSpheres(cube);
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


export function resizeCubeToFitSpheres(cube) {
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

    // Set the cube size to fit all spheres
    const newCubeSize = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    cube.scale.set(newCubeSize, newCubeSize, newCubeSize);
}


document.addEventListener('pointerdown', (event) => {
    const selectedCube = getCubeUnderPointer(event);
    if (selectedCube) {
        dragging = true;
        selectedObject = selectedCube;
    }
});

document.addEventListener('pointermove', (event) => {
    if (dragging && selectedObject) {
        const deltaX = event.movementX; // Or calculate based on raycaster
        const deltaY = event.movementY;
        const deltaZ = 0; // Assuming movement on a 2D plane

        dragCube(selectedObject, deltaX, deltaY, deltaZ);
    }
});

document.addEventListener('pointerup', () => {
    dragging = false;
    selectedObject = null;
});
