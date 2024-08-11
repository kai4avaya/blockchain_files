import * as THREE from 'three';

export function getSceneSnapshot(scenes) {
    const snapshot = {
        cubes: [],
        spheres: [],
        containment: {}
    };

    scenes.forEach(scene => {
        scene.traverse((object) => {
            if (object.isMesh) {
                const objectId = object.userData.id || object.id; // Check userData.id first, fallback to object.id

                const data = {
                    id: objectId,
                    title: object.userData.title || null,
                    position: object.position.clone(),
                    scale: object.scale.clone(),
                    type: object.geometry.type,
                };

                if (object.geometry.type === 'BoxGeometry') {
                    snapshot.cubes.push(data);
                } else if (object.geometry.type === 'IcosahedronGeometry') {
                    snapshot.spheres.push(data);
                }
            }
        });
    });

    snapshot.cubes.forEach((cube) => {
        const cubeBoundingBox = new THREE.Box3().setFromCenterAndSize(
            cube.position,
            new THREE.Vector3(cube.scale.x, cube.scale.y, cube.scale.z)
        );

        snapshot.spheres.forEach((sphere) => {
            const sphereBoundingBox = new THREE.Box3().setFromCenterAndSize(
                sphere.position,
                new THREE.Vector3(sphere.scale.x, sphere.scale.y, sphere.scale.z)
            );

            if (cubeBoundingBox.containsBox(sphereBoundingBox)) {
                if (!snapshot.containment[cube.id]) {
                    snapshot.containment[cube.id] = [];
                }
                snapshot.containment[cube.id].push(sphere.id);
            }
        });
    });

    return snapshot;
}
