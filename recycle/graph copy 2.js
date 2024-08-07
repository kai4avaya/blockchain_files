import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DragControls } from 'three/examples/jsm/controls/DragControls';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force-3d';
import TWEEN from '@tweenjs/tween.js';

let scene, camera, controls, renderer, dragControls;
const nodes = new Map();
const links = [];

let rendererReady = false;

export function isRendererReady() {
  return rendererReady;
}

export function graphInit(initScene, initCamera, initRenderer) {
  scene = initScene;
  camera = initCamera;
  renderer = initRenderer;
  rendererReady = true;

  controls = new OrbitControls(camera, renderer.domElement);
  camera.position.set(0, 0, 200);
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  initDragControls();
  initDoubleClick();
  initMouseWheelZoom();

  animate();
}

function initDragControls() {
  dragControls = new DragControls(Array.from(nodes.values()).map(node => node.group), camera, renderer.domElement);
  dragControls.addEventListener('dragstart', function (event) {
    controls.enabled = false;
    simulation.alphaTarget(0.3).restart(); // Restart the simulation to make sure it updates continuously
  });
  dragControls.addEventListener('dragend', function (event) {
    controls.enabled = true;
    simulation.alphaTarget(0); // Stop the simulation when dragging ends
  });
  dragControls.addEventListener('drag', function (event) {
    const node = nodes.get(event.object.userData.id);
    node.x = event.object.position.x;
    node.y = event.object.position.y;
    node.z = event.object.position.z;

    // Update the node's position in the simulation
    simulation.nodes().forEach(n => {
      if (n.id === node.id) {
        n.fx = node.x;
        n.fy = node.y;
        n.fz = node.z;
      }
    });
  });
}

function initDoubleClick() {
  renderer.domElement.addEventListener('dblclick', onDoubleClick);
}

function initMouseWheelZoom() {
  renderer.domElement.addEventListener('wheel', onMouseWheel);
}

function onDoubleClick(event) {
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), -camera.position.z);
  const intersectPoint = new THREE.Vector3();

  raycaster.ray.intersectPlane(planeZ, intersectPoint);

  if (intersectPoint) {
    smoothZoomTo(intersectPoint);
  }
}

function onMouseWheel(event) {
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), -camera.position.z);
  const intersectPoint = new THREE.Vector3();

  raycaster.ray.intersectPlane(planeZ, intersectPoint);

  if (intersectPoint) {
    const zoomFactor = event.deltaY * 0.1;
    camera.position.lerp(intersectPoint, zoomFactor);
    controls.target.lerp(intersectPoint, zoomFactor);
    controls.update();
  }
}

function smoothZoomTo(target) {
  const duration = 1000; // Duration of the zoom in milliseconds
  const initialPosition = camera.position.clone();
  const initialTarget = controls.target.clone();

  const tween = new TWEEN.Tween({
    x: initialPosition.x,
    y: initialPosition.y,
    z: initialPosition.z,
    tx: initialTarget.x,
    ty: initialTarget.y,
    tz: initialTarget.z
  })
    .to({
      x: target.x,
      y: target.y,
      z: target.z + 50, // Offset for zoom
      tx: target.x,
      ty: target.y,
      tz: target.z
    }, duration)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .onUpdate((coords) => {
      camera.position.set(coords.x, coords.y, coords.z);
      controls.target.set(coords.tx, coords.ty, coords.tz);
      controls.update();
    })
    .start();
}

function getRandomShape(size) {
  const geometryTypes = [
    new THREE.BoxGeometry(size, size, size),
    new THREE.SphereGeometry(size / 2, 32, 32),
    new THREE.ConeGeometry(size / 2, size, 32),
    new THREE.CylinderGeometry(size / 2, size / 2, size, 32),
    new THREE.TorusGeometry(size / 2, size / 4, 16, 100)
  ];
  const randomIndex = Math.floor(Math.random() * geometryTypes.length);
  return geometryTypes[randomIndex];
}

export function addNode(id, name = '', size = 1, x = Math.random() * 100 - 50, y = Math.random() * 100 - 50, z = Math.random() * 100 - 50, color = Math.random() * 0xffffff) {
  const geometry = getRandomShape(Math.cbrt(size) / 10);
  const material = new THREE.MeshBasicMaterial({ color: color });
  const node = {
    id,
    name,
    size,
    geometry,
    material,
    x,
    y,
    z,
    color
  };

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(node.x, node.y, node.z);
  mesh.userData = { id };

  const group = new THREE.Group();
  group.add(mesh);

  if (name) {
    const loader = new FontLoader();
    loader.load('./assets/fonts/helvetica.json', function (font) {
      const textGeometry = new TextGeometry(name, {
        font: font,
        size: Math.cbrt(size) / 20,
        depth: 0.1,
      });
      textGeometry.computeBoundingBox();
      const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
      const textMaterial = new THREE.MeshBasicMaterial({ color: color });
      const textMesh = new THREE.Mesh(textGeometry, textMaterial);
      textMesh.position.set(-textWidth / 2, Math.cbrt(size) / 10 + 5, 0); // Adjust Y coordinate to be above the node
      group.add(textMesh);
      node.textMesh = textMesh;
    });
  }

  scene.add(group);
  node.mesh = mesh;
  node.group = group;

  nodes.set(id, node);

  initDragControls();
}

export function updateGraph(newNodes, newLinks) {
  for (let [id, node] of nodes) {
    if (!newNodes.find(n => n.id === id)) {
      scene.remove(node.group);
      nodes.delete(id);
    }
  }

  newNodes.forEach(node => {
    if (nodes.has(node.id)) {
      const existingNode = nodes.get(node.id);
      existingNode.group.position.set(node.x, node.y, node.z);
    } else {
      addNode(node.id, node.name, node.size, node.x, node.y, node.z, node.color);
    }
  });

  newLinks.forEach(link => {
    const sourceNode = nodes.get(link.source);
    const targetNode = nodes.get(link.target);
    if (sourceNode && targetNode) {
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(sourceNode.group.position.x, sourceNode.group.position.y, sourceNode.group.position.z),
        new THREE.Vector3(targetNode.group.position.x, targetNode.group.position.y, targetNode.group.position.z)
      ]);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      links.push(line);
      scene.add(line);
    }
  });

  initDragControls();
}

function animate() {
  requestAnimationFrame(animate);
  if (controls) {
    controls.update();
  }
  if (scene && camera) {
    renderer.render(scene, camera);
  }
  TWEEN.update(); // Ensure TWEEN updates
}

let simulation = forceSimulation()
  .force("link", forceLink().id(d => d.id).distance(50))
  .force("charge", forceManyBody().strength(-30))
  .force("center", forceCenter(0, 0, 0))
  .on("tick", () => {
    nodes.forEach(node => {
      const n = node.group;
      n.position.x = node.x;
      n.position.y = node.y;
      n.position.z = node.z;

      // Ensure text moves with the node
      if (node.textMesh) {
        node.textMesh.position.set(n.position.x, n.position.y + Math.cbrt(node.size) / 10 + 5, n.position.z); // Adjust Y coordinate to be above the node
      }
    });

    links.forEach(link => {
      const sourceNode = nodes.get(link.source);
      const targetNode = nodes.get(link.target);
      if (sourceNode && targetNode) {
        link.geometry.setFromPoints([
          new THREE.Vector3(sourceNode.group.position.x, sourceNode.group.position.y, sourceNode.group.position.z),
          new THREE.Vector3(targetNode.group.position.x, targetNode.group.position.y, targetNode.group.position.z)
        ]);
      }
    });
  });

export function startSimulation(graphData) {
  simulation.nodes(graphData.nodes);
  simulation.force("link").links(graphData.links);
  updateGraph(graphData.nodes, graphData.links);
}

export function debugNodes() {
  nodes.forEach(node => {
    console.log(`Node ${node.id}: (${node.x.toFixed(2)}, ${node.y.toFixed(2)}, ${node.z.toFixed(2)})`);
  });
}
