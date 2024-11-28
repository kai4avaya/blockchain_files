import * as THREE from "three";
import indexDBOverlay from '../memory/local/file_worker';
import { performUMAPOnly } from './umap.js';
import { clearScenesAndHideObjects } from '../ui/graph_v2/reorientScene.js';
import { share3dDat } from '../ui/graph_v2/create.js'
import { createFloatingElement, createConnections,addInteractivity } from '../ui/graph_v2/createTextProjections.js';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
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

    console.log('Data retrieved from IndexedDB:', {
        vectorsDataSample: vectorsData?.[0],
        hashIndexExample: hashIndexData?.['00000'],
        totalVectors: vectorsData?.length,
        totalHashes: Object.keys(hashIndexData || {}).length
    });

    if (!vectorsData || vectorsData.length === 0) {
        throw new Error('No vector data retrieved from the database');
    }
    if (!hashIndexData || Object.keys(hashIndexData).length === 0) {
        throw new Error('No hash index data retrieved from the database');
    }

    return { vectorsData, hashIndexData };
}

function prepareDataForUMAP(vectorsData) {
    // Create a map using the actual IDs from the data
    const vectorMap = new Map();
    const embeddings = [];
    const labels = [];

    vectorsData.forEach((item, index) => {
        const id = item.id || String(index + 1);
        vectorMap.set(id, item);
        embeddings.push(item.embedding);
        labels.push(id);
        
        // Debug log for first few items
        if (index < 3) {
            console.log(`Mapping item ${id}:`, item);
        }
    });

    return { vectorMap, embeddings, labels };
}

export async function setupTextProjectionVisualization() {
    const sharedData = share3dDat();
    let { scene, camera, renderer } = sharedData;
  
    try {
        clearScenesAndHideObjects();

        // Initialize CSS3D renderer
        const css3dRenderer = new CSS3DRenderer();
        css3dRenderer.setSize(window.innerWidth, window.innerHeight);
        css3dRenderer.domElement.classList.add('css3d-renderer');
        document.body.appendChild(css3dRenderer.domElement);

        // Add resize handler
        window.addEventListener('resize', () => {
            css3dRenderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Debug the renderer setup
        console.log('CSS3D renderer setup:', {
            domElement: css3dRenderer.domElement,
            size: {
                width: css3dRenderer.domElement.offsetWidth,
                height: css3dRenderer.domElement.offsetHeight
            },
            style: window.getComputedStyle(css3dRenderer.domElement)
        });

        const { vectorsData, hashIndexData } = await fetchAndValidateData();
        const { vectorMap, embeddings, labels } = prepareDataForUMAP(vectorsData);
        const keyToCoords = await performUMAPAndCreateCoordMap(embeddings, labels);

        // Log data for debugging
        console.log('Creating elements with:', {
            hashIndexData,
            vectorMap: Array.from(vectorMap.entries()),
            keyToCoords
        });

        // Add validation before creating elements
        validateData(hashIndexData, vectorMap, keyToCoords);
        
        const objectMap = createElements(scene, hashIndexData, vectorMap, keyToCoords);
        
        // Adjust camera position to see the elements
        camera.position.set(0, 0, 500);
        camera.lookAt(0, 0, 0);
        
        // Update camera settings
        camera.near = 1;
        camera.far = 5000;
        camera.updateProjectionMatrix();

        // Add ambient light to ensure visibility
        const ambientLight = new THREE.AmbientLight(0xffffff, 1);
        scene.add(ambientLight);

        const lines = createConnections(scene, hashIndexData, objectMap);

        // Update shared data
        sharedData.renderer = css3dRenderer;
        
        // Add controls after renderer is set
        const controls = new TrackballControls(camera, css3dRenderer.domElement);
        controls.minDistance = 500;
        controls.maxDistance = 6000;
        sharedData.controls = controls;

        addInteractivity(scene, camera, objectMap);
        adjustCamera(scene, camera);

        // Set up render loop
        function animate() {
            requestAnimationFrame(animate);
            TWEEN.update();
            controls.update();
            
            // Render WebGL scene
            renderer.render(scene, camera);
            
            // Render CSS3D elements
            css3dRenderer.render(scene, camera);
        }

        animate();

        console.log('Visualization setup complete');
    } catch (error) {
        console.error('Error setting up visualization:', error);
        throw error;
    }
}



function logSceneStructure(object, indent = '') {
    console.log(indent + object.type + (object.name ? ` (${object.name})` : ''));
    object.children.forEach(child => logSceneStructure(child, indent + '  '));
  }


function createElements(scene, hashIndexData, vectorMap, keyToCoords) {
    const objectMap = new Map();
    let index = 0;

    // Debug the input data
    console.log('Creating elements with:', {
        hashIndexData,
        vectorMapSize: vectorMap.size,
        keyToCoordsSize: Object.keys(keyToCoords).length
    });

    Object.entries(hashIndexData).forEach(([hashKey, hashData]) => {
        // Extract vectorIds from the hashData object
        const vectorIdsArray = hashData.vectorIds || [];
        
        console.log(`Processing hash key ${hashKey} with vectorIds:`, vectorIdsArray);

        vectorIdsArray.forEach(vectorId => {
            const coords = keyToCoords[vectorId];
            if (coords && vectorMap.has(vectorId)) {
                const position = new THREE.Vector3(coords.x, coords.y, coords.z);
                const text = vectorMap.get(vectorId).text;
                const fileId = vectorMap.get(vectorId).fileId;
                
                console.log(`Creating element for vector ${vectorId} at position:`, position);

                const object = createFloatingElement(
                    text, 
                    position, 
                    vectorId, 
                    fileId, 
                    hashKey,
                    index++ // Pass incremented index for staggering
                );
                
                scene.add(object);
                objectMap.set(vectorId, object);
            } else {
                console.warn(`Missing data for vector ${vectorId}:`, {
                    hasCoords: !!coords,
                    inVectorMap: vectorMap.has(vectorId)
                });
            }
        });
    });

    console.log(`Created ${objectMap.size} elements`);
    return objectMap;
}

// Update validation function
function validateData(hashIndexData, vectorMap, keyToCoords) {
    console.log('Validating data structure:', {
        hashIndexData: typeof hashIndexData,
        hashIndexDataKeys: Object.keys(hashIndexData),
        vectorMapSize: vectorMap.size,
        keyToCoordsKeys: Object.keys(keyToCoords)
    });

    // Sample the first entry to check structure
    const firstHash = Object.keys(hashIndexData)[0];
    if (firstHash) {
        const hashData = hashIndexData[firstHash];
        console.log('Sample hash entry:', {
            hash: firstHash,
            hashData,
            vectorIds: hashData.vectorIds,
            isArray: Array.isArray(hashData.vectorIds)
        });
    }
}

// Add click handler to reset active states when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.vector-projection')) {
        document.querySelectorAll('.vector-projection').forEach(el => {
            el.classList.remove('active');
            el.style.zIndex = '1';
        });
    }
});

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

function debugSceneElements(scene) {
    console.log('Scene Debug Info:', {
        totalChildren: scene.children.length,
        css3dObjects: scene.children.filter(child => child instanceof CSS3DObject).length
    });

    scene.children.forEach((child, index) => {
        if (child instanceof CSS3DObject) {
            console.log(`CSS3D Object ${index}:`, {
                name: child.name,
                position: child.position,
                visible: child.visible,
                element: child.element,
                elementClasses: child.element.className,
                elementStyle: child.element.style.cssText
            });
        }
    });
}

// Add this to setupTextProjectionVisualization after creating elements:
// debugSceneElements(scene);

// Add visibility check
function checkElementVisibility() {
    const vectorElements = document.querySelectorAll('.vector-projection');
    console.log(`Found ${vectorElements.length} vector elements in DOM`);
    vectorElements.forEach(el => {
        console.log('Vector element:', {
            id: el.id,
            visible: el.style.display !== 'none',
            position: el.style.transform,
            size: `${el.offsetWidth}x${el.offsetHeight}`
        });
    });
}

function addDebugHelpers(scene) {
    // Add axes helper
    const axesHelper = new THREE.AxesHelper(200);
    scene.add(axesHelper);
    
    // Add grid helper
    const gridHelper = new THREE.GridHelper(400, 10);
    scene.add(gridHelper);
    
    console.log('Added debug helpers to scene');
}
