import * as THREE from "three";
import indexDBOverlay from '../memory/local/file_worker';
import { performUMAPOnly } from './umap.js';
import { clearScenesAndHideObjects } from '../ui/graph_v2/reorientScene.js';
import { share3dDat } from '../ui/graph_v2/create.js'
import { createFloatingElement, createConnections,addInteractivity } from '../ui/graph_v2/createTextProjections.js';
import { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import TWEEN from 'three/addons/libs/tween.module.js';

async function performUMAPAndCreateCoordMap(embeddings, labels) {
    const { reducedData } = await performUMAPOnly(embeddings, labels);
    const keyToCoords = {};
    
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    reducedData.forEach(coord => {
        minX = Math.min(minX, coord[0]);
        minY = Math.min(minY, coord[1]);
        minZ = Math.min(minZ, coord[2]);
        maxX = Math.max(maxX, coord[0]);
        maxY = Math.max(maxY, coord[1]);
        maxZ = Math.max(maxZ, coord[2]);
    });

    const scale = 200;
    labels.forEach((key, index) => {
        keyToCoords[key] = new THREE.Vector3(
            ((reducedData[index][0] - minX) / (maxX - minX) - 0.5) * scale,
            ((reducedData[index][1] - minY) / (maxY - minY) - 0.5) * scale,
            ((reducedData[index][2] - minZ) / (maxZ - minZ) - 0.5) * scale
        );
    });
    
    console.log("keyToCoords:", keyToCoords);
    return keyToCoords;
}

async function fetchAndValidateData() {
    await indexDBOverlay.openDB('vectorDB_new', 2);
    const vectorsData = await indexDBOverlay.getData('vectors', 'vectorDB_new');
    const hashIndexData = await indexDBOverlay.getData('vectors_hashIndex', 'vectorDB_new');

    if (!vectorsData || vectorsData.length === 0) {
        throw new Error('No vector data retrieved from the database');
    }
    if (!hashIndexData || Object.keys(hashIndexData).length === 0) {
        throw new Error('No hash index data retrieved from the database');
    }

    return { vectorsData, hashIndexData };
}

function prepareDataForUMAP(vectorsData) {
    const vectorMap = new Map(vectorsData.map((item, index) => [String(index + 1), item]));
    const embeddings = [];
    const labels = [];
    vectorsData.forEach((item, index) => {
        embeddings.push(item.embedding);
        labels.push(String(index + 1));
    });

    return { vectorMap, embeddings, labels };
}

export async function setupTextProjectionVisualization() {
    const sharedData = share3dDat();
    let { scene, camera } = sharedData;
  
    try {

        clearScenesAndHideObjects()

        const { vectorsData, hashIndexData } = await fetchAndValidateData();
        const { vectorMap, embeddings, labels } = prepareDataForUMAP(vectorsData);
        const keyToCoords = await performUMAPAndCreateCoordMap(embeddings, labels);

        const objectMap = createElements(scene, hashIndexData, vectorMap, keyToCoords);
        // createConnections(scene, hashIndexData, objectMap);
        const lines = createConnections(scene, hashIndexData, objectMap);

        const css3dRenderer = new CSS3DRenderer();
        css3dRenderer.setSize(window.innerWidth, window.innerHeight);
        css3dRenderer.domElement.style.position = 'absolute';
        css3dRenderer.domElement.style.top = '0';
        css3dRenderer.domElement.style.left = '0';
        css3dRenderer.domElement.style.pointerEvents = 'none';
        document.body.appendChild(css3dRenderer.domElement);

        const controls = new TrackballControls(camera, css3dRenderer.domElement);
        controls.minDistance = 500;
        controls.maxDistance = 6000;

        // Update shared data
        sharedData.renderer = css3dRenderer;
        sharedData.controls = controls;

        addInteractivity(scene, camera, objectMap);

        // Adjust camera to fit all objects
        adjustCamera(scene, camera);

        function render() {
            css3dRenderer.render(scene, camera);
        }

        sharedData.render = render;

        function animate() {
            requestAnimationFrame(animate);
            TWEEN.update();
            controls.update();
            render();
        }

        animate();

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            css3dRenderer.setSize(window.innerWidth, window.innerHeight);
        });

        // transform(objectMap, 2000, render);

          // Modify the transform call to include lines
    // transform(objectMap, lines, 2000, render);

        console.log('Visualization setup complete');

    } catch (error) {
        console.error('Error setting up visualization:', error);
    }
}



function logSceneStructure(object, indent = '') {
    console.log(indent + object.type + (object.name ? ` (${object.name})` : ''));
    object.children.forEach(child => logSceneStructure(child, indent + '  '));
  }


function createElements(scene, hashIndexData, vectorMap, keyToCoords) {
    const objectMap = new Map();
    Object.entries(hashIndexData).forEach(([hashKey, bucketObjects]) => {
        bucketObjects.forEach((key) => {
            if (!objectMap.has(String(key))) {
                const vectorData = vectorMap.get(String(key));
                if (vectorData && keyToCoords[key]) {
                    const element = createFloatingElement(vectorData.text, keyToCoords[key], key, vectorData.fileId, hashKey);
                    objectMap.set(String(key), element);
                    scene.add(element);
                    console.log(`Added element for key: ${key}, position:`, keyToCoords[key]);
                }
            }
        });
    });
    return objectMap;
}
// Modify the transform function to update line positions
function transform(objectMap, lines, duration, renderFunction) {
    const objects = Array.from(objectMap.values());
    const spacing = 250;
    const gridSize = Math.ceil(Math.sqrt(objects.length));
    
    objects.forEach((object, i) => {
        const row = Math.floor(i / gridSize);
        const col = i % gridSize;

        const target = new THREE.Vector3(
            (col - gridSize / 2) * spacing,
            (row - gridSize / 2) * spacing,
            0
        );

        new TWEEN.Tween(object.position)
            .to({ x: target.x, y: target.y, z: target.z }, Math.random() * duration + duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .onUpdate(() => {
                updateConnections(lines);
            })
            .start();

        new TWEEN.Tween(object.rotation)
            .to({ x: 0, y: 0, z: 0 }, Math.random() * duration + duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();
    });

    new TWEEN.Tween(this)
        .to({}, duration * 2)
        .onUpdate(renderFunction)
        .start();
}

// Add a function to update connection positions
function updateConnections(lines) {
    lines.forEach(({ line, obj1, obj2 }) => {
        const start = obj1.position;
        const end = obj2.position;
        const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const normal = new THREE.Vector3().subVectors(end, start).normalize();
        const perpendicular = new THREE.Vector3(-normal.y, normal.x, normal.z).normalize();
        const curveHeight = start.distanceTo(end) * 0.2;
        const curvePoint = midPoint.clone().add(perpendicular.multiplyScalar(curveHeight));

        const curve = new THREE.QuadraticBezierCurve3(start, curvePoint, end);
        const points = curve.getPoints(50);
        line.geometry.setFromPoints(points);
        line.geometry.verticesNeedUpdate = true;
    });
}

function adjustCamera(scene, camera) {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

    cameraZ *= 1.5; // Add 50% to the distance for some padding

    camera.position.set(center.x, center.y, cameraZ);
    camera.lookAt(center);

    camera.updateProjectionMatrix();
}