import * as THREE from 'three';
import { gsap } from 'gsap';
import { findAllSpheres } from './snapshot.js';
import { share3dDat, markNeedsRender } from './create.js';
import { getFileSystem } from '../../memory/collaboration/file_colab';
import indexDBOverlay from '../../memory/local/file_worker';

const PARTICLE_COUNT = 50; // Reduced for better performance
const CURVE_AMOUNT = 0.2; // Amount of curve (0 to 1)
const MAX_CONNECTIONS = 20; // Maximum number of connections per particle
const MIN_DISTANCE = 1; // Minimum distance for particles to connect

let isConnecting = false;
let connectedLines = new Map(); // Store connected lines

export async function initConnectLines() {
  if (!isConnecting) {
    isConnecting = true;
    await connectSimilarSpheres();
    isConnecting = false;
  }
}

async function connectSimilarSpheres() {
  const { scene, nonBloomScene } = share3dDat();
  const spheres = findAllSpheres([scene, nonBloomScene]);

  // Initialize IndexedDB
  await indexDBOverlay.openDB('fileGraphDB');
  await indexDBOverlay.openDB('summarizationDB', 2);

  // Create a map of sphere userIds to their keywords
  const sphereKeywords = new Map();
  for (const sphere of spheres) {
    if (sphere.userData && sphere.userData.id) {
      const keywords = await getKeywordsForSphere(sphere.userData.id);
      sphereKeywords.set(sphere.userData.id, keywords);
    }
  }

  // Compare each pair of spheres
  for (let i = 0; i < spheres.length; i++) {
    for (let j = i + 1; j < spheres.length; j++) {
      const sphere1 = spheres[i];
      const sphere2 = spheres[j];
      
      if (sphere1.userData && sphere2.userData && 
          sphere1.userData.id && sphere2.userData.id) {
        const keywords1 = sphereKeywords.get(sphere1.userData.id);
        const keywords2 = sphereKeywords.get(sphere2.userData.id);
        
        const commonKeywords = keywords1.filter(keyword => keywords2.includes(keyword));
        
        if (commonKeywords.length > 0) {
          const keyword = commonKeywords[0];
          await createParticleConnection(sphere1, sphere2, keyword);
        }
      }
    }
  }

  startParticleAnimation();
  markNeedsRender();
}

async function getKeywordsForSphere(sphereId) {
  try {
    const fileSystem = getFileSystem();
    const fileData = await fileSystem.getItem(sphereId, 'file');

    if (!fileData) {
      console.warn(`File data not found for sphere ${sphereId}`);
      return [];
    }

    const summaries = await indexDBOverlay.getData('summaries', 'summarizationDB');
    const summaryEntry = summaries.find(entry => entry.fileId === sphereId);

    if (summaryEntry && summaryEntry.keywords) {
      return summaryEntry.keywords;
    } else {
      console.warn(`No keywords found for sphere ${sphereId}`);
      return [];
    }
  } catch (error) {
    console.error('Error fetching keywords:', error);
    return [];
  }
}

function createParticleConnection(sphere1, sphere2, keyword) {
  const curve = new THREE.QuadraticBezierCurve3(
    sphere1.position,
    getMiddlePoint(sphere1.position, sphere2.position),
    sphere2.position
  );

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = i / (PARTICLE_COUNT - 1);
    const point = curve.getPoint(t);
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;

    // Set color to white
    colors[i * 3] = 1;
    colors[i * 3 + 1] = 1;
    colors[i * 3 + 2] = 1;

    // Random size for each particle
    sizes[i] = Math.random() * 0.1 + 0.05;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    sizeAttenuation: true
  });

  const particles = new THREE.Points(geometry, material);

  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.2
  });

  const lineGeometry = new THREE.BufferGeometry().setFromPoints(
    curve.getPoints(PARTICLE_COUNT - 1)
  );
  const line = new THREE.Line(lineGeometry, lineMaterial);

  const group = new THREE.Group();
  group.add(particles);
  group.add(line);
  group.userData.sphere1 = sphere1;
  group.userData.sphere2 = sphere2;
  group.userData.curve = curve;

  const { scene } = share3dDat();
  scene.add(group);

  const key = `${sphere1.uuid}-${sphere2.uuid}`;
  connectedLines.set(key, group);

  return group;
}

function getMiddlePoint(point1, point2) {
  const midPoint = new THREE.Vector3().addVectors(point1, point2).multiplyScalar(0.5);
  const direction = new THREE.Vector3().subVectors(point2, point1).normalize();
  const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
  
  const randomOffset = (Math.random() - 0.5) * 2;
  return midPoint.add(perpendicular.multiplyScalar(CURVE_AMOUNT * randomOffset * point1.distanceTo(point2)));
}

function startParticleAnimation() {
  const animate = () => {
    connectedLines.forEach((group) => {
      const particles = group.children[0];
      const positions = particles.geometry.attributes.position.array;
      const curve = group.userData.curve;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const t = (i / (PARTICLE_COUNT - 1) + Date.now() * 0.0001) % 1;
        const point = curve.getPoint(t);
        positions[i * 3] = point.x;
        positions[i * 3 + 1] = point.y;
        positions[i * 3 + 2] = point.z;
      }

      particles.geometry.attributes.position.needsUpdate = true;
    });

    markNeedsRender();
    requestAnimationFrame(animate);
  };

  animate();
}

export function updateConnectedLines() {
  connectedLines.forEach((group) => {
    const sphere1 = group.userData.sphere1;
    const sphere2 = group.userData.sphere2;
    const particles = group.children[0];
    const line = group.children[1];

    const newCurve = new THREE.QuadraticBezierCurve3(
      sphere1.position,
      getMiddlePoint(sphere1.position, sphere2.position),
      sphere2.position
    );

    group.userData.curve = newCurve;

    // Update line
    const linePositions = line.geometry.attributes.position.array;
    const linePoints = newCurve.getPoints(PARTICLE_COUNT - 1);
    for (let i = 0; i < linePoints.length; i++) {
      linePositions[i * 3] = linePoints[i].x;
      linePositions[i * 3 + 1] = linePoints[i].y;
      linePositions[i * 3 + 2] = linePoints[i].z;
    }
    line.geometry.attributes.position.needsUpdate = true;
  });

  markNeedsRender();
}